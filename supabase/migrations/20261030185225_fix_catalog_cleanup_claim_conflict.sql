DO $$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.claim_catalog_image_cleanup(integer)'::regprocedure
  )
  INTO v_definition;

  v_definition := replace(
    v_definition,
    'ON CONFLICT (object_path) DO NOTHING;',
    'ON CONFLICT ON CONSTRAINT catalog_image_cleanup_jobs_pkey DO NOTHING;'
  );

  EXECUTE v_definition;
END;
$$;