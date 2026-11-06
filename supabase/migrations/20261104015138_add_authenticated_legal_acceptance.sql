-- Preserve separate receipts when document versions change.
ALTER TABLE private.account_legal_acceptances
  DROP CONSTRAINT account_legal_acceptances_pkey;

ALTER TABLE private.account_legal_acceptances
  ADD PRIMARY KEY (user_id, terms_version, privacy_version);

ALTER TABLE private.account_legal_acceptances
  DROP CONSTRAINT legal_acceptance_source_check;

ALTER TABLE private.account_legal_acceptances
  ADD CONSTRAINT legal_acceptance_source_check
  CHECK (
    source IN ('signup_declaration', 'authenticated_acceptance')
  );


-- Only reports acceptance for the caller.
CREATE FUNCTION public.has_current_legal_acceptance()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM private.account_legal_acceptances AS acceptance
    WHERE acceptance.user_id = (SELECT auth.uid())
      AND acceptance.terms_version = '2026-11-03'
      AND acceptance.privacy_version = '2026-11-03'
  );
$$;

REVOKE ALL ON FUNCTION public.has_current_legal_acceptance()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_current_legal_acceptance()
TO authenticated;


CREATE FUNCTION public.accept_current_legal_documents(
  p_terms_version text,
  p_privacy_version text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF p_terms_version IS DISTINCT FROM '2026-11-03'
    OR p_privacy_version IS DISTINCT FROM '2026-11-03'
  THEN
    RAISE EXCEPTION 'Legal documents changed. Reload before accepting.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO private.account_legal_acceptances (
    user_id,
    terms_version,
    privacy_version,
    source
  )
  VALUES (
    v_user_id,
    p_terms_version,
    p_privacy_version,
    'authenticated_acceptance'
  )
  ON CONFLICT (user_id, terms_version, privacy_version)
  DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION
  public.accept_current_legal_documents(text, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
  public.accept_current_legal_documents(text, text)
TO authenticated;