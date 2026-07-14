import { createHash } from "node:crypto";

import { apiError, authorizeOperationsRequest } from "@/lib/server/administrator-api";
import {
  type OperationalAlert,
  type OperationalAlertModule,
  type OperationalAlertSeverity,
  sortOperationalAlerts,
} from "@/lib/operational-alerts";

type NotificationRow = {
  notification_id: string;
  user_id: string | null;
  notification_type: string | null;
  title: string | null;
  message: string | null;
  is_read: boolean | null;
  read_at: string | null;
  status: string | null;
  delivery_id: string | null;
  created_at: string | null;
};
type DeliveryRow = {
  delivery_id: string;
  delivery_number: string | null;
  customer_name: string | null;
  pickup_address: string | null;
  delivery_address: string | null;
  assigned_driver_id: string | null;
  assigned_vehicle_id: string | null;
  status: string | null;
  updated_at: string | null;
};
type RouteRow = { delivery_id: string | null; created_at: string | null };
type VehicleRow = {
  vehicle_id: string;
  vehicle_number: string | null;
  license_plate: string | null;
  make: string | null;
  model: string | null;
  status: string | null;
  updated_at: string | null;
};
type ScheduleRow = {
  schedule_id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  shift_name: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  updated_at?: string | null;
};
type DriverRow = { driver_id: string; user_id: string | null; availability: string | null };
type ProfileRow = { profile_id: string; first_name: string | null; last_name: string | null; email: string | null };

const operationalNotificationPrefix = "operational:";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeModule(type: string | null): OperationalAlertModule {
  const normalized = (type ?? "").toLowerCase();
  if (normalized.includes("driver")) return "drivers";
  if (normalized.includes("vehicle") || normalized.includes("maintenance")) return "vehicles";
  if (normalized.includes("schedule") || normalized.includes("shift")) return "schedules";
  if (normalized.includes("delivery")) return "deliveries";
  if (normalized.includes("route")) return "routes";
  return "system";
}

function severityFor(type: string | null, title: string | null, message: string | null): OperationalAlertSeverity {
  const text = `${type ?? ""} ${title ?? ""} ${message ?? ""}`.toLowerCase();
  if (/(fail|failed|error|expired|ineligible|critical|out_of_service)/.test(text)) return "error";
  if (/(warning|delayed|delay|conflict|maintenance|expires soon|unavailable|missing|required)/.test(text)) return "warning";
  if (/(success|completed|available|returned to service|delivered)/.test(text)) return "success";
  return "information";
}

function actionFor(module: OperationalAlertModule, relatedRecordId: string | null, deliveryId?: string | null) {
  if (module === "deliveries" && (relatedRecordId || deliveryId)) return { actionHref: `/admin/deliveries?delivery=${relatedRecordId ?? deliveryId}`, actionLabel: "Review delivery" };
  if (module === "routes" && (relatedRecordId || deliveryId)) return { actionHref: `/admin/routes?delivery=${relatedRecordId ?? deliveryId}`, actionLabel: "View route" };
  if (module === "vehicles" && relatedRecordId) return { actionHref: `/admin/vehicles?vehicle=${relatedRecordId}`, actionLabel: "Review vehicle" };
  if (module === "schedules" && relatedRecordId) return { actionHref: `/admin/schedules?schedule=${relatedRecordId}`, actionLabel: "Open schedule" };
  if (module === "drivers" && relatedRecordId) return { actionHref: `/admin/drivers?driver=${relatedRecordId}`, actionLabel: "Review driver" };
  return { actionHref: "/admin", actionLabel: "Review alert" };
}

function shortPlace(value: string | null) {
  return (value ?? "").split(",").map((part) => part.trim()).filter(Boolean)[0] || "Unknown";
}

function deliveryTitle(delivery: DeliveryRow) {
  return delivery.delivery_number ?? "Delivery";
}

function vehicleLabel(vehicle: VehicleRow) {
  return [vehicle.vehicle_number, [vehicle.make, vehicle.model].filter(Boolean).join(" ")].filter(Boolean).join(" - ") || vehicle.license_plate || "Vehicle";
}

function deliveryRecordLabel(delivery: DeliveryRow) {
  return delivery.delivery_number ?? delivery.delivery_id.slice(0, 8);
}

function vehicleRecordLabel(vehicle: VehicleRow) {
  return vehicle.vehicle_number ?? vehicle.license_plate ?? vehicle.vehicle_id.slice(0, 8);
}

function scheduleRecordLabel(schedule: ScheduleRow) {
  return schedule.shift_name ?? schedule.schedule_id.slice(0, 8);
}

