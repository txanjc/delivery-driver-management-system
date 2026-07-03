export const USER_ROLES = ["administrator", "dispatcher", "driver"] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type StoredUserRole = UserRole | "admin";

export function isAdministrator(role: string | null | undefined) {
  return role === "administrator" || role === "admin";
}

export function normalizeUserRole(role: string | null | undefined): UserRole {
  if (isAdministrator(role)) return "administrator";
  if (role === "dispatcher") return "dispatcher";
  return "driver";
}

export function getUserRoleLabel(role: UserRole) {
  if (role === "administrator") return "Administrator";
  return role === "dispatcher" ? "Dispatcher" : "Driver";
}
