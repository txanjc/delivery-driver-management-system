"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  AdminCard,
  AdminPageIntro,
  PrimaryActionButton,
} from "../_components/admin-design-system";
import { supabase } from "@/lib/supabase";
import { DEFAULT_PAGE_SIZE, Pagination } from "../_components/Pagination";

type UserRole = "admin" | "dispatcher" | "driver";

type ProfileRow = {
  profile_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

type UserRecord = {
  profileId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string | null;
};

type UserFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  temporaryPassword: string;
};

type UserPayload = {
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
};

const emptyUserForm: UserFormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  role: "driver",
  isActive: true,
  temporaryPassword: "",
};

const roleOptions: UserRole[] = ["admin", "dispatcher", "driver"];

function toUserRole(role: string | null): UserRole {
  const normalizedRole = role?.trim().toLowerCase();

  if (
    normalizedRole === "admin" ||
    normalizedRole === "dispatcher" ||
    normalizedRole === "driver"
  ) {
    return normalizedRole;
  }

  return "driver";
}

function toUserRecord(profile: ProfileRow): UserRecord {
  return {
    profileId: profile.profile_id,
    firstName: profile.first_name ?? "",
    lastName: profile.last_name ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    role: toUserRole(profile.role),
    isActive: profile.is_active ?? false,
    createdAt: profile.created_at,
  };
}

function toUserForm(user: UserRecord): UserFormState {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    temporaryPassword: "",
  };
}

function toUserPayload(formState: UserFormState): UserPayload {
  return {
    first_name: formState.firstName.trim() || null,
    last_name: formState.lastName.trim() || null,
    email: formState.email.trim(),
    phone: formState.phone.trim() || null,
    role: formState.role,
    is_active: formState.isActive,
  };
}

function getUserName(user: UserRecord) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return name || "Unnamed user";
}