function driverName(driverId: string | null, driverMap: Map<string, DriverRow>, profileMap: Map<string, ProfileRow>) {
  if (!driverId) return "Driver";
  const driver = driverMap.get(driverId);
  const profile = driver?.user_id ? profileMap.get(driver.user_id) : undefined;
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "Driver";
}

function scheduleConflict(left: ScheduleRow, right: ScheduleRow) {
  if (!left.start_time || !left.end_time || !right.start_time || !right.end_time) return false;
  const sharesResource = left.driver_id === right.driver_id || Boolean(left.vehicle_id && left.vehicle_id === right.vehicle_id);
  return sharesResource && new Date(left.start_time) < new Date(right.end_time) && new Date(right.start_time) < new Date(left.end_time);
}

function notificationToAlert(notification: NotificationRow, derivedAlertByType: Map<string, OperationalAlert>): OperationalAlert {
  const derived = notification.notification_type ? derivedAlertByType.get(notification.notification_type) : undefined;
  const alertModule = normalizeModule(`${notification.title ?? ""} ${notification.message ?? ""}`);
  const action = derived ?? actionFor(alertModule, notification.delivery_id, notification.delivery_id);
  return {
    ...action,
    createdAt: notification.created_at ?? new Date().toISOString(),
    id: `notification:${notification.notification_id}`,
    isResolved: ["resolved", "dismissed"].includes((notification.status ?? "").toLowerCase()),
    isUnread: notification.is_read !== true,
    message: notification.message ?? "No message provided.",
    module: derived?.module ?? alertModule,
    readAt: notification.is_read === true ? notification.read_at : null,
    relatedRecordId: derived?.relatedRecordId ?? notification.delivery_id,
    relatedRecordType: derived?.relatedRecordType ?? (notification.delivery_id ? "delivery" : null),
    resolvedAt: ["resolved", "dismissed"].includes((notification.status ?? "").toLowerCase()) ? notification.created_at : null,
    severity: derived?.severity ?? severityFor(notification.notification_type, notification.title, notification.message),
    title: notification.title ?? "Operational alert",
  };
}

function derivedAlert(input: Omit<OperationalAlert, "isResolved" | "isUnread" | "readAt" | "resolvedAt">): OperationalAlert {
  return { ...input, isResolved: false, isUnread: true, readAt: null, resolvedAt: null };
}

