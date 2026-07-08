-- Allow active admins to read and manage driver schedules without disabling RLS.

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

alter table public.schedules enable row level security;

drop policy if exists "Admins can read schedule records" on public.schedules;
create policy "Admins can read schedule records"
on public.schedules
for select
to authenticated
using (public.is_authenticated_admin());

drop policy if exists "Admins can create schedule records" on public.schedules;
create policy "Admins can create schedule records"
on public.schedules
for insert
to authenticated
with check (public.is_authenticated_admin());

drop policy if exists "Admins can update schedule records" on public.schedules;
create policy "Admins can update schedule records"
on public.schedules
for update
to authenticated
using (public.is_authenticated_admin())
with check (public.is_authenticated_admin());
