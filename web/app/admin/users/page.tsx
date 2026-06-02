"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";

type UserRole = "admin" | "dispatcher" | "driver";

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

type UserRecord = {
  id: string;
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
};

const roleOptions: UserRole[] = ["admin", "dispatcher", "driver"];

function toUserRole(role: string | null): UserRole {
  if (role === "admin" || role === "dispatcher" || role === "driver") {
    return role;
  }

  return "driver";
}

function toUserRecord(profile: ProfileRow): UserRecord {
  return {
    id: profile.id,
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
      className={`rounded-2xl p-5 ${
        accent ? "bg-white text-black" : "bg-[#222222] text-white"
      }`}
    >
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="mt-4 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{detail}</p>
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const tone =
    role === "admin"
      ? "bg-lime-500/15 text-lime-300"
      : role === "dispatcher"
        ? "bg-blue-500/15 text-blue-300"
        : "bg-orange-500/15 text-orange-300";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {formatRole(role)}
    </span>
  );
}

function UserStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        isActive
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-zinc-500/15 text-zinc-300"
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#222222] p-5 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-semibold">
              {isCreateMode ? "Create User" : "Edit User"}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Create and maintain profile records for admin portal workflows.
            </p>
          </div>
          <button
            className="rounded-full border border-white/10 px-3 py-1.5 text-sm text-zinc-300 transition hover:bg-white/10"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <form className="mt-5 space-y-5" onSubmit={onSubmit}>
          <div className="rounded-2xl border border-lime-400/20 bg-lime-400/10 px-4 py-3 text-sm text-lime-100">
            Authentication account creation will be connected in a later secure
            server-side flow.
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                First Name
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300"
                onChange={(event) => onChange("firstName", event.target.value)}
                value={formState.firstName}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">
                Last Name
              </span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300"
                onChange={(event) => onChange("lastName", event.target.value)}
                value={formState.lastName}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">Email</span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!isCreateMode}
                onChange={(event) => onChange("email", event.target.value)}
                required
                type="email"
                value={formState.email}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">Phone</span>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300"
                onChange={(event) => onChange("phone", event.target.value)}
                value={formState.phone}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-300">Role</span>
              <select
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300"
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
              <span className="text-sm font-medium text-zinc-300">
                Active Status
              </span>
              <select
                className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition focus:border-lime-300"
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

          <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
            <button
              className="rounded-full border border-white/10 px-5 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-white/10"
              disabled={isSaving}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving}
              type="submit"
            >
              {isSaving
                ? "Saving..."
                : isCreateMode
                  ? "Create User"
                  : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [formState, setFormState] = useState<UserFormState>(emptyUserForm);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, first_name, last_name, email, phone, role, is_active, created_at",
      )
      .order("created_at", { ascending: false })
      .returns<ProfileRow[]>();

    if (error) {
      setErrorMessage(error.message);
      setUsers([]);
      setIsLoading(false);
      return;
    }

    setUsers((data ?? []).map(toUserRecord));
    setIsLoading(false);
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

    const { error } = editingUser
      ? await supabase
          .from("profiles")
          .update({
            first_name: payload.first_name,
            last_name: payload.last_name,
            phone: payload.phone,
            role: payload.role,
            is_active: payload.is_active,
          })
          .eq("id", editingUser.id)
      : await supabase.from("profiles").insert(payload);

    if (error) {
      setErrorMessage(error.message);
      setIsSaving(false);
      return;
    }

    await loadUsers();
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
    <section className="space-y-5 text-white">
      <div className="flex flex-col gap-4 rounded-3xl bg-[#222222] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-lime-400">
            Access Operations
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Users</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Manage operational profile records, user roles, contact details,
            and active status for the admin and dispatch workflows.
          </p>
        </div>
        <button
          className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
          onClick={openCreateModal}
          type="button"
        >
          Create User
        </button>
      </div>

      <div className="rounded-3xl border border-lime-400/20 bg-lime-400/10 px-5 py-4 text-sm text-lime-100">
        Authentication account creation will be connected in a later secure
        server-side flow.
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

      <div className="rounded-3xl bg-[#222222] p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <label className="block">
            <span className="sr-only">Search users</span>
            <input
              className="h-11 w-full rounded-full border border-white/10 bg-black/30 px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
              placeholder="Search users"
              type="search"
            />
          </label>
          <label className="block">
            <span className="sr-only">Role filter</span>
            <select
              className="h-11 w-full rounded-full border border-white/10 bg-black/30 px-4 text-sm text-zinc-300 outline-none transition focus:border-white/20"
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
              className="h-11 w-full rounded-full border border-white/10 bg-black/30 px-4 text-sm text-zinc-300 outline-none transition focus:border-white/20"
              defaultValue=""
            >
              <option value="">Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
      </div>

      {successMessage ? (
        <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {successMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-3xl bg-[#222222] text-white">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-xl font-medium">User Profiles</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Profile records loaded from the profiles table.
            </p>
          </div>
        </div>

        {isLoading ? (
          <p className="px-5 py-10 text-sm text-zinc-400">
            Loading user profiles...
          </p>
        ) : users.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
              US
            </div>
            <h3 className="mt-4 text-lg font-semibold">No users found.</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-400">
              Create a profile record to begin organizing admin, dispatcher,
              and driver users.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
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
              <tbody className="divide-y divide-white/5 text-zinc-300">
                {users.map((user) => (
                  <tr className="transition hover:bg-white/5" key={user.id}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
                          {(user.firstName[0] || "U").toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white">
                            {getUserName(user)}
                          </p>
                          <p className="text-xs text-zinc-500">{user.id}</p>
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
                        className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-white/10"
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
        )}
      </div>

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
