-- One counter per website connection.
-- This internal table is not accessible through the public API.
CREATE TABLE private.catalog_website_request_windows (
  connection_id uuid PRIMARY KEY
    REFERENCES public.catalog_website_connections(id)
    ON DELETE CASCADE,

  window_start timestamptz NOT NULL,

  request_count integer NOT NULL
    CHECK (request_count BETWEEN 1 AND 60)
);

ALTER TABLE private.catalog_website_request_windows
ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON private.catalog_website_request_windows
FROM PUBLIC, anon, authenticated, service_role;

-- Authenticate and consume request capacity in one transaction.
-- Only the CRM server's service role can execute this function.
CREATE OR REPLACE FUNCTION public.consume_catalog_website_request(
  p_api_key_hash text
)
RETURNS TABLE (
  organization_id uuid,
  allowed boolean,
  retry_after integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_connection_id uuid;
  v_organization_id uuid;
  v_window_start timestamptz;
  v_retry_after integer;
BEGIN
  IF p_api_key_hash IS NULL
    OR p_api_key_hash !~ '^[0-9a-f]{64}$'
  THEN
    RETURN;
  END IF;

  SELECT connection.id, connection.organization_id
  INTO v_connection_id, v_organization_id
  FROM public.catalog_website_connections AS connection
  WHERE connection.api_key_hash = p_api_key_hash
    AND connection.enabled = true
  FOR SHARE;

  -- Invalid, disabled, or deleted connections return no rows.
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_window_start := date_trunc('minute', clock_timestamp());

  INSERT INTO private.catalog_website_request_windows AS usage (
    connection_id,
    window_start,
    request_count
  )
  VALUES (
    v_connection_id,
    v_window_start,
    1
  )
  ON CONFLICT (connection_id)
  DO UPDATE SET
    window_start = EXCLUDED.window_start,
    request_count = CASE
      WHEN usage.window_start = EXCLUDED.window_start
        THEN usage.request_count + 1
      ELSE 1
    END
  WHERE
    usage.window_start < EXCLUDED.window_start
    OR (
      usage.window_start = EXCLUDED.window_start
      AND usage.request_count < 60
    );

  IF NOT FOUND THEN
    v_retry_after := greatest(
      1,
      ceil(
        extract(
          epoch FROM (
            v_window_start + interval '1 minute' - clock_timestamp()
          )
        )
      )::integer
    );

    RETURN QUERY
    SELECT NULL::uuid, false, v_retry_after;

    RETURN;
  END IF;

  RETURN QUERY
  SELECT v_organization_id, true, 0;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_catalog_website_request(text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.consume_catalog_website_request(text)
TO service_role;