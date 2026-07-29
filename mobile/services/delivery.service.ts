import { supabase } from "@/lib/supabase";
import type { Delivery, DeliveryStatusHistory } from "@/types/delivery";

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

export async function getDeliveryStatusHistoryForDriver(deliveryId: string) {
  return supabase
    .from("delivery_status_history")
    .select("status_history_id, delivery_id, status, updated_by, notes, created_at, previous_status, new_status, location, updated_at")
    .eq("delivery_id", deliveryId)
    .order("created_at", { ascending: true })
    .returns<DeliveryStatusHistory[]>();
}

export async function updateDeliveryStatusForDriver({
  deliveryId,
  driverId,
  previousStatus,
  status,
  userId,
}: {
  deliveryId: string;
  driverId: string;
  previousStatus: string | null;
  status: string;
  userId: string;
}) {
  const updatedAt = new Date().toISOString();
  const deliveryResponse = await supabase
    .from("deliveries")
    .update({ status, updated_at: updatedAt })
    .eq("delivery_id", deliveryId)
    .eq("assigned_driver_id", driverId)
    .select(deliverySelect)
    .maybeSingle<Delivery>();

  if (deliveryResponse.error || !deliveryResponse.data) {
    return deliveryResponse;
  }

  const historyResponse = await supabase
    .from("delivery_status_history")
    .insert({ updated_by: userId, delivery_id: deliveryId, new_status: status, previous_status: previousStatus, status })
    .select("status_history_id, delivery_id, status, updated_by, notes, created_at, previous_status, new_status, location, updated_at")
    .maybeSingle<DeliveryStatusHistory>();

  return {
    data: deliveryResponse.data,
    error: historyResponse.error,
    history: historyResponse.data ?? null,
  };
}
