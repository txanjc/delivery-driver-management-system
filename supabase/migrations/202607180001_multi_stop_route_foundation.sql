-- Backward-compatible foundation for optimized multi-stop routes.
-- Legacy routes.delivery_id and existing route geometry remain intact.

create or replace function public.is_authenticated_dispatcher()
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
      and role = 'dispatcher'
      and is_active = true
  );
$$;

revoke all on function public.is_authenticated_dispatcher() from public;
grant execute on function public.is_authenticated_dispatcher() to authenticated;

create or replace function public.set_route_optimization_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.company_settings (
  id uuid primary key default '00000000-0000-0000-0000-000000000001'::uuid,
  organization_name text,
  operating_location_name text,
  operating_address text,
  operating_place_id text,
  operating_latitude double precision,
  operating_longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(profile_id) on delete set null,
  constraint company_settings_singleton_check check (id = '00000000-0000-0000-0000-000000000001'::uuid),
  constraint company_settings_latitude_check check (operating_latitude is null or operating_latitude between -90 and 90),
  constraint company_settings_longitude_check check (operating_longitude is null or operating_longitude between -180 and 180)
);

alter table public.routes
  add column if not exists route_number text,
  add column if not exists route_date date,
  add column if not exists driver_id uuid references public.drivers(driver_id) on delete set null,
  add column if not exists vehicle_id uuid references public.vehicles(vehicle_id) on delete set null,
  add column if not exists schedule_id uuid references public.schedules(schedule_id) on delete set null,
  add column if not exists start_location_name text,
  add column if not exists start_address text,
  add column if not exists start_place_id text,
  add column if not exists start_latitude double precision,
  add column if not exists start_longitude double precision,
  add column if not exists end_location_name text,
  add column if not exists end_address text,
  add column if not exists end_place_id text,
  add column if not exists end_latitude double precision,
  add column if not exists end_longitude double precision,
  add column if not exists return_to_depot boolean,
  add column if not exists departure_time timestamptz,
  add column if not exists shift_end_time timestamptz,
  add column if not exists estimated_completion_time timestamptz,
  add column if not exists total_distance_meters bigint,
  add column if not exists total_duration_seconds integer,
  add column if not exists encoded_polyline text,
  add column if not exists optimization_status text,
  add column if not exists optimized_at timestamptz,
  add column if not exists status text,
  add column if not exists created_by uuid references public.profiles(profile_id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'routes_start_latitude_check') then
    alter table public.routes add constraint routes_start_latitude_check check (start_latitude is null or start_latitude between -90 and 90);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'routes_start_longitude_check') then
    alter table public.routes add constraint routes_start_longitude_check check (start_longitude is null or start_longitude between -180 and 180);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'routes_end_latitude_check') then
    alter table public.routes add constraint routes_end_latitude_check check (end_latitude is null or end_latitude between -90 and 90);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'routes_end_longitude_check') then
    alter table public.routes add constraint routes_end_longitude_check check (end_longitude is null or end_longitude between -180 and 180);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'routes_total_distance_meters_check') then
    alter table public.routes add constraint routes_total_distance_meters_check check (total_distance_meters is null or total_distance_meters >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'routes_total_duration_seconds_check') then
    alter table public.routes add constraint routes_total_duration_seconds_check check (total_duration_seconds is null or total_duration_seconds >= 0);
  end if;
end;
$$;

create unique index if not exists routes_route_number_unique on public.routes (route_number) where route_number is not null;
create index if not exists routes_driver_id_index on public.routes (driver_id);
create index if not exists routes_vehicle_id_index on public.routes (vehicle_id);
create index if not exists routes_schedule_id_index on public.routes (schedule_id);
create index if not exists routes_route_date_index on public.routes (route_date);