function formatRole(role: UserRole) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatCreatedDate(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function readApiError(responseBody: unknown) {
  if (
    typeof responseBody === "object" &&
    responseBody !== null &&
    "error" in responseBody &&
    typeof responseBody.error === "string"
  ) {
    return responseBody.error;
  }

  return "Unable to create user.";
}

function UserKpiCard({
  label,
  value,
  detail,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[20px] border p-5 shadow-sm ${
        accent
          ? "border-[#172f3a] bg-[#172f3a] text-white"
          : "border-slate-100 bg-white text-[#17232b]"
      }`}
    >
      <p className={accent ? "text-xs text-slate-300" : "text-xs text-slate-500"}>{label}</p>
      <p className="mt-4 text-3xl font-semibold tracking-[-0.03em]">{value}</p>
      <p className={accent ? "mt-1 text-xs text-slate-400" : "mt-1 text-xs text-slate-400"}>{detail}</p>
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const tone =
    role === "admin"
      ? "bg-purple-50 text-purple-700"
      : role === "dispatcher"
        ? "bg-blue-50 text-blue-700"
        : "bg-amber-50 text-amber-700";

  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
      {formatRole(role)}
    </span>
  );
}

function UserStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        isActive
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function UserModal({
  formState,
  isSaving,
  mode,
  onChange,
  onClose,
  onSubmit,
}: {
  formState: UserFormState;
  isSaving: boolean;
  mode: "create" | "edit";
  onChange: (field: keyof UserFormState, value: string | boolean) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isCreateMode = mode === "create";

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[20px] border border-slate-100 bg-white p-6 text-[#17232b] shadow-2xl shadow-slate-900/20">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xl font-semibold">
              {isCreateMode ? "Create User" : "Edit User"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Create and maintain profile records for admin portal workflows.
            </p>
          </div>
          <button
            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-500 transition hover:bg-slate-100"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <form className="mt-5 space-y-5" onSubmit={onSubmit}>
          <div className="rounded-2xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm text-purple-700">
            Authentication account creation is handled by a secure server-side
            flow.
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-600">
                First Name
              </span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100"
                onChange={(event) => onChange("firstName", event.target.value)}
                value={formState.firstName}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">
                Last Name
              </span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100"
                onChange={(event) => onChange("lastName", event.target.value)}
                value={formState.lastName}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Email</span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!isCreateMode}
                onChange={(event) => onChange("email", event.target.value)}
                required
                type="email"
                value={formState.email}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Phone</span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100"
                onChange={(event) => onChange("phone", event.target.value)}
                value={formState.phone}
              />
            </label>
            {isCreateMode ? (
              <label className="block md:col-span-2">
                <span className="text-sm font-medium text-slate-600">
                  Temporary Password
                </span>
                <input
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100"
                  minLength={8}
                  onChange={(event) =>
                    onChange("temporaryPassword", event.target.value)
                  }
                  required
                  type="password"
                  value={formState.temporaryPassword}
                />
              </label>
            ) : null}
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Role</span>
              <select
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100"
                onChange={(event) => onChange("role", event.target.value)}
                value={formState.role}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {formatRole(role)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">
                Active Status
              </span>
              <select
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100"
                onChange={(event) =>
                  onChange("isActive", event.target.value === "active")
                }
                value={formState.isActive ? "active" : "inactive"}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button
              className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              disabled={isSaving}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <PrimaryActionButton
              disabled={isSaving}
              type="submit"
            >
              {isSaving
                ? "Saving..."
                : isCreateMode
                  ? "Create User"
                  : "Save Changes"}
            </PrimaryActionButton>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [formState, setFormState] = useState<UserFormState>(emptyUserForm);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (searchParams.get("action") !== "create") return;
    const timeoutId = window.setTimeout(() => setIsModalOpen(true), 0);
    return () => window.clearTimeout(timeoutId);
  }, [searchParams]);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "profile_id, first_name, last_name, email, phone, role, is_active, created_at",
      )
      .order("created_at", { ascending: false })
      .returns<ProfileRow[]>();

    if (error) {
      setErrorMessage(`Unable to load user profiles: ${error.message}`);
      setUsers([]);
      setIsLoading(false);
      return false;
    }

    setUsers((data ?? []).map(toUserRecord));
    setIsLoading(false);
    return true;
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadUsers();
    });
  }, [loadUsers]);

  const userStats = useMemo(() => {
    return {
      active: users.filter((user) => user.isActive).length,
      admins: users.filter((user) => user.role === "admin").length,
      dispatchers: users.filter((user) => user.role === "dispatcher").length,
      drivers: users.filter((user) => user.role === "driver").length,
    };
  }, [users]);

  const totalPages = Math.max(1, Math.ceil(users.length / DEFAULT_PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedUsers = users.slice(
    (activePage - 1) * DEFAULT_PAGE_SIZE,
    activePage * DEFAULT_PAGE_SIZE,
  );

  function openCreateModal() {
    setEditingUser(null);
    setFormState(emptyUserForm);
    setErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
  }

  function openEditModal(user: UserRecord) {
    setEditingUser(user);
    setFormState(toUserForm(user));
    setErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSaving) {
      return;
    }

    setIsModalOpen(false);
    setEditingUser(null);
    setFormState(emptyUserForm);
  }

  function updateFormState(field: keyof UserFormState, value: string | boolean) {
    setFormState((currentFormState) => ({
      ...currentFormState,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const payload = toUserPayload(formState);

    if (!payload.email) {
      setErrorMessage("Email is required.");
      setIsSaving(false);
      return;
    }

    if (editingUser) {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: payload.first_name,
          last_name: payload.last_name,
          phone: payload.phone,
          role: payload.role,
          is_active: payload.is_active,
        })
        .eq("profile_id", editingUser.profileId);

      if (error) {
        setErrorMessage(error.message);
        setIsSaving(false);
        return;
      }
    } else {
      if (formState.temporaryPassword.length < 8) {
        setErrorMessage("Temporary password must be at least 8 characters.");
        setIsSaving(false);
        return;
      }

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData.session) {
        setErrorMessage("You must be signed in as an admin to create users.");
        setIsSaving(false);
        return;
      }

      const response = await fetch("/api/admin/users", {
        body: JSON.stringify({
          firstName: formState.firstName,
          lastName: formState.lastName,
          email: formState.email,
          phone: formState.phone,
          role: formState.role,
          isActive: formState.isActive,
          temporaryPassword: formState.temporaryPassword,
        }),
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const responseBody: unknown = await response.json();

      if (!response.ok) {
        setErrorMessage(readApiError(responseBody));
        setIsSaving(false);
        return;
      }
    }

    const didLoadUsers = await loadUsers();

    if (!didLoadUsers) {
      setIsSaving(false);
      return;
    }

    setSuccessMessage(
      editingUser
        ? "User profile updated successfully."
        : "User profile created successfully.",
    );
    setIsSaving(false);
    setIsModalOpen(false);
    setEditingUser(null);
    setFormState(emptyUserForm);
  }

  return (
    <section className="space-y-4 text-[#17232b]">
      <AdminPageIntro
        actions={
          <PrimaryActionButton onClick={openCreateModal} type="button">
            + Create user
          </PrimaryActionButton>
        }
        description={
          "Manage operational profile records, user roles, contact details, and active status for the admin and dispatch workflows."
        }
        eyebrow="Access operations"
        title="Users"
      />

      <div className="rounded-2xl border border-purple-100 bg-purple-50 px-5 py-4 text-sm text-purple-700">
        Authentication account creation is handled by a secure server-side
        flow.
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <UserKpiCard
          accent
          detail="Profiles allowed to operate"
          label="Active Users"
          value={String(userStats.active)}
        />
        <UserKpiCard
          detail="Admin portal operators"
          label="Admins"
          value={String(userStats.admins)}
        />
        <UserKpiCard
          detail="Dispatch workflow users"
          label="Dispatchers"
          value={String(userStats.dispatchers)}
        />
        <UserKpiCard
          detail="Driver profiles available"
          label="Drivers"
          value={String(userStats.drivers)}
        />
      </div>

      <AdminCard className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <label className="block">
            <span className="sr-only">Search users</span>
            <input
              className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100"
              placeholder="Search users"
              type="search"
            />
          </label>
          <label className="block">
            <span className="sr-only">Role filter</span>
            <select
              className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-600 outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100"
              defaultValue=""
            >
              <option value="">Role</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {formatRole(role)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Status filter</span>
            <select
              className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-600 outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100"
              defaultValue=""
            >
              <option value="">Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
      </AdminCard>

      {successMessage ? (
        <p className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <AdminCard className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-xl font-medium">User Profiles</h2>
            <p className="mt-1 text-sm text-slate-400">
              Profile records loaded from the profiles table.
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="px-5 py-10 text-sm text-slate-500">
            Loading user profiles...
          </p>
        ) : users.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 text-sm font-semibold text-purple-700">
              US
            </div>
            <h3 className="mt-4 text-lg font-semibold">No users found.</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Create a profile record to begin organizing admin, dispatcher,
              and driver users.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm [&_td]:py-2.5 [&_th]:py-2.5">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-medium">Name</th>
                  <th className="px-5 py-4 font-medium">Email</th>
                  <th className="px-5 py-4 font-medium">Phone</th>
                  <th className="px-5 py-4 font-medium">Role</th>
                  <th className="px-5 py-4 font-medium">Active Status</th>
                  <th className="px-5 py-4 font-medium">Created Date</th>
                  <th className="px-5 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-500">
                {paginatedUsers.map((user) => (
                  <tr className="transition hover:bg-slate-50/70" key={user.profileId}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-50 text-xs font-semibold text-purple-700">
                          {(user.firstName[0] || "U").toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-[#17232b]">
                            {getUserName(user)}
                          </p>
                          <p className="max-w-32 truncate text-xs text-slate-400">
                            {user.profileId}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">{user.email || "No email"}</td>
                    <td className="px-5 py-4">{user.phone || "No phone"}</td>
                    <td className="px-5 py-4">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-5 py-4">
                      <UserStatusBadge isActive={user.isActive} />
                    </td>
                    <td className="px-5 py-4">
                      {formatCreatedDate(user.createdAt)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700"
                        onClick={() => openEditModal(user)}
                        type="button"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </>
        )}
      </AdminCard>

      <Pagination
        currentPage={activePage}
        onPageChange={setCurrentPage}
        totalPages={totalPages}
        totalRecords={users.length}
      />

      {isModalOpen ? (
        <UserModal
          formState={formState}
          isSaving={isSaving}
          mode={editingUser ? "edit" : "create"}
          onChange={updateFormState}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      ) : null}
    </section>
  );
}
