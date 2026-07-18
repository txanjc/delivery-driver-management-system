import { createClient } from "@supabase/supabase-js";
import {
  isAdministrator,
  USER_ROLES,
  type UserRole,
} from "@/lib/roles";
import { notifyOperationalEvent } from "@/lib/server/notification-service";

type CreateUserRequest = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  temporaryPassword: string;
};

type UpdateUserRequest = CreateUserRequest & {
  profileId: string;
};

type AdminProfile = {
  role: string | null;
  is_active: boolean | null;
};

type CreatedProfile = {
  profile_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_active: boolean | null;
  must_change_password: boolean | null;
  created_at: string | null;
  updated_at?: string | null;
};

const validRoles: UserRole[] = [...USER_ROLES];

function jsonResponse(
  body: {
    error?: string;
    message?: string;
    profile?: CreatedProfile;
  },
  status: number,
) {
  return Response.json(body, { status });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(body: Record<string, unknown>, key: string) {
  const value = body[key];

  return typeof value === "string" ? value.trim() : "";
}

function parseCreateUserRequest(body: unknown): CreateUserRequest | null {
  if (!isRecord(body)) {
    return null;
  }

  const role = readString(body, "role");
  const isActive = body.isActive;

  if (!validRoles.includes(role as UserRole)) {
    return null;
  }

  if (typeof isActive !== "boolean") {
    return null;
  }

  return {
    firstName: readString(body, "firstName"),
    lastName: readString(body, "lastName"),
    email: readString(body, "email").toLowerCase(),
    phone: readString(body, "phone"),
    role: role as UserRole,
    isActive,
    temporaryPassword: readString(body, "temporaryPassword"),
  };
}

function parseUpdateUserRequest(body: unknown): UpdateUserRequest | null {
  if (!isRecord(body)) return null;

  const role = readString(body, "role");
  if (!validRoles.includes(role as UserRole) || typeof body.isActive !== "boolean") {
    return null;
  }

  return {
    profileId: readString(body, "profileId"),
    firstName: readString(body, "firstName"),
    lastName: readString(body, "lastName"),
    email: readString(body, "email").toLowerCase(),
    phone: readString(body, "phone"),
    role: role as UserRole,
    isActive: body.isActive,
    temporaryPassword: readString(body, "temporaryPassword"),
  };
}

function getBearerToken(request: Request) {
  const authorizationHeader = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme.toLowerCase() !== "bearer" || !token) {
    return "";
  }

  return token;
}

async function createAuthorizedAdminClients(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return {
      clients: null,
      error: "Server Supabase configuration is missing.",
      status: 500 as const,
    };
  }

  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return { clients: null, error: "Authentication is required.", status: 401 as const };
  }

  const requesterSupabase = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: requesterData, error: requesterError } =
    await requesterSupabase.auth.getUser(accessToken);
  if (requesterError || !requesterData.user) {
    return { clients: null, error: "Authentication is required.", status: 401 as const };
  }

  const { data: adminProfile, error: profileError } = await requesterSupabase
    .from("profiles")
    .select("role, is_active")
    .eq("profile_id", requesterData.user.id)
    .maybeSingle<AdminProfile>();
  if (profileError || !isAdministrator(adminProfile?.role) || adminProfile?.is_active !== true) {
    return {
      clients: null,
      error: "Active Administrator access is required.",
      status: 403 as const,
    };
  }

  return {
    clients: {
      adminSupabase: createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      }),
    },
    error: null,
    status: 200 as const,
  };
}

export async function GET(request: Request) {
  const authorization = await createAuthorizedAdminClients(request);
  if (!authorization.clients) {
    return jsonResponse({ error: authorization.error }, authorization.status);
  }
  const { clients } = authorization;

  const profileId = new URL(request.url).searchParams.get("profileId")?.trim();
  if (!profileId) {
    const { data: profiles, error: profilesError } = await clients.adminSupabase
      .from("profiles")
      .select(
        "profile_id, first_name, last_name, email, phone, role, is_active, created_at, updated_at",
      )
      .order("created_at", { ascending: false });

    if (profilesError) {
      return jsonResponse({ error: profilesError.message }, 400);
    }

    return Response.json({ profiles: profiles ?? [] });
  }

  const { data, error } = await clients.adminSupabase.auth.admin.getUserById(profileId);
  if (error || !data.user) {
    return jsonResponse({ error: error?.message ?? "User was not found." }, 404);
  }

  return Response.json({
    authDetails: {
      createdAt: data.user.created_at,
      updatedAt: data.user.updated_at ?? null,
      lastLoginAt: data.user.last_sign_in_at ?? null,
    },
  });
}

