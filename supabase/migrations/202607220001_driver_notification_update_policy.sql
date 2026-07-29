-- Drivers can acknowledge only their own notification records.
drop policy if exists "Drivers can update own notifications" on public.notifications;
create policy "Drivers can update own notifications"
on public.notifications
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
