import { isAdministrator, type StoredUserRole } from "./roles";

export type WebUserRole = StoredUserRole;

export function getRoleRedirectPath(role: WebUserRole) {
  if (isAdministrator(role)) {
    return "/admin";
  }

  if (role === "dispatcher") {
    return "/dispatcher";
  }

  return "/unauthorized";
}
