-- Persist a single driver-captured proof of delivery for each completed delivery.
-- delivery_signatures already exists in the linked project. Its established actor
-- model is delivery ownership (not a driver_id column), and its recipient field
-- is signed_by_name.
create table if not exists public.delivery_signatures (
  signature_id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null unique references public.deliveries(delivery_id) on delete cascade,
  signed_by_name text not null,
  signature_image_url text,
  signed_at timestamptz not null default now(),
  delivery_photo_url text,
  location text,
  created_at timestamptz not null default now()
);

-- The mobile signature pad stores its stroke data directly as JSON. This avoids
-- treating a non-uploaded signature as an image URL while preserving the proof.
alter table public.delivery_signatures
add column if not exists signature_data jsonb;

alter table public.delivery_signatures
alter column signature_data set not null;

create unique index if not exists delivery_signatures_delivery_id_uidx
on public.delivery_signatures(delivery_id);

alter table public.delivery_signatures enable row level security;

grant select, insert on public.delivery_signatures to authenticated;

drop policy if exists "Drivers can read assigned delivery proofs" on public.delivery_signatures;
create policy "Drivers can read assigned delivery proofs"
on public.delivery_signatures
for select
to authenticated
using (
  exists (
    select 1
    from public.deliveries
    where deliveries.delivery_id = delivery_signatures.delivery_id
      and deliveries.assigned_driver_id = public.current_driver_id()
  )
);

drop policy if exists "Drivers can submit assigned delivery proofs" on public.delivery_signatures;
create policy "Drivers can submit assigned delivery proofs"
on public.delivery_signatures
for insert
to authenticated
with check (
  exists (
    select 1
    from public.deliveries
    where deliveries.delivery_id = delivery_signatures.delivery_id
      and deliveries.assigned_driver_id = public.current_driver_id()
      and deliveries.status = 'delivered'
  )
);

drop policy if exists "Authenticated users can view delivery signatures" on public.delivery_signatures;

drop policy if exists "Operations can read delivery proofs" on public.delivery_signatures;
create policy "Operations can read delivery proofs"
on public.delivery_signatures
for select
to authenticated
using (public.is_authenticated_admin() or public.is_authenticated_dispatcher());