async function derivedBusinessAlerts(client: NonNullable<Awaited<ReturnType<typeof authorizeOperationsRequest>>["client"]>) {
  const [deliveriesResponse, routesResponse, vehiclesResponse, schedulesResponse, driversResponse] = await Promise.all([
    client.from("deliveries").select("delivery_id, delivery_number, customer_name, pickup_address, delivery_address, assigned_driver_id, assigned_vehicle_id, status, updated_at").order("updated_at", { ascending: false }),
    client.from("routes").select("delivery_id, created_at"),
    client.from("vehicles").select("vehicle_id, vehicle_number, license_plate, make, model, status, updated_at"),
    client.from("schedules").select("schedule_id, driver_id, vehicle_id, shift_name, start_time, end_time, status, updated_at").neq("status", "cancelled"),
    client.from("drivers").select("driver_id, user_id, availability"),
  ]);
  const error = deliveriesResponse.error ?? routesResponse.error ?? vehiclesResponse.error ?? schedulesResponse.error ?? driversResponse.error;
  if (error) throw new Error(error.message);

  const deliveries = (deliveriesResponse.data ?? []) as DeliveryRow[];
  const routes = (routesResponse.data ?? []) as RouteRow[];
  const vehicles = (vehiclesResponse.data ?? []) as VehicleRow[];
  const schedules = (schedulesResponse.data ?? []) as ScheduleRow[];
  const drivers = (driversResponse.data ?? []) as DriverRow[];
  const profileIds = drivers.map((driver) => driver.user_id).filter((id): id is string => Boolean(id));
  const profilesResponse = profileIds.length ? await client.from("profiles").select("profile_id, first_name, last_name, email").in("profile_id", profileIds) : { data: [], error: null };
  if (profilesResponse.error) throw new Error(profilesResponse.error.message);
  const routeDeliveryIds = new Set(routes.map((route) => route.delivery_id).filter(Boolean));
  const driverMap = new Map(drivers.map((driver) => [driver.driver_id, driver]));
  const profileMap = new Map(((profilesResponse.data ?? []) as ProfileRow[]).map((profile) => [profile.profile_id, profile]));
  const alerts: OperationalAlert[] = [];

  for (const delivery of deliveries) {
    const normalizedStatus = (delivery.status ?? "pending").toLowerCase();
    if (["delivered", "cancelled"].includes(normalizedStatus)) continue;
    const title = deliveryTitle(delivery);
    const createdAt = delivery.updated_at ?? new Date().toISOString();
    const routeSummary = `${shortPlace(delivery.pickup_address)} -> ${shortPlace(delivery.delivery_address)}`;
    const recordLabel = deliveryRecordLabel(delivery);
    if (!delivery.assigned_driver_id) alerts.push(derivedAlert({ ...actionFor("deliveries", delivery.delivery_id), createdAt, id: `delivery:${delivery.delivery_id}:missing-driver`, message: `${title} has no assigned driver.`, module: "deliveries", recordLabel, relatedRecordId: delivery.delivery_id, relatedRecordType: "delivery", severity: "warning", title: "Delivery requires a driver" }));
    if (!delivery.assigned_vehicle_id) alerts.push(derivedAlert({ ...actionFor("deliveries", delivery.delivery_id), createdAt, id: `delivery:${delivery.delivery_id}:missing-vehicle`, message: `${title} has no assigned vehicle.`, module: "deliveries", recordLabel, relatedRecordId: delivery.delivery_id, relatedRecordType: "delivery", severity: "warning", title: "Delivery requires a vehicle" }));
    if (!routeDeliveryIds.has(delivery.delivery_id)) alerts.push(derivedAlert({ ...actionFor("routes", delivery.delivery_id), createdAt, id: `delivery:${delivery.delivery_id}:missing-route`, message: `${title} does not have a generated route.`, module: "routes", recordLabel, relatedRecordId: delivery.delivery_id, relatedRecordType: "delivery", severity: "information", title: "Route not generated" }));
    if (["delayed", "failed", "returned"].includes(normalizedStatus)) alerts.push(derivedAlert({ ...actionFor("deliveries", delivery.delivery_id), createdAt, id: `delivery:${delivery.delivery_id}:${normalizedStatus}`, message: `${title} is ${normalizedStatus.replaceAll("_", " ")}. ${routeSummary}`, module: "deliveries", recordLabel, relatedRecordId: delivery.delivery_id, relatedRecordType: "delivery", severity: normalizedStatus === "delayed" ? "warning" : "error", title: `${title} ${normalizedStatus.replaceAll("_", " ")}` }));
  }

  for (const vehicle of vehicles) {
    if (!["maintenance_due", "out_of_service"].includes(vehicle.status ?? "")) continue;
    const severity: OperationalAlertSeverity = vehicle.status === "out_of_service" ? "error" : "warning";
    alerts.push(derivedAlert({ ...actionFor("vehicles", vehicle.vehicle_id), createdAt: vehicle.updated_at ?? new Date().toISOString(), id: `vehicle:${vehicle.vehicle_id}:${vehicle.status}`, message: `${vehicleLabel(vehicle)} is ${String(vehicle.status).replaceAll("_", " ")}.`, module: "vehicles", recordLabel: vehicleRecordLabel(vehicle), relatedRecordId: vehicle.vehicle_id, relatedRecordType: "vehicle", severity, title: vehicle.status === "out_of_service" ? "Vehicle out of service" : "Vehicle maintenance required" }));
  }

  for (let index = 0; index < schedules.length; index += 1) {
    const schedule = schedules[index];
    const conflicting = schedules.slice(index + 1).find((other) => scheduleConflict(schedule, other));
    if (!conflicting) continue;
    alerts.push(derivedAlert({ ...actionFor("schedules", schedule.schedule_id), createdAt: schedule.updated_at ?? schedule.start_time ?? new Date().toISOString(), id: `schedule:${schedule.schedule_id}:conflict`, message: `${driverName(schedule.driver_id, driverMap, profileMap)} has overlapping shifts.`, module: "schedules", recordLabel: scheduleRecordLabel(schedule), relatedRecordId: schedule.schedule_id, relatedRecordType: "schedule", severity: "error", title: "Schedule conflict" }));
  }

  return alerts;
}

function operationalNotificationType(alertId: string) {
  return `${operationalNotificationPrefix}${alertId}`;
}

