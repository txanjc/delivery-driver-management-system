import type { Profile } from "@/types/driver";

export function getProfileInitials(profile: Profile | null) {
  const first = profile?.first_name?.trim().charAt(0) ?? "";
  const last = profile?.last_name?.trim().charAt(0) ?? "";
  const initials = `${first}${last}`.toUpperCase();

  if (initials) {
    return initials;
  }

  return profile?.email?.trim().charAt(0).toUpperCase() ?? "";
}
