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
  purple: { accent: "#6d4aff", soft: "#f3efff" },
  blue: { accent: "#2563eb", soft: "#eaf2ff" },
  orange: { accent: "#c2410c", soft: "#fff0e6" },
  red: { accent: "#dc2626", soft: "#feecec" },
  green: { accent: "#15803d", soft: "#eaf8ef" },
  grey: { accent: "#475569", soft: "#eef2f7" },
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

/** Normalizes enum-like values and labels to readable sentence case. */
export function sentenceCase(value: string) {
  const normalized = value.trim().replace(/_/g, " ").replace(/\s+/g, " ");
  if (!normalized) return "";
  const words = normalized.split(" ").map((word) => {
    const lower = word.toLowerCase();
    if (lower === "delivereaze") return "DeliverEaze";
    if (lower === "gmail") return "Gmail";
    if (lower === "smtp") return "SMTP";
    return /[0-9]/.test(word) || /^[A-Z]{2,}$/.test(word) ? word : lower;
  });
  return `${words.join(" ").charAt(0).toUpperCase()}${words.join(" ").slice(1)}`;
}

/** Keeps human-entered detail values intact while normalizing enum-style values. */
export function formatEmailValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.toLowerCase() === "your active or upcoming scheduled shift") return "Active shift";
  return trimmed.includes("_") || /^[a-z]+(?:[ -][a-z]+)*$/.test(trimmed) ? sentenceCase(trimmed) : trimmed;
}

function detailHeading(email: DeliverEazeEmail) {
  const text = `${email.title} ${email.actionLabel}`.toLowerCase();
  if (text.includes("delivery") || text.includes("reassign")) return "Delivery details";
  if (text.includes("schedule") || text.includes("shift")) return "Schedule details";
  if (text.includes("vehicle")) return "Vehicle details";
  if (text.includes("route")) return "Route details";
  if (text.includes("account") || text.includes("role")) return "Account details";
  return "Notification details";
}

function detailRows(email: DeliverEazeEmail) {
  return email.details
    .filter((detail) => Boolean(detail.value?.trim()))
    .map((detail) => {
      const label = sentenceCase(detail.label);
      const value = formatEmailValue(detail.value?.trim() ?? "");
      return `<tr><td class="de-detail-label" style="width:35%;padding:7px 12px 7px 0;color:#64748b;font-size:12px;font-weight:600;line-height:18px;vertical-align:top;">${escapeHtml(label)}</td><td class="de-detail-value" style="padding:7px 0;color:#17232b;font-size:13px;font-weight:600;line-height:20px;vertical-align:top;word-break:break-word;">${escapeHtml(value)}</td></tr>`;
    })
    .join("");
}

export function renderDeliverEazeEmail(email: DeliverEazeEmail, logoUrl: string) {
  const colors = palette[email.tone];
  const heading = sentenceCase(email.title);
  const badge = sentenceCase(email.badge);
  const actionLabel = sentenceCase(email.actionLabel);
  const details = detailRows(email);
  const detailCard = details
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;"><tr><td style="padding:14px 16px 12px;"><p style="margin:0 0 5px;color:#475569;font-size:12px;font-weight:700;letter-spacing:0.02em;line-height:18px;">${escapeHtml(detailHeading(email))}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${details}</table></td></tr></table>`
    : "";
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0" /><style>@media only screen and (max-width:520px){.de-shell{padding:18px 10px!important}.de-content{padding:20px 20px 24px!important}.de-detail-label,.de-detail-value{display:block!important;width:100%!important;padding-left:0!important;padding-right:0!important}.de-action{display:block!important;width:100%!important;box-sizing:border-box!important;text-align:center!important}.de-footer{padding-left:20px!important;padding-right:20px!important}}</style></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#17232b;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background:#f1f5f9;"><tr><td class="de-shell" align="center" style="padding:24px 12px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;"><tr><td style="height:5px;background:${colors.accent};font-size:1px;line-height:1px;">&nbsp;</td></tr><tr><td style="padding:24px 28px 8px;"><img src="${escapeHtml(logoUrl)}" alt="DeliverEaze Logistics" width="132" style="display:block;width:132px;max-width:132px;height:auto;border:0;" /></td></tr><tr><td class="de-content" style="padding:10px 28px 26px;"><span style="display:inline-block;background:${colors.soft};border-radius:999px;color:${colors.accent};font-size:12px;font-weight:600;line-height:18px;padding:4px 9px;">${escapeHtml(badge)}</span><h1 style="margin:14px 0 10px;color:#17232b;font-size:30px;font-weight:700;line-height:36px;">${escapeHtml(heading)}</h1><p style="margin:0 0 12px;color:#17232b;font-size:15px;line-height:23px;">Hello ${escapeHtml(email.recipientName)},</p><p style="margin:0 0 12px;color:#475569;font-size:15px;line-height:23px;">${escapeHtml(email.message)}</p><p style="margin:0 0 18px;color:#64748b;font-size:13px;line-height:20px;">You received this because you are a ${escapeHtml(sentenceCase(email.recipientRole))} and ${escapeHtml(email.reason)}.</p>${detailCard}<a class="de-action" href="${escapeHtml(email.actionUrl)}" style="display:inline-block;background:#6d4aff;border-radius:8px;color:#ffffff;font-size:14px;font-weight:600;line-height:20px;padding:12px 18px;text-decoration:none;">${escapeHtml(actionLabel)}</a></td></tr><tr><td class="de-footer" style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:18px;">DeliverEaze Logistics<br />&copy; 2026 DeliverEaze Logistics</td></tr></table></td></tr></table></body></html>`;
  const textDetails = email.details.filter((detail) => Boolean(detail.value?.trim())).map((detail) => `${sentenceCase(detail.label)}: ${formatEmailValue(detail.value?.trim() ?? "")}`).join("\n");
  const text = `${heading}\n\nHello ${email.recipientName},\n\n${email.message}\n\nYou received this because you are a ${sentenceCase(email.recipientRole)} and ${email.reason}.${textDetails ? `\n\n${textDetails}` : ""}\n\n${actionLabel}: ${email.actionUrl}\n\nDeliverEaze Logistics\n© 2026 DeliverEaze Logistics`;
  return { html, text };
}
