-- Make "administrator" the canonical privileged role while retaining legacy
-- "admin" compatibility during deployment and rollback windows.

update public.profiles
set role = 'administrator'
where role = 'admin';

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
      and role in ('administrator', 'admin')
      and is_active = true
  );
$$;

revoke all on function public.is_authenticated_admin() from public;
grant execute on function public.is_authenticated_admin() to authenticated;
