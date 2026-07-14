import { createClient } from "@supabase/supabase-js";

import { isAdministrator } from "@/lib/roles";

type AdministratorProfile = {
  role: string | null;
  is_active: boolean | null;
};

export function apiError(error: string, status: number) {
  return Response.json({ error }, { status });
}

export async function authorizeAdministratorRequest(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return {
      client: null,
      response: apiError("Server Supabase configuration is missing.", 500),
    };
  }

  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, accessToken] = authorization.split(" ");
  if (scheme.toLowerCase() !== "bearer" || !accessToken) {
    return { client: null, response: apiError("Authentication is required.", 401) };
  }

  const requesterClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: userError } =
    await requesterClient.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return { client: null, response: apiError("Authentication is required.", 401) };
  }

  const { data: profile, error: profileError } = await requesterClient
    .from("profiles")
    .select("role, is_active")
    .eq("profile_id", userData.user.id)
    .maybeSingle<AdministratorProfile>();

  if (profileError || !isAdministrator(profile?.role) || profile?.is_active !== true) {
    return {
      client: null,
      response: apiError("Active Administrator access is required.", 403),
    };
  }

  return {
    client: createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    userId: userData.user.id,
    role: profile.role,
    response: null,
  };
}

export async function authorizeOperationsRequest(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return {
      client: null,
      response: apiError("Server Supabase configuration is missing.", 500),
    };
  }

  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, accessToken] = authorization.split(" ");
  if (scheme.toLowerCase() !== "bearer" || !accessToken) {
    return { client: null, response: apiError("Authentication is required.", 401) };
  }

  const requesterClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: userData, error: userError } =
    await requesterClient.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return { client: null, response: apiError("Authentication is required.", 401) };
  }

  const { data: profile, error: profileError } = await requesterClient
    .from("profiles")
    .select("role, is_active")
    .eq("profile_id", userData.user.id)
    .maybeSingle<AdministratorProfile>();

  const role = profile?.role;
  const canUseOperationsAlerts = isAdministrator(role) || role === "dispatcher";
  if (profileError || !canUseOperationsAlerts || profile?.is_active !== true) {
    return {
      client: null,
      response: apiError("Active Administrator or Dispatcher access is required.", 403),
    };
  }

  return {
    client: createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    userId: userData.user.id,
    role,
    response: null,
  };
}
