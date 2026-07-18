create table if not exists public.notification_email_preferences (
  profile_id uuid not null references public.profiles(profile_id) on delete cascade,
  preference_key text not null check (preference_key in ('new_delivery_assigned', 'delivery_status_updates', 'schedule_changes', 'system_alerts', 'maintenance_reminders', 'security_alerts')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, preference_key)
);

alter table public.notifications drop constraint if exists notifications_email_status_check;
alter table public.notifications add constraint notifications_email_status_check
check (email_status is null or email_status in ('pending', 'sent', 'failed', 'skipped'));

alter table public.notification_email_preferences enable row level security;

drop policy if exists "Users can read own notification email preferences" on public.notification_email_preferences;
create policy "Users can read own notification email preferences"
on public.notification_email_preferences for select to authenticated
using (profile_id = auth.uid());

drop policy if exists "Users can create own notification email preferences" on public.notification_email_preferences;
create policy "Users can create own notification email preferences"
on public.notification_email_preferences for insert to authenticated
with check (profile_id = auth.uid());

drop policy if exists "Users can update own notification email preferences" on public.notification_email_preferences;
create policy "Users can update own notification email preferences"
on public.notification_email_preferences for update to authenticated
using (profile_id = auth.uid()) with check (profile_id = auth.uid());
