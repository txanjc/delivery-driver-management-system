create or replace function public.current_driver_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select driver_id
  from public.drivers
  where user_id = auth.uid()
  limit 1
$$;

revoke all on function public.current_driver_id() from public;
grant execute on function public.current_driver_id() to authenticated;

alter table public.drivers enable row level security;
alter table public.deliveries enable row level security;
alter table public.routes enable row level security;
alter table public.schedules enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Drivers can read own driver record" on public.drivers;
create policy "Drivers can read own driver record"
on public.drivers
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Drivers can read assigned deliveries" on public.deliveries;
create policy "Drivers can read assigned deliveries"
on public.deliveries
for select
to authenticated
using (assigned_driver_id = public.current_driver_id());

drop policy if exists "Drivers can read routes for assigned deliveries" on public.routes;
create policy "Drivers can read routes for assigned deliveries"
on public.routes
for select
to authenticated
using (
  exists (
    select 1
    from public.deliveries
    where deliveries.delivery_id = routes.delivery_id
      and deliveries.assigned_driver_id = public.current_driver_id()
  )
);

drop policy if exists "Drivers can read own schedules" on public.schedules;
create policy "Drivers can read own schedules"
on public.schedules
for select
to authenticated
using (driver_id = public.current_driver_id());

drop policy if exists "Drivers can read own notifications" on public.notifications;
create policy "Drivers can read own notifications"
on public.notifications
for select
to authenticated
using (user_id = auth.uid());