export async function PATCH(request: Request) {
  const authorization = await createAuthorizedAdminClients(request);
  if (!authorization.clients) {
    return jsonResponse({ error: authorization.error }, authorization.status);
  }
  const { clients } = authorization;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  const userRequest = parseUpdateUserRequest(body);
  if (!userRequest?.profileId || !userRequest.email) {
    return jsonResponse({ error: "A user ID and email are required." }, 400);
  }

  if (userRequest.temporaryPassword && userRequest.temporaryPassword.length < 8) {
    return jsonResponse(
      { error: "Temporary password must be at least 8 characters." },
      400,
    );
  }

  const { data: previousProfile, error: previousProfileError } = await clients.adminSupabase
    .from("profiles")
    .select("role, is_active")
    .eq("profile_id", userRequest.profileId)
    .maybeSingle<{ role: string | null; is_active: boolean | null }>();
  if (previousProfileError || !previousProfile) return jsonResponse({ error: previousProfileError?.message ?? "User profile was not found." }, 404);

  const { error: authError } = await clients.adminSupabase.auth.admin.updateUserById(
    userRequest.profileId,
    {
      email: userRequest.email,
      ...(userRequest.temporaryPassword
        ? { password: userRequest.temporaryPassword }
        : {}),
      user_metadata: {
        first_name: userRequest.firstName,
        last_name: userRequest.lastName,
        role: userRequest.role,
      },
    },
  );
  if (authError) return jsonResponse({ error: authError.message }, 400);

  const { error: profileError } = await clients.adminSupabase
    .from("profiles")
    .update({
      first_name: userRequest.firstName || null,
      last_name: userRequest.lastName || null,
      email: userRequest.email,
      phone: userRequest.phone || null,
      role: userRequest.role,
      is_active: userRequest.isActive,
      ...(userRequest.temporaryPassword ? { must_change_password: true } : {}),
    })
    .eq("profile_id", userRequest.profileId);
  if (profileError) return jsonResponse({ error: profileError.message }, 400);

  if (previousProfile.role !== userRequest.role || previousProfile.is_active !== userRequest.isActive) void notifyOperationalEvent(clients.adminSupabase, {
    type: "account_updated", key: `account:${userRequest.profileId}:${userRequest.role}:${userRequest.isActive}`, title: userRequest.isActive ? "Your DeliverEaze account was updated" : "Your DeliverEaze account was deactivated", message: userRequest.isActive ? `Your role is now ${userRequest.role}.` : "Your account is no longer active. Contact an Administrator if you need access.", tone: "grey", badge: userRequest.isActive ? "Account updated" : "Account deactivated", module: "system", relatedId: userRequest.profileId, actionPath: "/login", actionLabel: "Open DeliverEaze", recipientIds: [userRequest.profileId], details: [{ label: "Role", value: userRequest.role }, { label: "Account status", value: userRequest.isActive ? "Active" : "Deactivated" }],
  });

  const { data } = await clients.adminSupabase.auth.admin.getUserById(userRequest.profileId);
  return Response.json({
    message: "User updated successfully.",
    authDetails: {
      createdAt: data.user?.created_at ?? null,
      updatedAt: data.user?.updated_at ?? null,
      lastLoginAt: data.user?.last_sign_in_at ?? null,
    },
  });
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return jsonResponse(
      { error: "Server Supabase configuration is missing." },
      500,
    );
  }

  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return jsonResponse({ error: "Authentication is required." }, 401);
  }

  const requesterSupabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });

  const { data: requesterData, error: requesterError } =
    await requesterSupabase.auth.getUser(accessToken);

  if (requesterError || !requesterData.user) {
    return jsonResponse({ error: "Authentication is required." }, 401);
  }

  const { data: adminProfile, error: profileError } = await requesterSupabase
    .from("profiles")
    .select("role, is_active")
    .eq("profile_id", requesterData.user.id)
    .maybeSingle<AdminProfile>();

  if (profileError) {
    return jsonResponse({ error: "Unable to verify Administrator access." }, 403);
  }

  if (!isAdministrator(adminProfile?.role) || adminProfile?.is_active !== true) {
    return jsonResponse({ error: "Only active Administrators may create users." }, 403);
  }

  let requestBody: unknown;

  try {
    requestBody = await request.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON." }, 400);
  }

  const userRequest = parseCreateUserRequest(requestBody);

  if (!userRequest) {
    return jsonResponse({ error: "Invalid user creation request." }, 400);
  }

  if (!userRequest.email) {
    return jsonResponse({ error: "Email is required." }, 400);
  }

  if (userRequest.temporaryPassword.length < 8) {
    return jsonResponse(
      { error: "Temporary password must be at least 8 characters." },
      400,
    );
  }

  // Server-only privileged client. Never import or expose this key in browser code.
  const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: authUserData, error: authUserError } =
    await adminSupabase.auth.admin.createUser({
      email: userRequest.email,
      password: userRequest.temporaryPassword,
      email_confirm: true,
      user_metadata: {
        first_name: userRequest.firstName,
        last_name: userRequest.lastName,
        role: userRequest.role,
      },
    });

  if (authUserError || !authUserData.user) {
    return jsonResponse(
      { error: authUserError?.message ?? "Unable to create auth user." },
      400,
    );
  }

  const profilePayload = {
    profile_id: authUserData.user.id,
    first_name: userRequest.firstName || null,
    last_name: userRequest.lastName || null,
    email: userRequest.email,
    phone: userRequest.phone || null,
    role: userRequest.role,
    is_active: userRequest.isActive,
    must_change_password: true,
  };

  const { error: insertProfileError } = await adminSupabase
    .from("profiles")
    .insert(profilePayload);

  if (insertProfileError) {
    const { error: deleteUserError } = await adminSupabase.auth.admin.deleteUser(
      authUserData.user.id,
    );

    const cleanupMessage = deleteUserError
      ? ` Auth cleanup also failed for ${authUserData.user.id}: ${deleteUserError.message}`
      : "";

    return jsonResponse(
      {
        error: `Auth user was created, but profile creation failed for ${authUserData.user.id}: ${
          insertProfileError.message
        }${cleanupMessage}`,
      },
      400,
    );
  }

  const { data: createdProfile, error: verifyProfileError } =
    await adminSupabase
      .from("profiles")
      .select(
        "profile_id, first_name, last_name, email, phone, role, is_active, must_change_password, created_at",
      )
      .eq("profile_id", authUserData.user.id)
      .single<CreatedProfile>();

  if (verifyProfileError || !createdProfile) {
    const { error: deleteUserError } = await adminSupabase.auth.admin.deleteUser(
      authUserData.user.id,
    );

    const cleanupMessage = deleteUserError
      ? ` Auth cleanup also failed for ${authUserData.user.id}: ${deleteUserError.message}`
      : "";

    return jsonResponse(
      {
        error: `Auth user was created and profile insert was attempted, but no matching profile was found for ${authUserData.user.id}: ${
          verifyProfileError?.message ?? "No profile row was returned."
        }${cleanupMessage}`,
      },
      400,
    );
  }

  void notifyOperationalEvent(adminSupabase, {
    type: "account_created", key: `account:${createdProfile.profile_id}:created`, title: "Your DeliverEaze account is ready", message: "An Administrator created your account. Sign in with the credentials provided to you, then complete the required password change.", tone: "grey", badge: "Account created", module: "system", relatedId: createdProfile.profile_id, actionPath: "/login", actionLabel: "Sign in to DeliverEaze", recipientIds: [createdProfile.profile_id], details: [{ label: "Role", value: createdProfile.role }, { label: "Account status", value: createdProfile.is_active ? "Active" : "Inactive" }],
  });

  return jsonResponse(
    {
      message: "User created successfully.",
      profile: createdProfile,
    },
    201,
  );
}
