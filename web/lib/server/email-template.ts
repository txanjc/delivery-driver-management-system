export type EmailTone = "purple" | "blue" | "orange" | "red" | "green" | "grey";

export type DeliverEazeEmail = {
  recipientName: string;
  recipientRole: string;
  title: string;
  message: string;
  tone: EmailTone;
  badge: string;
  reason: string;
  details: Array<{ label: string; value: string | null | undefined }>;
  actionLabel: string;
  actionUrl: string;
};

const palette: Record<EmailTone, { accent: string; soft: string }> = {
  purple: { accent: "#6d28d9", soft: "#f3e8ff" },
  blue: { accent: "#2563eb", soft: "#dbeafe" },
  orange: { accent: "#c2410c", soft: "#ffedd5" },
  red: { accent: "#dc2626", soft: "#fee2e2" },
  green: { accent: "#15803d", soft: "#dcfce7" },
  grey: { accent: "#475569", soft: "#e2e8f0" },
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

export function renderDeliverEazeEmail(email: DeliverEazeEmail, logoUrl: string) {
  const colors = palette[email.tone];
  const details = email.details.filter((detail) => Boolean(detail.value?.trim())).map((detail) => `<tr><td style="padding:8px 0;color:#64748b;font-size:13px;vertical-align:top;width:42%;">${escapeHtml(detail.label)}</td><td style="padding:8px 0;color:#17232b;font-size:13px;font-weight:600;vertical-align:top;">${escapeHtml(detail.value?.trim() ?? "")}</td></tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#17232b;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:28px 12px;"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:16px;overflow:hidden;"><tr><td style="height:6px;background:${colors.accent};font-size:1px;line-height:1px;">&nbsp;</td></tr><tr><td style="padding:28px 32px 12px;"><img src="${escapeHtml(logoUrl)}" alt="DeliverEaze Logistics" width="150" style="display:block;max-width:150px;height:auto;border:0;" /></td></tr><tr><td style="padding:12px 32px 30px;"><span style="display:inline-block;background:${colors.soft};color:${colors.accent};border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700;">${escapeHtml(email.badge)}</span><h1 style="margin:18px 0 10px;font-size:25px;line-height:32px;color:#17232b;">${escapeHtml(email.title)}</h1><p style="margin:0 0 16px;font-size:15px;line-height:24px;">Hello ${escapeHtml(email.recipientName)},</p><p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:24px;">${escapeHtml(email.message)}</p><p style="margin:0 0 20px;color:#64748b;font-size:13px;line-height:20px;">You received this because you are a ${escapeHtml(email.recipientRole)} and ${escapeHtml(email.reason)}</p>${details ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;margin:0 0 24px;">${details}</table>` : ""}<a href="${escapeHtml(email.actionUrl)}" style="display:inline-block;background:${colors.accent};border-radius:8px;color:#ffffff;font-size:14px;font-weight:700;line-height:20px;padding:12px 18px;text-decoration:none;">${escapeHtml(email.actionLabel)}</a></td></tr><tr><td style="padding:22px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:18px;">DeliverEaze Logistics<br />© 2026 DeliverEaze Logistics</td></tr></table></td></tr></table></body></html>`;
  const textDetails = email.details.filter((detail) => Boolean(detail.value?.trim())).map((detail) => `${detail.label}: ${detail.value?.trim()}`).join("\n");
  const text = `${email.title}\n\nHello ${email.recipientName},\n\n${email.message}\n\nYou received this because you are a ${email.recipientRole} and ${email.reason}.${textDetails ? `\n\n${textDetails}` : ""}\n\n${email.actionLabel}: ${email.actionUrl}\n\nDeliverEaze Logistics\n© 2026 DeliverEaze Logistics`;
  return { html, text };
}
