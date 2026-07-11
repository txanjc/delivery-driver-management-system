import { supabase } from "@/lib/supabase";
import type { Schedule, VehicleSummary } from "@/types/schedule";

export async function getSchedulesForDriver(driverId: string) {
  return supabase
    .from("schedules")
    .select("schedule_id, driver_id, vehicle_id, shift_date, shift_type, shift_name, start_time, end_time, status, notes")
    .eq("driver_id", driverId)
    .neq("status", "cancelled")
    .order("start_time", { ascending: true })
    .returns<Schedule[]>();
}

export async function getDashboardSchedulesForDriver(driverId: string) {
  return supabase
    .from("schedules")
    .select("schedule_id, driver_id, vehicle_id, shift_date, shift_type, shift_name, start_time, end_time, status, notes")
    .eq("driver_id", driverId)
    .order("start_time", { ascending: true })
    .returns<Schedule[]>();
}

export async function getVehicle(vehicleId: string) {
  return supabase
    .from("vehicles")
    .select("vehicle_id, vehicle_number, license_plate, make, model, status")
    .eq("vehicle_id", vehicleId)
    .maybeSingle<VehicleSummary>();
}
