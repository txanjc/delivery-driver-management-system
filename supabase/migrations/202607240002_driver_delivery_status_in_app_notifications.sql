-- Notify the driver and operations team in-app when a driver changes one of
-- their assigned delivery statuses from the mobile application.
create or replace function public.notify_driver_delivery_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  delivery_label text;
  status_label text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Avoid duplicating notifications created by the web operations workflow.
  if not exists (
    select 1
    from public.drivers
    where drivers.driver_id = new.assigned_driver_id
      and drivers.user_id = auth.uid()
  ) then
    return new;
  end if;

  delivery_label := coalesce(new.delivery_number, new.delivery_id::text);
  status_label := initcap(replace(coalesce(new.status::text, 'updated'), '_', ' '));

  insert into public.notifications (
    notification_id,
    user_id,
    notification_type,
    title,
    message,
    delivery_id,
    status
  )
  select
    gen_random_uuid(),
    recipients.profile_id,
    'delivery_status_update',
    format('Delivery %s marked %s', delivery_label, status_label),
    format('Delivery %s was updated to %s in the driver app.', delivery_label, status_label),
    new.delivery_id,
    'unresolved'
  from (
    select profiles.profile_id
    from public.profiles
    where profiles.is_active = true
      and profiles.role in ('administrator', 'admin', 'dispatcher')
    union
    select drivers.user_id
    from public.drivers
    where drivers.driver_id = new.assigned_driver_id
      and drivers.user_id is not null
  ) as recipients;

  return new;
end;
$$;

drop trigger if exists driver_delivery_status_in_app_notification on public.deliveries;
create trigger driver_delivery_status_in_app_notification
after update of status on public.deliveries
for each row
execute function public.notify_driver_delivery_status_change();
