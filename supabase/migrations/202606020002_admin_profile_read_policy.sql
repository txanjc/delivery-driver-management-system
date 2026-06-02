-- Allow active admins to read all profile records for Admin User Management.
-- RLS stays enabled; non-admin users do not receive this broad read access.

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
    where id = auth.uid()
      and role = 'admin'
      and coalesce(is_active, false) = true
  );
$$;

revoke all on function public.is_authenticated_admin() from public;
grant execute on function public.is_authenticated_admin() to authenticated;

alter table public.profiles enable row level security;

drop policy if exists "Admins can read profile records" on public.profiles;
create policy "Admins can read profile records"
on public.profiles
for select
to authenticated
using (public.is_authenticated_admin());
