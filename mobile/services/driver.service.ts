import { supabase } from "@/lib/supabase";
import type { Driver, Profile } from "@/types/driver";

export async function getProfileForUser(userId: string) {
  return supabase
    .from("profiles")
    .select("profile_id, first_name, last_name, email, phone, role, is_active")
    .eq("profile_id", userId)
    .maybeSingle<Profile>();
}

export async function getDriverForProfile(profileId: string) {
  return supabase
    .from("drivers")
    .select("driver_id, user_id, license_number, license_expiry_date, availability, performance_score, assigned_vehicle_id, created_at, updated_at")
    .eq("user_id", profileId)
    .maybeSingle<Driver>();
}
