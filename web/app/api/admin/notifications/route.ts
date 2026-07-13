import { apiError, authorizeAdministratorRequest } from "@/lib/server/administrator-api";

type NotificationStatus = "sent" | "read";
type NotificationRow = {
  notification_id: string;
  user_id: string | null;
  delivery_id: string | null;
  notification_type: string | null;
  title: string | null;
  message: string | null;
  channel: string | null;
  status: string | null;
  sent_at: string | null;
  read_at: string | null;
  created_by: string | null;
  created_at: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeStatus(value: string | null): NotificationStatus {
  return value === "read" ? "read" : "sent";
}

export async function GET(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "50")));
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");
  const search = url.searchParams.get("search")?.trim();

  let query = authorization.client
    .from("notifications")
    .select("notification_id, user_id, delivery_id, notification_type, title, message, channel, status, sent_at, read_at, created_by, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status === "unread") query = query.is("read_at", null);
  if (type && type !== "all") query = query.eq("notification_type", type);
  if (search) query = query.or(`title.ilike.%${search}%,message.ilike.%${search}%,notification_type.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) return apiError(error.message, 400);
  const notifications = ((data ?? []) as NotificationRow[]).map((notification) => ({ ...notification, status: normalizeStatus(notification.status), unread: !notification.read_at }));
  const unreadCount = notifications.filter((notification) => notification.unread).length;
  return Response.json({ notifications, unreadCount });
}

export async function PATCH(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) return apiError("Invalid notification update request.", 400);
  const now = new Date().toISOString();

  if (body.all === true) {
    const { error } = await authorization.client.from("notifications").update({ read_at: now, status: "read" }).is("read_at", null);
    if (error) return apiError(error.message, 400);
    return Response.json({ message: "Notifications marked as read." });
  }

  const notificationId = typeof body.notification_id === "string" ? body.notification_id : "";
  if (!notificationId) return apiError("Notification ID is required.", 400);
  const { error } = await authorization.client.from("notifications").update({ read_at: now, status: "read" }).eq("notification_id", notificationId);
  if (error) return apiError(error.message, 400);
  return Response.json({ message: "Notification marked as read." });
}
