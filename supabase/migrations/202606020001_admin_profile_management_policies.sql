-- Allow authenticated admins to manage profile records without disabling RLS.
-- This supports admin-created profile rows while keeping service role keys out
-- of browser code.

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

alter table public.profiles enable row level security;

drop policy if exists "Admins can create profile records" on public.profiles;
create policy "Admins can create profile records"
on public.profiles
for insert
to authenticated
with check (public.is_authenticated_admin());

drop policy if exists "Admins can update profile records" on public.profiles;
create policy "Admins can update profile records"
on public.profiles
for update
to authenticated
using (public.is_authenticated_admin())
with check (public.is_authenticated_admin());
