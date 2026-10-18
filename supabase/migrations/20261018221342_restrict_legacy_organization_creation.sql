-- Initial organization creation must use onboard_organization.
-- Its SECURITY DEFINER function can still call this helper.

REVOKE ALL ON FUNCTION public.create_organization(text, text)
FROM PUBLIC, anon, authenticated;