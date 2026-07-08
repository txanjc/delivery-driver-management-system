alter table deliveries
  add column if not exists pickup_place_id text,
  add column if not exists pickup_latitude double precision,
  add column if not exists pickup_longitude double precision,
  add column if not exists delivery_place_id text,
  add column if not exists delivery_latitude double precision,
  add column if not exists delivery_longitude double precision;

alter table deliveries
  add constraint deliveries_pickup_latitude_check
    check (pickup_latitude is null or (pickup_latitude >= '-90'::double precision and pickup_latitude <= '90'::double precision)),
  add constraint deliveries_pickup_longitude_check
    check (pickup_longitude is null or (pickup_longitude >= '-180'::double precision and pickup_longitude <= '180'::double precision)),
  add constraint deliveries_delivery_latitude_check
    check (delivery_latitude is null or (delivery_latitude >= '-90'::double precision and delivery_latitude <= '90'::double precision)),
  add constraint deliveries_delivery_longitude_check
    check (delivery_longitude is null or (delivery_longitude >= '-180'::double precision and delivery_longitude <= '180'::double precision));
