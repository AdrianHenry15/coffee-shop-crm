INSERT INTO public.platform_admins (
  user_id,
  role
)
VALUES (
  '29ef0cb5-abd8-4a24-be08-ea70d5dd33d0'::uuid,
  'owner'
)
ON CONFLICT (user_id)
DO UPDATE SET role = 'owner'
RETURNING user_id, role;