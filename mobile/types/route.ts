export type Route = {
  route_id: string;
  delivery_id: string | null;
  origin_address: string | null;
  origin_latitude: number | null;
  origin_longitude: number | null;
  destination_address: string | null;
  destination_latitude: number | null;
  destination_longitude: number | null;
  estimated_distance_km: number | null;
  estimated_duration_minutes: number | null;
  maps_url: string | null;
};
