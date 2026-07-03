import { createClient } from "@supabase/supabase-js";

type UserRole = "admin" | "dispatcher" | "driver";

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
};

const validRoles: UserRole[] = ["admin", "dispatcher", "driver"];

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
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) return null;

  const accessToken = getBearerToken(request);
  if (!accessToken) return null;

  const requesterSupabase = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: requesterData, error: requesterError } =
    await requesterSupabase.auth.getUser(accessToken);
  if (requesterError || !requesterData.user) return null;

  const { data: adminProfile, error: profileError } = await requesterSupabase
    .from("profiles")
    .select("role, is_active")
    .eq("profile_id", requesterData.user.id)
    .maybeSingle<AdminProfile>();
  if (profileError || adminProfile?.role !== "admin" || adminProfile.is_active !== true) {
    return null;
  }

  return {
    adminSupabase: createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}

export async function GET(request: Request) {
  const clients = await createAuthorizedAdminClients(request);
  if (!clients) return jsonResponse({ error: "Active admin access is required." }, 403);

  const profileId = new URL(request.url).searchParams.get("profileId")?.trim();
  if (!profileId) return jsonResponse({ error: "User ID is required." }, 400);

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
  const clients = await createAuthorizedAdminClients(request);
  if (!clients) return jsonResponse({ error: "Active admin access is required." }, 403);

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
    return jsonResponse({ error: "Unable to verify admin access." }, 403);
  }

  if (adminProfile?.role !== "admin" || adminProfile.is_active !== true) {
    return jsonResponse({ error: "Only active admins may create users." }, 403);
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

  return jsonResponse(
    {
      message: "User created successfully.",
      profile: createdProfile,
    },
    201,
  );
}
