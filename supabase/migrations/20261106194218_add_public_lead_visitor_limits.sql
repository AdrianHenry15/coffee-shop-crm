CREATE TABLE private.public_lead_rate_windows (
  form_id uuid NOT NULL
    REFERENCES public.organization_lead_forms(id) ON DELETE CASCADE,
  visitor_hash text NOT NULL
    CHECK (visitor_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 5),
  PRIMARY KEY (form_id, visitor_hash, window_start)
);

CREATE INDEX public_lead_rate_windows_cleanup_idx
  ON private.public_lead_rate_windows(form_id, window_start);

ALTER TABLE private.public_lead_rate_windows
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.public_lead_rate_windows
FROM PUBLIC, anon, authenticated;


CREATE FUNCTION public.consume_public_lead_attempt(
  p_form_id uuid,
  p_visitor_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_attempts integer;
BEGIN
  IF p_form_id IS NULL
    OR p_visitor_hash IS NULL
    OR p_visitor_hash !~ '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION 'Invalid attempt'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_lead_forms
    WHERE id = p_form_id AND enabled = true
  ) THEN
    RETURN false;
  END IF;

  v_window_start := date_bin(
    interval '10 minutes',
    v_now,
    timestamptz '2000-01-01 00:00:00+00'
  );

  -- Remove old visitor buckets for this form as it receives traffic.
  DELETE FROM private.public_lead_rate_windows
  WHERE form_id = p_form_id
    AND window_start < v_now - interval '24 hours';

  INSERT INTO private.public_lead_rate_windows AS bucket (
    form_id,
    visitor_hash,
    window_start,
    attempts
  )
  VALUES (
    p_form_id,
    p_visitor_hash,
    v_window_start,
    1
  )
  ON CONFLICT (form_id, visitor_hash, window_start)
  DO UPDATE SET attempts = bucket.attempts + 1
  WHERE bucket.attempts < 5
  RETURNING attempts INTO v_attempts;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION
  public.consume_public_lead_attempt(uuid, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.consume_public_lead_attempt(uuid, text)
TO service_role;