-- Allow the dedicated role to call Supabase's auth helper.
grant usage on schema auth to estimate_deleter;

grant execute on function auth.uid() to estimate_deleter;