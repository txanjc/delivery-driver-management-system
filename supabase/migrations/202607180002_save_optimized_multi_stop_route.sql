-- Atomic persistence for an already-optimized multi-stop route.
-- The application calls this only from a server-side active Administrator/Dispatcher endpoint.

create or replace function public.save_optimized_multi_stop_route(
  p_preview_id uuid,
  p_created_by uuid,
  p_route_date date,
  p_driver_id uuid,
  p_vehicle_id uuid,
  p_schedule_id uuid,
  p_start_location_name text,
  p_start_address text,
  p_start_place_id text,
  p_start_latitude double precision,
  p_start_longitude double precision,
  p_return_to_depot boolean,
  p_departure_time timestamptz,
  p_shift_end_time timestamptz,
  p_estimated_completion_time timestamptz,
  p_total_distance_meters bigint,
  p_total_duration_seconds integer,
  p_encoded_polyline text,
  p_stops jsonb,
  p_skipped_delivery_ids jsonb default '[]'::jsonb
)
returns table (route_id uuid, route_number text, route_status text, stop_count integer, saved_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_route_id uuid;
  v_route_number text;
  v_end_name text;
  v_end_address text;
  v_end_place_id text;
  v_end_latitude double precision;
  v_end_longitude double precision;
  v_stop_count integer;
begin
  if p_preview_id is null or p_created_by is null or p_route_date is null or p_driver_id is null or p_vehicle_id is null or p_schedule_id is null
    or p_start_address is null or btrim(p_start_address) = '' or p_start_latitude is null or p_start_longitude is null
    or p_departure_time is null or p_shift_end_time is null or p_estimated_completion_time is null
    or p_total_distance_meters is null or p_total_distance_meters < 0 or p_total_duration_seconds is null or p_total_duration_seconds < 0
    or p_encoded_polyline is null or btrim(p_encoded_polyline) = '' or jsonb_typeof(p_stops) <> 'array' then
    raise exception 'The optimized route details are incomplete.' using errcode = 'P0001';
  end if;

  if p_start_latitude not between -90 and 90 or p_start_longitude not between -180 and 180
    or p_shift_end_time <= p_departure_time then
    raise exception 'The optimized route timing or starting location is invalid.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_preview_id::text));
  v_route_number := format('MSR-%s-%s', to_char(p_route_date, 'YYYYMMDD'), upper(substr(md5(p_preview_id::text), 1, 10)));
  if exists (select 1 from public.routes where routes.route_number = v_route_number) then
    raise exception 'This optimized preview has already been saved.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.profiles
    where profile_id = p_created_by
      and is_active = true
      and role in ('administrator', 'admin', 'dispatcher')
  ) then
    raise exception 'Active operational access is required.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.drivers d
    join public.profiles p on p.profile_id = d.user_id
    where d.driver_id = p_driver_id
      and p.is_active = true
      and p.role = 'driver'
      and coalesce(d.availability, 'available') not in ('unavailable', 'suspended')
  ) then
    raise exception 'The selected driver is no longer operationally eligible.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.vehicles
    where vehicle_id = p_vehicle_id
      and coalesce(status, 'available') not in ('inactive', 'out_of_service', 'maintenance', 'maintenance_due', 'inspection_hold', 'registration_issue', 'insurance_issue')
  ) then
    raise exception 'The selected vehicle is no longer operationally eligible.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.schedules
    where schedule_id = p_schedule_id
      and driver_id = p_driver_id
      and vehicle_id = p_vehicle_id
      and coalesce(status, 'scheduled') not in ('cancelled', 'conflict', 'completed')
      and (shift_date = p_route_date or (shift_date is null and start_time::date = p_route_date))
      and start_time = p_departure_time
      and end_time = p_shift_end_time
  ) then
    raise exception 'The selected schedule no longer matches this route setup.' using errcode = 'P0001';
  end if;

  select count(*) into v_stop_count from jsonb_array_elements(p_stops);
  if v_stop_count < 1 then
    raise exception 'At least one optimized stop is required.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_stops) as stop(delivery_id uuid, stop_sequence integer, original_sequence integer, estimated_arrival_time timestamptz, service_duration_seconds integer)
    where delivery_id is null or stop_sequence is null or stop_sequence < 1 or original_sequence is null or original_sequence < 1
      or service_duration_seconds is null or service_duration_seconds < 0
  ) or exists (
    select delivery_id
    from jsonb_to_recordset(p_stops) as stop(delivery_id uuid, stop_sequence integer, original_sequence integer, estimated_arrival_time timestamptz, service_duration_seconds integer)
    group by delivery_id having count(*) > 1
  ) or exists (
    select stop_sequence
    from jsonb_to_recordset(p_stops) as stop(delivery_id uuid, stop_sequence integer, original_sequence integer, estimated_arrival_time timestamptz, service_duration_seconds integer)
    group by stop_sequence having count(*) > 1
  ) then
    raise exception 'Optimized stop data is invalid.' using errcode = 'P0001';
  end if;

  -- Serialize eligibility checks for the selected deliveries. A concurrent save waits
  -- here and then sees the route assignment committed by the first transaction.
  perform 1
  from public.deliveries d
  join jsonb_to_recordset(p_stops) as stop(delivery_id uuid, stop_sequence integer, original_sequence integer, estimated_arrival_time timestamptz, service_duration_seconds integer)
    on stop.delivery_id = d.delivery_id
  order by d.delivery_id
  for update of d;

  if exists (
    select 1
    from jsonb_to_recordset(p_stops) as stop(delivery_id uuid, stop_sequence integer, original_sequence integer, estimated_arrival_time timestamptz, service_duration_seconds integer)
    left join public.deliveries d on d.delivery_id = stop.delivery_id
    where d.delivery_id is null
      or coalesce(d.status, 'pending') in ('delivered', 'cancelled', 'failed', 'returned')
      or d.delivery_latitude is null or d.delivery_longitude is null
      or exists (
        select 1
        from public.route_stops rs
        join public.routes r on r.route_id = rs.route_id
        where rs.delivery_id = stop.delivery_id
          and coalesce(r.status, 'legacy') not in ('completed', 'exception', 'cancelled')
      )
      or exists (
        select 1 from public.routes r
        where r.delivery_id = stop.delivery_id
          and coalesce(r.status, 'legacy') not in ('completed', 'exception', 'cancelled')
      )
  ) then
    raise exception 'One or more deliveries are no longer eligible for this route.' using errcode = 'P0001';
  end if;

  select d.customer_name, d.delivery_address, d.delivery_place_id, d.delivery_latitude, d.delivery_longitude
  into v_end_name, v_end_address, v_end_place_id, v_end_latitude, v_end_longitude
  from jsonb_to_recordset(p_stops) as stop(delivery_id uuid, stop_sequence integer, original_sequence integer, estimated_arrival_time timestamptz, service_duration_seconds integer)
  join public.deliveries d on d.delivery_id = stop.delivery_id
  order by stop.stop_sequence desc
  limit 1;

  if p_return_to_depot then
    v_end_name := coalesce(nullif(btrim(p_start_location_name), ''), p_start_address);
    v_end_address := p_start_address;
    v_end_place_id := nullif(btrim(p_start_place_id), '');
    v_end_latitude := p_start_latitude;
    v_end_longitude := p_start_longitude;
  end if;

  insert into public.routes (
    route_number, route_date, driver_id, vehicle_id, schedule_id,
    start_location_name, start_address, start_place_id, start_latitude, start_longitude,
    end_location_name, end_address, end_place_id, end_latitude, end_longitude, return_to_depot,
    departure_time, shift_end_time, estimated_completion_time, total_distance_meters,
    total_duration_seconds, encoded_polyline, optimization_status, optimized_at, status,
    created_by, updated_at, origin, destination, origin_name, origin_address, origin_latitude,
    origin_longitude, destination_name, destination_address, destination_latitude,
    destination_longitude, estimated_distance_km, estimated_duration_minutes, route_polyline,
    route_provider, route_generated_at
  ) values (
    v_route_number, p_route_date, p_driver_id, p_vehicle_id, p_schedule_id,
    nullif(btrim(p_start_location_name), ''), p_start_address, nullif(btrim(p_start_place_id), ''), p_start_latitude, p_start_longitude,
    v_end_name, v_end_address, v_end_place_id, v_end_latitude, v_end_longitude, p_return_to_depot,
    p_departure_time, p_shift_end_time, p_estimated_completion_time, p_total_distance_meters,
    p_total_duration_seconds, p_encoded_polyline, 'optimized', now(), 'planned',
    p_created_by, now(), p_start_address, v_end_address, nullif(btrim(p_start_location_name), ''), p_start_address, p_start_latitude,
    p_start_longitude, v_end_name, v_end_address, v_end_latitude,
    v_end_longitude, round(p_total_distance_meters::numeric / 1000, 3), ceil(p_total_duration_seconds::numeric / 60), p_encoded_polyline,
    'google_route_optimization', now()
  ) returning routes.route_id into v_route_id;

  insert into public.route_stops (
    route_id, delivery_id, stop_sequence, original_sequence, estimated_arrival_time,
    estimated_departure_time, service_duration_seconds, stop_status
  )
  select
    v_route_id, stop.delivery_id, stop.stop_sequence, stop.original_sequence, stop.estimated_arrival_time,
    case when stop.estimated_arrival_time is null then null else stop.estimated_arrival_time + make_interval(secs => stop.service_duration_seconds) end,
    stop.service_duration_seconds, 'pending'
  from jsonb_to_recordset(p_stops) as stop(delivery_id uuid, stop_sequence integer, original_sequence integer, estimated_arrival_time timestamptz, service_duration_seconds integer)
  order by stop.stop_sequence;

  update public.deliveries d
  set assigned_driver_id = p_driver_id,
      assigned_vehicle_id = p_vehicle_id,
      status = case when d.status = 'pending' then 'assigned' else d.status end,
      updated_at = now()
  from jsonb_to_recordset(p_stops) as stop(delivery_id uuid, stop_sequence integer, original_sequence integer, estimated_arrival_time timestamptz, service_duration_seconds integer)
  where d.delivery_id = stop.delivery_id;

  return query select v_route_id, v_route_number, 'planned'::text, v_stop_count, now();
end;
$$;

revoke all on function public.save_optimized_multi_stop_route(uuid, uuid, date, uuid, uuid, uuid, text, text, text, double precision, double precision, boolean, timestamptz, timestamptz, timestamptz, bigint, integer, text, jsonb, jsonb) from public;
grant execute on function public.save_optimized_multi_stop_route(uuid, uuid, date, uuid, uuid, uuid, text, text, text, double precision, double precision, boolean, timestamptz, timestamptz, timestamptz, bigint, integer, text, jsonb, jsonb) to service_role;
