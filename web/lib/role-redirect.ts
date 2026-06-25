export type WebUserRole = "admin" | "dispatcher" | "driver";

export function getRoleRedirectPath(role: WebUserRole) {
  if (role === "admin") {
    return "/admin";
  }

  if (role === "dispatcher") {
    return "/dispatcher";
  }

  return "/unauthorized";
}
