-- Initial signup declarations only.
-- Existing accounts are not backfilled with assumed acceptance.

CREATE TABLE private.account_legal_acceptances (
  user_id uuid PRIMARY KEY
    REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  privacy_version text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  source text NOT NULL DEFAULT 'signup_declaration',
  CONSTRAINT legal_acceptance_source_check
    CHECK (source = 'signup_declaration')
);

ALTER TABLE private.account_legal_acceptances
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.account_legal_acceptances
FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.record_signup_legal_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only record the currently published documents when the
  -- signup request explicitly declares acceptance.
  IF NEW.raw_user_meta_data -> 'legal_accepted' = 'true'::jsonb
    AND NEW.raw_user_meta_data ->> 'terms_version' = '2026-11-03'
    AND NEW.raw_user_meta_data ->> 'privacy_version' = '2026-11-03'
  THEN
    INSERT INTO private.account_legal_acceptances (
      user_id,
      terms_version,
      privacy_version
    )
    VALUES (
      NEW.id,
      '2026-11-03',
      '2026-11-03'
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION
  private.record_signup_legal_acceptance()
FROM PUBLIC, anon, authenticated;

CREATE TRIGGER record_signup_legal_acceptance
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION private.record_signup_legal_acceptance();