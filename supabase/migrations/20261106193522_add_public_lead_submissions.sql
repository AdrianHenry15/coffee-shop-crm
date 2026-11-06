-- CRM includes existing manually created and imported records.
ALTER TABLE public.leads
  ADD COLUMN source text NOT NULL DEFAULT 'crm',
  ADD COLUMN source_form_id uuid;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_source_check
    CHECK (source IN ('crm', 'website_form'));

-- Keep form references within the same workspace.
ALTER TABLE public.organization_lead_forms
  ADD CONSTRAINT organization_lead_forms_id_org_unique
    UNIQUE (id, organization_id);

ALTER TABLE public.leads
  ADD CONSTRAINT leads_source_form_workspace_fkey
  FOREIGN KEY (source_form_id, organization_id)
  REFERENCES public.organization_lead_forms(id, organization_id)
  ON DELETE SET NULL (source_form_id);

CREATE INDEX leads_source_form_idx
  ON public.leads(source_form_id, organization_id)
  WHERE source_form_id IS NOT NULL;


-- Stores retry receipts without copying contact details.
CREATE TABLE private.public_lead_submission_receipts (
  form_id uuid NOT NULL
    REFERENCES public.organization_lead_forms(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL,
  payload_hash text NOT NULL CHECK (length(payload_hash) = 32),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (form_id, submission_id)
);

CREATE INDEX public_lead_submission_receipts_rate_idx
  ON private.public_lead_submission_receipts(form_id, created_at);

ALTER TABLE private.public_lead_submission_receipts
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.public_lead_submission_receipts
FROM PUBLIC, anon, authenticated;


CREATE FUNCTION public.submit_public_lead(
  p_form_id uuid,
  p_submission_id uuid,
  p_name text,
  p_email text,
  p_phone text,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_organization_id uuid;
  v_name text := btrim(p_name);
  v_email text := lower(btrim(p_email));
  v_phone text := NULLIF(btrim(p_phone), '');
  v_message text := btrim(p_message);
  v_payload_hash text;
  v_existing_hash text;
  v_hour_count bigint;
  v_day_count bigint;
  v_now timestamptz;
BEGIN
  IF p_form_id IS NULL OR p_submission_id IS NULL THEN
    RAISE EXCEPTION 'Invalid submission'
      USING ERRCODE = '22023';
  END IF;

  IF v_name IS NULL
    OR length(v_name) NOT BETWEEN 1 AND 200
  THEN
    RAISE EXCEPTION 'Enter a name containing 1–200 characters'
      USING ERRCODE = '22023';
  END IF;

  IF v_email IS NULL
    OR length(v_email) > 254
    OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  THEN
    RAISE EXCEPTION 'Enter a valid email address'
      USING ERRCODE = '22023';
  END IF;

  IF v_phone IS NOT NULL AND (
    length(v_phone) > 50
    OR length(regexp_replace(v_phone, '[^0-9]', '', 'g'))
      NOT BETWEEN 7 AND 15
  ) THEN
    RAISE EXCEPTION 'Enter a valid phone number'
      USING ERRCODE = '22023';
  END IF;

  IF v_message IS NULL
    OR length(v_message) NOT BETWEEN 1 AND 5000
  THEN
    RAISE EXCEPTION 'Enter a message containing 1–5,000 characters'
      USING ERRCODE = '22023';
  END IF;

  SELECT form.organization_id
  INTO v_organization_id
  FROM public.organization_lead_forms AS form
  WHERE form.id = p_form_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact form is unavailable'
      USING ERRCODE = 'P0002';
  END IF;

  -- Same workspace lock used by configuration and capacity checks.
  -- Serializes submissions so concurrent requests cannot exceed limits.
  PERFORM 1
  FROM public.organizations
  WHERE id = v_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact form is unavailable'
      USING ERRCODE = 'P0002';
  END IF;

  -- Recheck after locking, in case the form was disabled.
  PERFORM 1
  FROM public.organization_lead_forms
  WHERE id = p_form_id
    AND organization_id = v_organization_id
    AND enabled = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact form is unavailable'
      USING ERRCODE = 'P0002';
  END IF;

  -- Used for retry comparison, not password or secret storage.
  v_payload_hash := md5(
    jsonb_build_object(
      'name', v_name,
      'email', v_email,
      'phone', v_phone,
      'message', v_message
    )::text
  );

  SELECT receipt.payload_hash
  INTO v_existing_hash
  FROM private.public_lead_submission_receipts AS receipt
  WHERE receipt.form_id = p_form_id
    AND receipt.submission_id = p_submission_id;

  IF FOUND THEN
    IF v_existing_hash IS DISTINCT FROM v_payload_hash THEN
      RAISE EXCEPTION 'Submission ID was already used for another message'
        USING ERRCODE = '22023';
    END IF;

    -- A successful retry must not create another lead.
    RETURN;
  END IF;

  v_now := clock_timestamp();

  SELECT
    count(*) FILTER (
      WHERE receipt.created_at >= v_now - interval '1 hour'
    ),
    count(*)
  INTO v_hour_count, v_day_count
  FROM private.public_lead_submission_receipts AS receipt
  WHERE receipt.form_id = p_form_id
    AND receipt.created_at >= v_now - interval '24 hours';

  IF v_hour_count >= 20 OR v_day_count >= 100 THEN
    RAISE EXCEPTION 'Contact form submission limit reached'
      USING ERRCODE = 'P0001';
  END IF;

  -- Existing lead triggers enforce subscription status and capacity.
  INSERT INTO public.leads (
    organization_id,
    name,
    email,
    phone,
    notes,
    status,
    source,
    source_form_id
  )
  VALUES (
    v_organization_id,
    v_name,
    v_email,
    v_phone,
    v_message,
    'new',
    'website_form',
    p_form_id
  );

  INSERT INTO private.public_lead_submission_receipts (
    form_id,
    submission_id,
    payload_hash,
    created_at
  )
  VALUES (
    p_form_id,
    p_submission_id,
    v_payload_hash,
    v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION
  public.submit_public_lead(uuid, uuid, text, text, text, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.submit_public_lead(uuid, uuid, text, text, text, text)
TO service_role;