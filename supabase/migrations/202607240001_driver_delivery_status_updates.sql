-- Let drivers update only deliveries assigned to their own driver record.
drop policy if exists "Drivers can update assigned delivery status" on public.deliveries;
create policy "Drivers can update assigned delivery status"
on public.deliveries
for update
to authenticated
using (assigned_driver_id = public.current_driver_id())
with check (assigned_driver_id = public.current_driver_id());

alter table public.delivery_status_history enable row level security;

drop policy if exists "Drivers can read assigned delivery status history" on public.delivery_status_history;
create policy "Drivers can read assigned delivery status history"
on public.delivery_status_history
for select
to authenticated
using (
  exists (
    select 1
    from public.deliveries
    where deliveries.delivery_id = delivery_status_history.delivery_id
      and deliveries.assigned_driver_id = public.current_driver_id()
  )
);

drop policy if exists "Drivers can add assigned delivery status history" on public.delivery_status_history;
create policy "Drivers can add assigned delivery status history"
on public.delivery_status_history
for insert
to authenticated
with check (
  updated_by = auth.uid()
  and exists (
    select 1
    from public.deliveries
    where deliveries.delivery_id = delivery_status_history.delivery_id
      and deliveries.assigned_driver_id = public.current_driver_id()
  )
);
