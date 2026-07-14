export type OperationalAlertModule = "drivers" | "vehicles" | "schedules" | "deliveries" | "routes" | "system";
export type OperationalAlertSeverity = "information" | "warning" | "error" | "success";
export type OperationalAlertStatus = "all" | "unread" | "action_required" | "unresolved" | "in_review" | "resolved" | "dismissed";

export type OperationalAlert = {
  id: string;
  module: OperationalAlertModule;
  severity: OperationalAlertSeverity;
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  resolvedAt: string | null;
  isUnread: boolean;
  isResolved: boolean;
  relatedRecordId: string | null;
  relatedRecordType: string | null;
  recordLabel?: string | null;
  actionLabel: string | null;
  actionHref: string | null;
};

export type OperationalAlertsResponse = {
  alerts: OperationalAlert[];
  notifications: OperationalAlert[];
  unresolvedCount: number;
  unreadCount: number;
};

const severityRank: Record<OperationalAlertSeverity, number> = {
  error: 0,
  warning: 1,
  information: 2,
  success: 3,
};

export function sortOperationalAlerts(alerts: OperationalAlert[]) {
  return [...alerts].sort((left, right) => {
    const severity = severityRank[left.severity] - severityRank[right.severity];
    if (severity !== 0) return severity;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

export function moduleLabel(module: OperationalAlertModule) {
  if (module === "drivers") return "Drivers";
  if (module === "vehicles") return "Vehicles";
  if (module === "schedules") return "Schedules";
  if (module === "deliveries") return "Deliveries";
  if (module === "routes") return "Routes";
  return "System";
}

export function severityLabel(severity: OperationalAlertSeverity) {
  if (severity === "error") return "Error";
  if (severity === "warning") return "Warning";
  if (severity === "success") return "Success";
  return "Information";
}

export function alertMatchesStatus(alert: OperationalAlert, status: OperationalAlertStatus) {
  if (status === "all") return true;
  if (status === "unread") return alert.isUnread;
  if (status === "action_required") return !alert.isResolved && Boolean(alert.actionHref);
  if (status === "unresolved") return !alert.isResolved;
  if (status === "in_review") return false;
  if (status === "dismissed") return false;
  return alert.isResolved;
}
