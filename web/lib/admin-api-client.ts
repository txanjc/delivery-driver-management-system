import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

const tokenRefreshLeewayMs = 60_000;
const getResponseCacheTtlMs = 2_000;
const inFlightGetRequests = new Map<string, Promise<unknown>>();
const recentGetResponses = new Map<string, { expiresAt: number; value: unknown }>();
let pendingSessionRefresh: Promise<Session> | null = null;

function readError(body: unknown) {
  return typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
    ? body.error
    : "The server could not complete this request.";
}

async function getAdministratorSession(forceRefresh = false): Promise<Session> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    throw new Error("You must be signed in as an Administrator.");
  }

  const expiresSoon = !data.session.expires_at || data.session.expires_at * 1000 <= Date.now() + tokenRefreshLeewayMs;
  if (!forceRefresh && !expiresSoon) return data.session;

  if (!pendingSessionRefresh) {
    pendingSessionRefresh = supabase.auth.refreshSession().then(({ data: refreshedData, error: refreshError }) => {
      if (refreshError || !refreshedData.session) {
        throw new Error("Your Administrator session has expired. Please sign in again.");
      }
      return refreshedData.session;
    });
  }

  const refresh = pendingSessionRefresh;
  try {
    return await refresh;
  } finally {
    if (pendingSessionRefresh === refresh) pendingSessionRefresh = null;
  }
}

async function administratorFetch(path: string, init: RequestInit | undefined, session: Session) {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);

  return fetch(path, { ...init, headers });
}

function isReadOnlyRequest(init?: RequestInit) {
  return (init?.method ?? "GET").toUpperCase() === "GET";
}

async function requestAdministratorJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response = await administratorFetch(path, init, await getAdministratorSession());
  if (response.status === 401) {
    response = await administratorFetch(path, init, await getAdministratorSession(true));
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("The server returned an unexpected response.");
  }

  const body: unknown = await response.json();
  if (!response.ok) throw new Error(readError(body));
  return body as T;
}

export async function fetchAdministratorJson<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isReadOnlyRequest(init)) {
    const result = await requestAdministratorJson<T>(path, init);
    recentGetResponses.clear();
    return result;
  }

  const cached = recentGetResponses.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.value as T;

  const inFlight = inFlightGetRequests.get(path);
  if (inFlight) return inFlight as Promise<T>;

  const request = requestAdministratorJson<T>(path, init)
    .then((value) => {
      recentGetResponses.set(path, { expiresAt: Date.now() + getResponseCacheTtlMs, value });
      return value;
    })
    .finally(() => {
      inFlightGetRequests.delete(path);
    });

  inFlightGetRequests.set(path, request);
  return request;
}