function notificationIdFor(userId: string, alertId: string) {
  const hex = createHash("sha256").update(`${userId}:${alertId}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function syncOperationalNotifications(
  client: NonNullable<Awaited<ReturnType<typeof authorizeOperationsRequest>>["client"]>,
  userId: string,
  alerts: OperationalAlert[],
) {
  const { data: existing, error: existingError } = await client
    .from("notifications")
    .select("notification_id, notification_type")
    .eq("user_id", userId)
    .like("notification_type", `${operationalNotificationPrefix}%`);
  if (existingError) throw existingError;

  const currentIds = new Set(alerts.map((alert) => notificationIdFor(userId, alert.id)));
  const staleIds = (existing ?? [])
    .map((notification) => notification.notification_id as string)
    .filter((notificationId) => !currentIds.has(notificationId));

  if (alerts.length) {
    const { error } = await client.from("notifications").upsert(
      alerts.map((alert) => ({
        created_at: alert.createdAt,
        delivery_id: alert.relatedRecordType === "delivery" ? alert.relatedRecordId : null,
        message: alert.message,
        notification_id: notificationIdFor(userId, alert.id),
        notification_type: operationalNotificationType(alert.id),
        status: "unresolved",
        title: alert.title,
        user_id: userId,
      })),
      { onConflict: "notification_id" },
    );
    if (error) throw error;
  }

  if (staleIds.length) {
    const { error } = await client.from("notifications").update({ status: "resolved" }).in("notification_id", staleIds).eq("user_id", userId);
    if (error) throw error;
  }
}

function notificationFailure(error: unknown, message: string) {
  if (process.env.NODE_ENV === "development") console.error("Notification request failed:", error);
  return apiError(message, 500);
}

export async function GET(request: Request) {
  const authorization = await authorizeOperationsRequest(request);
  if (!authorization.client) return authorization.response;
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "50")));
  const status = url.searchParams.get("status") ?? "unresolved";
  const search = url.searchParams.get("search")?.trim().toLowerCase();

  try {
    const derivedAlerts = await derivedBusinessAlerts(authorization.client);
    await syncOperationalNotifications(authorization.client, authorization.userId, derivedAlerts);
    const { data, error } = await authorization.client
      .from("notifications")
      .select("notification_id, user_id, notification_type, title, message, is_read, read_at, status, delivery_id, created_at")
      .eq("user_id", authorization.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    const derivedAlertByType = new Map(derivedAlerts.map((alert) => [operationalNotificationType(alert.id), alert]));
    const allAlerts = ((data ?? []) as NotificationRow[]).map((notification) => notificationToAlert(notification, derivedAlertByType));
    let alerts = sortOperationalAlerts(allAlerts);
    if (status === "unread") alerts = alerts.filter((alert) => alert.isUnread);
    else if (status === "resolved") alerts = alerts.filter((alert) => alert.isResolved);
    else if (status === "action_required") alerts = alerts.filter((alert) => !alert.isResolved && Boolean(alert.actionHref));
    else if (status !== "all") alerts = alerts.filter((alert) => !alert.isResolved);
    if (search) alerts = alerts.filter((alert) => `${alert.title} ${alert.message} ${alert.module}`.toLowerCase().includes(search));
    const unresolvedCount = allAlerts.filter((alert) => !alert.isResolved).length;
    const unreadCount = allAlerts.filter((alert) => alert.isUnread).length;
    const limited = alerts.slice(0, limit);
    return Response.json({ alerts: limited, notifications: limited, unresolvedCount, unreadCount });
  } catch (caught) {
    return notificationFailure(caught, "Notifications could not be loaded.");
  }
}

export async function PATCH(request: Request) {
  const authorization = await authorizeOperationsRequest(request);
  if (!authorization.client) return authorization.response;
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) return apiError("Invalid notification update request.", 400);

  if (body.all === true) {
    const readAt = new Date().toISOString();
    const { error } = await authorization.client.from("notifications").update({ is_read: true, read_at: readAt }).eq("user_id", authorization.userId).eq("is_read", false);
    if (error) return notificationFailure(error, "Notifications could not be updated.");
    return Response.json({ message: "Alerts marked as read." });
  }

  const rawAlertId = typeof body.alert_id === "string" ? body.alert_id : typeof body.notification_id === "string" ? body.notification_id : "";
  const isRead = typeof body.is_read === "boolean" ? body.is_read : true;
  if (!rawAlertId) return apiError("Alert ID is required.", 400);
  const notificationId = rawAlertId.startsWith("notification:") ? rawAlertId.slice("notification:".length) : rawAlertId;
  const { error } = await authorization.client
    .from("notifications")
    .update({ is_read: isRead, read_at: isRead ? new Date().toISOString() : null })
    .eq("notification_id", notificationId)
    .eq("user_id", authorization.userId);
  if (error) return notificationFailure(error, "Notification could not be updated.");
  return Response.json({ message: isRead ? "Alert marked as read." : "Alert marked as unread." });
}
