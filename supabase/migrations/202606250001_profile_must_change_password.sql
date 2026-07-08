alter table public.profiles
add column if not exists must_change_password boolean not null default false;

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (profile_id = auth.uid());

create or replace function public.clear_own_must_change_password()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set must_change_password = false
  where profile_id = auth.uid();
$$;

revoke all on function public.clear_own_must_change_password() from public;
grant execute on function public.clear_own_must_change_password() to authenticated;
