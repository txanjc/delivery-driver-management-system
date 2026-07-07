"use client";

import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  AdminCard,
  AdminPageIntro,
  PrimaryActionButton,
} from "../_components/admin-design-system";
import { supabase } from "@/lib/supabase";
import {
  getUserRoleLabel,
  normalizeUserRole,
  USER_ROLES,
  type UserRole,
} from "@/lib/roles";
import { DEFAULT_PAGE_SIZE, Pagination } from "../_components/Pagination";
import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";

type StatusFilter = "active" | "inactive" | "all";
type RoleFilter = UserRole | "all";

type ProfileRow = {
  profile_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
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
  updatedAt: string | null;
  lastLoginAt: string | null;
};

type UserFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  temporaryPassword: string;
  confirmTemporaryPassword: string;
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
  confirmTemporaryPassword: "",
};

const roleOptions: UserRole[] = [...USER_ROLES];

function toUserRecord(profile: ProfileRow): UserRecord {
  return {
    profileId: profile.profile_id,
    firstName: profile.first_name ?? "",
    lastName: profile.last_name ?? "",
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    role: normalizeUserRole(profile.role?.trim().toLowerCase()),
    isActive: profile.is_active ?? false,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
    lastLoginAt: null,
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
    confirmTemporaryPassword: "",
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
  return getUserRoleLabel(role);
}

function isProfileRow(value: unknown): value is ProfileRow {
  return (
    typeof value === "object" &&
    value !== null &&
    "profile_id" in value &&
    typeof value.profile_id === "string"
  );
}

function normalizeSearchValue(value: string) {
  return value.trim().toLocaleLowerCase();
}

function isSubsequenceMatch(query: string, value: string) {
  let queryIndex = 0;

  for (const character of value) {
    if (character === query[queryIndex]) queryIndex += 1;
    if (queryIndex === query.length) return true;
  }

  return false;
}

function matchesUserSearch(user: UserRecord, search: string) {
  const tokens = normalizeSearchValue(search).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const fullName = normalizeSearchValue(`${user.firstName} ${user.lastName}`);
  const searchableValues = [
    normalizeSearchValue(user.firstName),
    normalizeSearchValue(user.lastName),
    fullName,
    normalizeSearchValue(user.email),
  ];

  return tokens.every((token) =>
    searchableValues.some(
      (value) => value.includes(token) || isSubsequenceMatch(token, value),
    ),
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
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

  return "Unable to save user.";
}

function UserKpiCard({
  label,
  value,
  detail,
  accent = false,
  isLoading = false,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
  isLoading?: boolean;
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
      {isLoading ? (
        <>
          <Skeleton className="mt-4 h-9 w-20" rounded="rounded-full" />
          <Skeleton className="mt-2 h-3 w-32" rounded="rounded-full" />
        </>
      ) : (
        <>
          <p className="mt-4 text-3xl font-semibold tracking-[-0.03em]">{value}</p>
          <p className={accent ? "mt-1 text-xs text-slate-400" : "mt-1 text-xs text-slate-400"}>{detail}</p>
        </>
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const tone =
    role === "administrator"
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
  errorMessage,
  user,
  isEditing,
  isLoadingDetails,
  isDirty,
  isSaving,
  mode,
  onChange,
  onCancel,
  onClose,
  onEdit,
  onSubmit,
}: {
  formState: UserFormState;
  errorMessage: string;
  user: UserRecord | null;
  isEditing: boolean;
  isLoadingDetails: boolean;
  isDirty: boolean;
  isSaving: boolean;
  mode: "create" | "view";
  onChange: (field: keyof UserFormState, value: string | boolean) => void;
  onCancel: () => void;
  onClose: () => void;
  onEdit: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const isCreateMode = mode === "create";
  const fieldsEnabled = isCreateMode || isEditing;
  const initials = `${formState.firstName[0] ?? ""}${formState.lastName[0] ?? ""}`.toUpperCase() || "U";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, []);

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-md"
      role="dialog"
    >
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-[24px] border border-white bg-white/95 p-1.5 text-[#17232b] shadow-2xl shadow-slate-900/20 ring-1 ring-purple-100/50 backdrop-blur-xl">
      <div className={`user-modal-scrollbar max-h-[calc(92vh-0.75rem)] overflow-y-auto overscroll-contain rounded-[19px] scroll-smooth ${isCreateMode ? "p-4 sm:p-5" : "p-5 sm:p-6"}`}>
        <div className={`flex items-start justify-between gap-4 border-b border-slate-100 ${isCreateMode ? "pb-3" : "pb-4"}`}>
          <div>
            <h2 className="text-xl font-semibold">
              {isCreateMode ? "Create User" : "User Details"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {isCreateMode ? "Create a user account and profile." : "Review account details or enable editing to make changes."}
            </p>
          </div>
          <button
            aria-label="Close user details"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 bg-white/60 p-0 text-slate-500 transition hover:border-purple-200 hover:bg-purple-50/80 hover:text-purple-700"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </button>
        </div>

        <form className={isCreateMode ? "mt-4 space-y-4" : "mt-5 space-y-5"} onSubmit={onSubmit}>
          {errorMessage ? (
            <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>
          ) : null}
          <div className={isCreateMode ? "" : "grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]"}>
          {!isCreateMode ? (
            <aside className="border-b border-dashed border-slate-200 pb-6 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-100 text-2xl font-semibold text-purple-700">{initials}</div>
                <p className="mt-3 text-lg font-semibold">{[formState.firstName, formState.lastName].filter(Boolean).join(" ") || "Unnamed user"}</p>
                <p className="mt-1 max-w-full break-all text-[10px] leading-4 tracking-[-0.01em] text-slate-400">{user?.profileId ?? "Not recorded"}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  <RoleBadge role={formState.role} />
                  <UserStatusBadge isActive={formState.isActive} />
                </div>
                <p className="mt-3 break-all text-sm text-slate-500">{formState.email || "No email"}</p>
                <div className="mt-1 text-xs text-slate-400">
                  <span>Last login: </span>
                  {isLoadingDetails ? <Skeleton className="mt-1 h-3 w-24" rounded="rounded-full" /> : <span>{formatDateTime(user?.lastLoginAt ?? null)}</span>}
                </div>
              </div>
              <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-1">
                <DetailField label="Created at" value={formatDateTime(user?.createdAt ?? null)} />
                <DetailField label="Last updated at" value={isLoadingDetails ? <Skeleton className="h-3 w-28" rounded="rounded-full" /> : formatDateTime(user?.updatedAt ?? null)} />
              </div>
            </aside>
          ) : null}
          <div className={`grid content-start md:grid-cols-2 ${isCreateMode ? "gap-x-4 gap-y-3" : "gap-4"}`}>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">
                First Name
              </span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100"
                disabled={!fieldsEnabled}
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
                disabled={!fieldsEnabled}
                onChange={(event) => onChange("lastName", event.target.value)}
                value={formState.lastName}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Email</span>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!fieldsEnabled}
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
                disabled={!fieldsEnabled}
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
            {!isCreateMode && isEditing ? (
              <fieldset className="grid gap-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 md:col-span-2 md:grid-cols-2">
                <legend className="px-2 text-sm font-semibold text-slate-700">Password Reset</legend>
                <label className="block">
                  <span className="text-sm font-medium text-slate-600">Temporary Password</span>
                  <input className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" minLength={8} onChange={(event) => onChange("temporaryPassword", event.target.value)} type="password" value={formState.temporaryPassword} />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-slate-600">Confirm Temporary Password</span>
                  <input className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" minLength={8} onChange={(event) => onChange("confirmTemporaryPassword", event.target.value)} type="password" value={formState.confirmTemporaryPassword} />
                </label>
                <p className="text-xs leading-5 text-slate-500 md:col-span-2">Leave both fields blank to keep the current password. Temporary passwords must be at least 8 characters.</p>
              </fieldset>
            ) : null}
            <label className="block">
              <span className="text-sm font-medium text-slate-600">Role</span>
              <select
                className="user-details-select mt-2 h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 pr-10 text-sm text-slate-900 outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100"
                onChange={(event) => onChange("role", event.target.value)}
                disabled={!fieldsEnabled}
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
                className="user-details-select mt-2 h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 pr-10 text-sm text-slate-900 outline-none transition focus:border-purple-300 focus:bg-white focus:ring-2 focus:ring-purple-100"
                onChange={(event) =>
                  onChange("isActive", event.target.value === "active")
                }
                disabled={!fieldsEnabled}
                value={formState.isActive ? "active" : "inactive"}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>
          </div>

          <div className={`flex flex-col-reverse gap-3 border-t border-slate-100 sm:flex-row sm:justify-end ${isCreateMode ? "pt-4" : "pt-5"}`}>
            {!isCreateMode && !isEditing ? (
              <button className="rounded-full bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-700" disabled={isSaving} onClick={onEdit} type="button">Edit</button>
            ) : (
              <>
            <button
              className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              disabled={isSaving || (!isCreateMode && !isEditing)}
              onClick={isCreateMode ? onClose : onCancel}
              type="button"
            >
              Cancel
            </button>
            <PrimaryActionButton
              disabled={isSaving || (!isCreateMode && (!isEditing || !isDirty))}
              type="submit"
            >
              {isSaving
                ? "Saving..."
                : isCreateMode
                  ? "Create User"
                  : "Save Changes"}
            </PrimaryActionButton>
              </>
            )}
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-600">{label}</p>
      <p className="mt-1 break-all rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500">{value}</p>
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
  const [isEditing, setIsEditing] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [initialFormState, setInitialFormState] = useState<UserFormState>(emptyUserForm);
  const [formState, setFormState] = useState<UserFormState>(emptyUserForm);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  useEffect(() => {
    if (searchParams.get("action") !== "create") return;
    const timeoutId = window.setTimeout(() => setIsModalOpen(true), 0);
    return () => window.clearTimeout(timeoutId);
  }, [searchParams]);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        setErrorMessage("You must be signed in as an Administrator to view users.");
        setUsers([]);
        return false;
      }

      const response = await fetch("/api/admin/users", {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });
      const contentType = response.headers.get("content-type") ?? "";

      if (!contentType.toLowerCase().includes("application/json")) {
        setErrorMessage(
          "Unable to load user profiles because the server returned an unexpected response.",
        );
        setUsers([]);
        return false;
      }

      const body: unknown = await response.json();
      if (!response.ok) {
        setErrorMessage(`Unable to load user profiles: ${readApiError(body)}`);
        setUsers([]);
        return false;
      }

      const profiles =
        typeof body === "object" &&
        body !== null &&
        "profiles" in body &&
        Array.isArray(body.profiles)
          ? body.profiles.filter(isProfileRow)
          : [];

      setUsers(profiles.map(toUserRecord));
      return true;
    } catch {
      setErrorMessage(
        "Unable to load user profiles. Please refresh the page and try again.",
      );
      setUsers([]);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadUsers();
    });
  }, [loadUsers]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
      setCurrentPage(1);
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);

  const userStats = useMemo(() => {
    return {
      active: users.filter((user) => user.isActive).length,
      administrators: users.filter((user) => user.role === "administrator").length,
      dispatchers: users.filter((user) => user.role === "dispatcher").length,
      drivers: users.filter((user) => user.role === "driver").length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? user.isActive : !user.isActive);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;

      return matchesStatus && matchesRole && matchesUserSearch(user, debouncedSearch);
    });
  }, [debouncedSearch, roleFilter, statusFilter, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / DEFAULT_PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredUsers.slice(
    (activePage - 1) * DEFAULT_PAGE_SIZE,
    activePage * DEFAULT_PAGE_SIZE,
  );

  function openCreateModal() {
    setEditingUser(null);
    setFormState(emptyUserForm);
    setInitialFormState(emptyUserForm);
    setIsEditing(false);
    setErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);
  }

  async function openViewModal(user: UserRecord) {
    setEditingUser(user);
    const nextForm = toUserForm(user);
    setFormState(nextForm);
    setInitialFormState(nextForm);
    setIsEditing(false);
    setIsLoadingDetails(true);
    setErrorMessage("");
    setSuccessMessage("");
    setIsModalOpen(true);

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setErrorMessage("You must be signed in as an Administrator to view account details.");
      setIsLoadingDetails(false);
      return;
    }

    const response = await fetch(`/api/admin/users?profileId=${encodeURIComponent(user.profileId)}`, {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    const body: unknown = await response.json();
    if (!response.ok) {
      setErrorMessage(readApiError(body));
    } else if (typeof body === "object" && body !== null && "authDetails" in body) {
      const details = body.authDetails;
      if (typeof details === "object" && details !== null) {
        const readDate = (key: string) => key in details && typeof (details as Record<string, unknown>)[key] === "string" ? (details as Record<string, string>)[key] : null;
        setEditingUser((current) => current ? {
          ...current,
          createdAt: readDate("createdAt") ?? current.createdAt,
          updatedAt: readDate("updatedAt"),
          lastLoginAt: readDate("lastLoginAt"),
        } : current);
      }
    }
    setIsLoadingDetails(false);
  }

  function closeModal() {
    if (isSaving) {
      return;
    }

    setIsModalOpen(false);
    setEditingUser(null);
    setIsEditing(false);
    setFormState(emptyUserForm);
  }

  function updateFormState(field: keyof UserFormState, value: string | boolean) {
    setFormState((currentFormState) => ({
      ...currentFormState,
      [field]: value,
    }));
  }

  function cancelEditing() {
    setFormState(initialFormState);
    setIsEditing(false);
    setErrorMessage("");
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
      const hasTemporaryPassword = formState.temporaryPassword.length > 0 || formState.confirmTemporaryPassword.length > 0;
      if (hasTemporaryPassword && formState.temporaryPassword.length < 8) {
        setErrorMessage("Temporary password must be at least 8 characters.");
        setIsSaving(false);
        return;
      }
      if (hasTemporaryPassword && formState.temporaryPassword !== formState.confirmTemporaryPassword) {
        setErrorMessage("Temporary password fields must match.");
        setIsSaving(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setErrorMessage("You must be signed in as an Administrator to update users.");
        setIsSaving(false);
        return;
      }

      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileId: editingUser.profileId,
          firstName: formState.firstName,
          lastName: formState.lastName,
          email: formState.email,
          phone: formState.phone,
          role: formState.role,
          isActive: formState.isActive,
          temporaryPassword: hasTemporaryPassword ? formState.temporaryPassword : "",
        }),
      });
      const responseBody: unknown = await response.json();
      setFormState((current) => ({ ...current, temporaryPassword: "", confirmTemporaryPassword: "" }));
      if (!response.ok) {
        setErrorMessage(readApiError(responseBody));
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
        setErrorMessage("You must be signed in as an Administrator to create users.");
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
          <PrimaryActionButton className="gap-2 px-6 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2" onClick={openCreateModal} type="button">
            <svg
              aria-hidden="true"
              className="h-5 w-5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M14.5 19.25H4.75v-.75a4.75 4.75 0 0 1 9.5 0v.75ZM9.5 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                fill="currentColor"
              />
              <circle cx="17.5" cy="7" fill="currentColor" r="4.25" />
              <path
                d="M17.5 4.75v4.5M15.25 7h4.5"
                stroke="white"
                strokeLinecap="round"
                strokeWidth="1.5"
              />
              <path
                d="M15.2 3.25A8.25 8.25 0 1 0 17.75 10"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.5"
              />
            </svg>
            <span>Create User</span>
          </PrimaryActionButton>
        }
        description={
          "Manage operational profile records, user roles, contact details, and active status for Administrator and dispatch workflows."
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
          isLoading={isLoading}
          label="Active Users"
          value={String(userStats.active)}
        />
        <UserKpiCard
          detail="Administrator portal operators"
          isLoading={isLoading}
          label="Administrators"
          value={String(userStats.administrators)}
        />
        <UserKpiCard
          detail="Dispatch workflow users"
          isLoading={isLoading}
          label="Dispatchers"
          value={String(userStats.dispatchers)}
        />
        <UserKpiCard
          detail="Driver profiles available"
          isLoading={isLoading}
          label="Drivers"
          value={String(userStats.drivers)}
        />
      </div>

      <AdminCard className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <label className="block">
            <span className="sr-only">Search users</span>
            <input
              className="users-search-input h-11 w-full rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-blue-200 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search users"
              type="search"
              value={searchInput}
            />
          </label>
          <label className="block">
            <span className="sr-only">Role filter</span>
            <select
              className="users-filter-select h-11 w-full appearance-none rounded-full border border-slate-200 bg-slate-50 px-4 pr-10 text-sm text-slate-600 outline-none transition hover:border-blue-200 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              onChange={(event) => {
                setRoleFilter(event.target.value as RoleFilter);
                setCurrentPage(1);
              }}
              value={roleFilter}
            >
              <option value="all">All Roles</option>
              <option value="administrator">Administrator</option>
              <option value="dispatcher">Dispatcher</option>
              <option value="driver">Driver</option>
            </select>
          </label>
          <label className="block">
            <span className="sr-only">Status filter</span>
            <select
              className="users-filter-select h-11 w-full appearance-none rounded-full border border-slate-200 bg-slate-50 px-4 pr-10 text-sm text-slate-600 outline-none transition hover:border-blue-200 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              onChange={(event) => {
                setStatusFilter(event.target.value as StatusFilter);
                setCurrentPage(1);
              }}
              value={statusFilter}
            >
              <option value="all">All Users</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
      </AdminCard>

      {successMessage ? (
        <p aria-live="polite" className="fixed right-6 top-6 z-[60] rounded-2xl border border-emerald-200 bg-white px-5 py-4 text-sm font-medium text-emerald-700 shadow-xl">
          {successMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p aria-live="assertive" className="fixed right-6 top-6 z-[60] max-w-sm rounded-2xl border border-red-200 bg-white px-5 py-4 text-sm font-medium text-red-700 shadow-xl">
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
          <SkeletonTable columns={7} rows={7} />
        ) : filteredUsers.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 text-sm font-semibold text-purple-700">
              US
            </div>
            <h3 className="mt-4 text-lg font-semibold">No users found.</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
              Try adjusting your search or filters.
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
                      {formatDateTime(user.createdAt)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700"
                        onClick={() => void openViewModal(user)}
                        type="button"
                      >
                        View
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
        totalRecords={filteredUsers.length}
        tone="purple"
      />

      {isModalOpen ? (
        <UserModal
          errorMessage={errorMessage}
          formState={formState}
          user={editingUser}
          isEditing={isEditing}
          isLoadingDetails={isLoadingDetails}
          isDirty={JSON.stringify(formState) !== JSON.stringify(initialFormState)}
          isSaving={isSaving}
          mode={editingUser ? "view" : "create"}
          onChange={updateFormState}
          onCancel={cancelEditing}
          onClose={closeModal}
          onEdit={() => setIsEditing(true)}
          onSubmit={handleSubmit}
        />
      ) : null}
    </section>
  );
}
