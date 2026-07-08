import { supabase } from "@/lib/supabase";
import type { Delivery } from "@/types/delivery";

export async function getDeliveriesForDriver(driverId: string) {
  return supabase
    .from("deliveries")
    .select("delivery_id, delivery_number, customer_name, customer_phone, pickup_address, delivery_address, assigned_driver_id, assigned_vehicle_id, status, priority, notes, created_at, updated_at")
    .eq("assigned_driver_id", driverId)
    .order("created_at", { ascending: false })
    .returns<Delivery[]>();
}

export async function getDelivery(deliveryId: string) {
  return supabase
    .from("deliveries")
    .select("delivery_id, delivery_number, customer_name, customer_phone, pickup_address, delivery_address, assigned_driver_id, assigned_vehicle_id, status, priority, notes, created_at, updated_at")
    .eq("delivery_id", deliveryId)
    .maybeSingle<Delivery>();
}
