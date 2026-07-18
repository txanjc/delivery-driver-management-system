-- Email is an additional delivery channel for the existing notification record.
-- No new notification table is introduced: the bell and alerts continue to use
-- public.notifications as their source of truth.
alter table public.notifications
  add column if not exists email_status text,
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_error text,
  add column if not exists email_attempts integer not null default 0;

alter table public.notifications
  drop constraint if exists notifications_email_status_check;

alter table public.notifications
  add constraint notifications_email_status_check
  check (email_status is null or email_status in ('pending', 'sent', 'failed'));
