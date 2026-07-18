import { supabase } from "@/lib/supabase";

function readError(body: unknown) {
  return typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
    ? body.error
    : "The server could not complete this request.";
}

export async function fetchAdministratorJson<T>(path: string, init?: RequestInit): Promise<T> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error("You must be signed in as an Administrator.");
  }

  const response = await fetch(path, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${data.session.access_token}` },
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("The server returned an unexpected response.");
  }

  const body: unknown = await response.json();
  if (!response.ok) throw new Error(readError(body));
  return body as T;
}