create table if not exists public.route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(route_id) on delete cascade,
  delivery_id uuid not null references public.deliveries(delivery_id) on delete restrict,
  stop_sequence integer not null,
  original_sequence integer,
  estimated_arrival_time timestamptz,
  estimated_departure_time timestamptz,
  service_duration_seconds integer not null default 600,
  distance_from_previous_meters bigint,
  duration_from_previous_seconds integer,
  stop_status text not null default 'pending',
  arrived_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint route_stops_route_delivery_unique unique (route_id, delivery_id),
  constraint route_stops_route_sequence_unique unique (route_id, stop_sequence),
  constraint route_stops_stop_sequence_check check (stop_sequence > 0),
  constraint route_stops_original_sequence_check check (original_sequence is null or original_sequence > 0),
  constraint route_stops_service_duration_check check (service_duration_seconds >= 0),
  constraint route_stops_distance_check check (distance_from_previous_meters is null or distance_from_previous_meters >= 0),
  constraint route_stops_duration_check check (duration_from_previous_seconds is null or duration_from_previous_seconds >= 0)
);

create index if not exists route_stops_route_id_index on public.route_stops (route_id);
create index if not exists route_stops_delivery_id_index on public.route_stops (delivery_id);
create index if not exists route_stops_route_sequence_index on public.route_stops (route_id, stop_sequence);
create index if not exists route_stops_status_index on public.route_stops (stop_status);
create index if not exists route_stops_eta_index on public.route_stops (estimated_arrival_time);

drop trigger if exists company_settings_set_updated_at on public.company_settings;
create trigger company_settings_set_updated_at before update on public.company_settings for each row execute function public.set_route_optimization_updated_at();
drop trigger if exists routes_set_updated_at on public.routes;
create trigger routes_set_updated_at before update on public.routes for each row execute function public.set_route_optimization_updated_at();
drop trigger if exists route_stops_set_updated_at on public.route_stops;
create trigger route_stops_set_updated_at before update on public.route_stops for each row execute function public.set_route_optimization_updated_at();

-- Copy only legacy route data into new additive fields. Existing values always win.
update public.routes
set
  total_distance_meters = coalesce(total_distance_meters, round(estimated_distance_km * 1000)::bigint),
  total_duration_seconds = coalesce(total_duration_seconds, round(estimated_duration_minutes * 60)::integer),
  encoded_polyline = coalesce(encoded_polyline, route_polyline),
  optimization_status = coalesce(optimization_status, 'legacy'),
  status = coalesce(status, 'legacy')
where total_distance_meters is null
   or total_duration_seconds is null
   or encoded_polyline is null
   or optimization_status is null
   or status is null;

insert into public.route_stops (route_id, delivery_id, stop_sequence, original_sequence, stop_status)
select route_id, delivery_id, 1, 1, 'pending'
from public.routes
where delivery_id is not null
on conflict (route_id, delivery_id) do nothing;

alter table public.company_settings enable row level security;
alter table public.route_stops enable row level security;

drop policy if exists "Administrators can manage company settings" on public.company_settings;
create policy "Administrators can manage company settings"
on public.company_settings
for all
to authenticated
using (public.is_authenticated_admin())
with check (public.is_authenticated_admin());

drop policy if exists "Dispatchers can read company settings" on public.company_settings;
create policy "Dispatchers can read company settings"
on public.company_settings
for select
to authenticated
using (public.is_authenticated_dispatcher());

drop policy if exists "Administrators and dispatchers can manage route stops" on public.route_stops;
create policy "Administrators and dispatchers can manage route stops"
on public.route_stops
for all
to authenticated
using (public.is_authenticated_admin() or public.is_authenticated_dispatcher())
with check (public.is_authenticated_admin() or public.is_authenticated_dispatcher());

drop policy if exists "Drivers can read assigned route stops" on public.route_stops;
create policy "Drivers can read assigned route stops"
on public.route_stops
for select
to authenticated
using (
  exists (
    select 1
    from public.routes
    where routes.route_id = route_stops.route_id
      and (
        routes.driver_id = public.current_driver_id()
        or exists (
          select 1 from public.deliveries
          where deliveries.delivery_id = route_stops.delivery_id
            and deliveries.assigned_driver_id = public.current_driver_id()
        )
      )
  )
);

drop policy if exists "Administrators and dispatchers can manage routes" on public.routes;
create policy "Administrators and dispatchers can manage routes"
on public.routes
for all
to authenticated
using (public.is_authenticated_admin() or public.is_authenticated_dispatcher())
with check (public.is_authenticated_admin() or public.is_authenticated_dispatcher());

drop policy if exists "Drivers can read multi stop routes" on public.routes;
create policy "Drivers can read multi stop routes"
on public.routes
for select
to authenticated
using (driver_id = public.current_driver_id());
