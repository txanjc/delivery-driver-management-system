export type Delivery = {
  delivery_id: string;
  delivery_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  pickup_address: string | null;
  delivery_address: string | null;
  assigned_driver_id: string | null;
  assigned_vehicle_id: string | null;
  status: string | null;
  priority: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};
