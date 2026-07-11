import { supabase } from "@/lib/supabase";
import type { DriverNotification } from "@/types/notification";

export async function getRecentNotificationsForUser(userId: string, limit = 3) {
  return supabase
    .from("notifications")
    .select("notification_id, user_id, title, message, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<DriverNotification[]>();
}

export async function getUnreadNotificationCountForUser(userId: string) {
  return supabase
    .from("notifications")
    .select("notification_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .or("is_read.is.false,is_read.is.null");
}
