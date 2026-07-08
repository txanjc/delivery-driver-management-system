-- Repair the shared admin-check helper after profile primary key rename.
-- Existing applied policies call this function, so replacing it fixes reads
-- without changing table structure.

create or replace function public.is_authenticated_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where profile_id = auth.uid()
      and role = 'admin'
      and coalesce(is_active, false) = true
  );
$$;

revoke all on function public.is_authenticated_admin() from public;
grant execute on function public.is_authenticated_admin() to authenticated;
