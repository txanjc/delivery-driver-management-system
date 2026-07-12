import { supabase } from "@/lib/supabase";
import type { Delivery } from "@/types/delivery";

const deliverySelect =
  "delivery_id, delivery_number, customer_name, customer_phone, pickup_address, pickup_latitude, pickup_longitude, delivery_address, delivery_latitude, delivery_longitude, assigned_driver_id, assigned_vehicle_id, status, priority, notes, created_at, updated_at";

export async function getDeliveriesForDriver(driverId: string) {
  return supabase
    .from("deliveries")
    .select(deliverySelect)
    .eq("assigned_driver_id", driverId)
    .order("created_at", { ascending: false })
    .returns<Delivery[]>();
}

export async function getDelivery(deliveryId: string) {
  return supabase
    .from("deliveries")
    .select(deliverySelect)
    .eq("delivery_id", deliveryId)
    .maybeSingle<Delivery>();
}

export async function getDeliveryForDriver(deliveryId: string, driverId: string) {
  return supabase
    .from("deliveries")
    .select(deliverySelect)
    .eq("delivery_id", deliveryId)
    .eq("assigned_driver_id", driverId)
    .maybeSingle<Delivery>();
}
