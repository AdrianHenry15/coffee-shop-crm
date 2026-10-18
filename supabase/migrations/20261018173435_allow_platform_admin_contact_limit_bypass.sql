CREATE OR REPLACE FUNCTION private.enforce_subscription_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  resource_limit integer;
  resource_count integer;
  resource_name text;
  subscription_status text;
BEGIN
  -- Serialize inserts within the same organization.
  PERFORM 1
  FROM public.organizations
  WHERE id = NEW.organization_id
  FOR UPDATE;

  -- Verify the organization's subscription status.
  SELECT s.status
  INTO subscription_status
  FROM public.organization_subscriptions AS s
  WHERE s.organization_id = NEW.organization_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization subscription not found'
      USING errcode = 'P0001';
  END IF;

  IF subscription_status NOT IN ('active', 'trialing') THEN
    RAISE EXCEPTION 'Organization subscription is not active'
      USING errcode = 'P0001';
  END IF;

  -- Platform owners and admins bypass contact caps only.
  IF TG_TABLE_NAME IN ('leads', 'customers')
    AND private.is_platform_admin()
  THEN
    RETURN NEW;
  END IF;

  resource_name := CASE TG_TABLE_NAME
    WHEN 'organization_members' THEN 'members'
    WHEN 'customers' THEN 'customers'
    WHEN 'leads' THEN 'leads'
    WHEN 'estimates' THEN 'estimates'
    WHEN 'jobs' THEN 'jobs'
    ELSE NULL
  END;

  IF resource_name IS NULL THEN
    RAISE EXCEPTION 'Unsupported subscription resource'
      USING errcode = '22023';
  END IF;

  resource_limit := private.get_effective_subscription_limit(
    NEW.organization_id,
    resource_name
  );

  -- NULL means unlimited.
  IF resource_limit IS NULL THEN
    RETURN NEW;
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'organization_members' THEN
      SELECT count(*) INTO resource_count
      FROM public.organization_members
      WHERE organization_id = NEW.organization_id
        AND status = 'active';

    WHEN 'customers' THEN
      SELECT count(*) INTO resource_count
      FROM public.customers
      WHERE organization_id = NEW.organization_id;

    WHEN 'leads' THEN
      SELECT count(*) INTO resource_count
      FROM public.leads
      WHERE organization_id = NEW.organization_id;

    WHEN 'estimates' THEN
      SELECT count(*) INTO resource_count
      FROM public.estimates
      WHERE organization_id = NEW.organization_id;

    WHEN 'jobs' THEN
      SELECT count(*) INTO resource_count
      FROM public.jobs
      WHERE organization_id = NEW.organization_id;
  END CASE;

  IF resource_count >= resource_limit THEN
    RAISE EXCEPTION 'Subscription limit reached for %', TG_TABLE_NAME
      USING errcode = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;