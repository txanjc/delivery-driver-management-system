import { authorizeAdministratorRequest } from "@/lib/server/administrator-api";
import { renderDeliverEazeEmail, type DeliverEazeEmail } from "@/lib/server/email-template";

const examples: Record<string, Omit<DeliverEazeEmail, "recipientName" | "recipientRole" | "actionUrl">> = {
  assignment: { title: "Delivery assigned to you", message: "A dispatcher assigned a new delivery to your shift.", tone: "blue", badge: "Assignment", reason: "the delivery is assigned to you", details: [{ label: "Delivery", value: "DEL-2048" }, { label: "Scheduled", value: "July 18, 2026, 09:00" }, { label: "Pickup", value: "120 Commerce Ave" }, { label: "Destination", value: "45 Market Street" }, { label: "Vehicle", value: "VAN-14" }, { label: "Priority", value: "High" }], actionLabel: "View delivery" },
  schedule: { title: "Your schedule was updated", message: "Your shift details have changed.", tone: "blue", badge: "Schedule updated", reason: "the updated shift is assigned to you", details: [{ label: "Shift date", value: "July 18, 2026" }, { label: "Time", value: "09:00 – 17:00" }, { label: "Vehicle", value: "VAN-14" }], actionLabel: "View schedule" },
  delayed: { title: "Delivery DEL-2048 is delayed", message: "This delivery needs dispatcher review.", tone: "orange", badge: "Delay", reason: "you are responsible for delivery operations", details: [{ label: "Driver", value: "Jordan Lee" }, { label: "Last status", value: "In transit, 10:12" }, { label: "ETA", value: "11:30" }, { label: "Reason", value: "Traffic congestion" }], actionLabel: "Review delivery" },
  failed: { title: "Delivery DEL-2048 failed", message: "Immediate operational review or reassignment may be needed.", tone: "red", badge: "Required action", reason: "this failed delivery needs operational resolution", details: [{ label: "Driver", value: "Jordan Lee" }, { label: "Vehicle", value: "VAN-14" }, { label: "Location", value: "45 Market Street" }, { label: "Reason", value: "Customer unavailable" }], actionLabel: "Review delivery" },
  completed: { title: "Delivery DEL-2048 completed", message: "The delivery was marked complete successfully.", tone: "green", badge: "Completed", reason: "you oversee this delivery", details: [{ label: "Completed", value: "July 18, 2026, 11:24" }, { label: "Proof of delivery", value: "Signature captured" }], actionLabel: "View delivery" },
  vehicle: { title: "Vehicle VAN-14 requires maintenance", message: "The vehicle is unavailable for assigned operations.", tone: "red", badge: "Vehicle warning", reason: "you oversee operational vehicle availability", details: [{ label: "Status", value: "Out of service" }, { label: "Affected driver", value: "Jordan Lee" }, { label: "Affected schedule", value: "Morning shift" }], actionLabel: "Review vehicle" },
  reassignment: { title: "Delivery DEL-2048 requires reassignment", message: "The assigned vehicle is unavailable.", tone: "red", badge: "Required action", reason: "you are responsible for delivery operations", details: [{ label: "Original driver", value: "Jordan Lee" }, { label: "Original vehicle", value: "VAN-14" }, { label: "Scheduled", value: "July 18, 2026, 09:00" }], actionLabel: "Reassign delivery" },
  account: { title: "Your DeliverEaze account is ready", message: "Your account was created. Use the secure password reset flow to finish setup.", tone: "grey", badge: "Account", reason: "this account was created for you", details: [{ label: "Role", value: "Driver" }], actionLabel: "Set up account" },
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
  const html = renderDeliverEazeEmail({ ...example, recipientName: "Alex Morgan", recipientRole: "Dispatcher", actionUrl: `${origin}/admin/deliveries?delivery=preview` }, `${origin}/images/brand/deliver-eaze-full.png`).html;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}
