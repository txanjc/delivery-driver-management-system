import { supabase } from "@/lib/supabase";
import type { DriverNotification } from "@/types/notification";

export async function getRecentNotificationsForUser(userId: string, limit = 3) {
  return supabase
    .from("notifications")
    .select("notification_id, user_id, title, message, notification_type, status, delivery_id, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<DriverNotification[]>();
}

export async function getNotificationsForUser(userId: string, limit = 100) {
  return supabase
    .from("notifications")
    .select("notification_id, user_id, title, message, notification_type, status, delivery_id, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<DriverNotification[]>();
}

export async function markNotificationAsReadForUser(notificationId: string, userId: string) {
  return supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("notification_id", notificationId)
    .eq("user_id", userId)
    .select("notification_id, is_read")
    .maybeSingle<Pick<DriverNotification, "notification_id" | "is_read">>();
}

export async function markAllNotificationsAsReadForUser(userId: string) {
  return supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .or("is_read.is.false,is_read.is.null")
    .select("notification_id, is_read")
    .returns<Array<Pick<DriverNotification, "notification_id" | "is_read">>>();
}

export async function getUnreadNotificationCountForUser(userId: string) {
  return supabase
    .from("notifications")
    .select("notification_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .or("is_read.is.false,is_read.is.null");
}
