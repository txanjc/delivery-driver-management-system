import { authorizeAdministratorRequest } from "@/lib/server/administrator-api";
import { renderDeliverEazeEmail, type DeliverEazeEmail } from "@/lib/server/email-template";

const examples: Record<string, Omit<DeliverEazeEmail, "recipientName" | "recipientRole" | "actionUrl">> = {
  assignment: { title: "Delivery DEL-2048 assigned to you", message: "A dispatcher assigned a new delivery to your shift.", tone: "blue", badge: "delivery_assignment", reason: "the delivery is assigned to you", details: [{ label: "delivery", value: "DEL-2048" }, { label: "scheduled shift", value: "Upcoming shift" }, { label: "pickup", value: "120 Commerce Ave" }, { label: "destination", value: "45 Market Street" }, { label: "vehicle", value: "VAN-14" }, { label: "priority", value: "high" }], actionLabel: "view_delivery" },
  schedule: { title: "Your schedule was updated", message: "Your shift details have changed.", tone: "blue", badge: "schedule_updated", reason: "the updated shift is assigned to you", details: [{ label: "shift date", value: "July 18, 2026" }, { label: "time", value: "09:00 – 17:00" }, { label: "vehicle", value: "VAN-14" }], actionLabel: "view_schedule" },
  delayed: { title: "Delivery DEL-2048 is delayed", message: "This delivery needs dispatcher review.", tone: "orange", badge: "delayed_delivery", reason: "you are responsible for delivery operations", details: [{ label: "driver", value: "Jordan Lee" }, { label: "last status", value: "in_transit" }, { label: "ETA", value: "11:30" }, { label: "reason", value: "Traffic congestion" }], actionLabel: "review_delivery" },
  failed: { title: "Delivery DEL-2048 failed", message: "Immediate operational review or reassignment may be needed.", tone: "red", badge: "failed_delivery", reason: "this failed delivery needs operational resolution", details: [{ label: "driver", value: "Jordan Lee" }, { label: "vehicle", value: "VAN-14" }, { label: "location", value: "45 Market Street" }, { label: "reason", value: "Customer unavailable" }], actionLabel: "review_delivery" },
  completed: { title: "Delivery DEL-2048 completed", message: "The delivery was marked complete successfully.", tone: "green", badge: "completed_delivery", reason: "you oversee this delivery", details: [{ label: "completed", value: "July 18, 2026, 11:24" }, { label: "proof of delivery", value: "Signature captured" }], actionLabel: "view_delivery" },
  vehicle: { title: "Vehicle VAN-14 requires maintenance", message: "The vehicle is unavailable for assigned operations.", tone: "red", badge: "vehicle_out_of_service", reason: "you oversee operational vehicle availability", details: [{ label: "status", value: "out_of_service" }, { label: "affected driver", value: "Jordan Lee" }, { label: "affected schedule", value: "Morning shift" }], actionLabel: "review_vehicle" },
  reassignment: { title: "Delivery DEL-2048 requires reassignment", message: "The assigned vehicle is unavailable.", tone: "red", badge: "reassignment_required", reason: "you are responsible for delivery operations", details: [{ label: "original driver", value: "Jordan Lee" }, { label: "original vehicle", value: "VAN-14" }, { label: "scheduled shift", value: "Upcoming shift" }], actionLabel: "reassign_delivery" },
  account: { title: "Your DeliverEaze account is ready", message: "Your account was created. Use the secure password reset flow to finish setup.", tone: "grey", badge: "account_creation", reason: "this account was created for you", details: [{ label: "role", value: "driver" }], actionLabel: "set_up_account" },
};

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  const type = new URL(request.url).searchParams.get("type") ?? "assignment";
  const example = examples[type];
  if (!example) return Response.json({ error: `Unknown preview type. Use: ${Object.keys(examples).join(", ")}.` }, { status: 400 });
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return Response.json({ error: "Application URL is not configured." }, { status: 500 });
  let origin: string;
  try { origin = new URL(appUrl).origin; } catch { return Response.json({ error: "Application URL is invalid." }, { status: 500 }); }
  const html = renderDeliverEazeEmail({ ...example, recipientName: "Alex Morgan", recipientRole: "dispatcher", actionUrl: `${origin}/admin/deliveries?delivery=preview` }, `${origin}/images/brand/deliver-eaze-full.png`).html;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
