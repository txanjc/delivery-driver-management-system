"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type DriverProfile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_active: boolean | null;
};

type DriverRow = {
  id: string;
  user_id: string;
  license_number: string | null;
  license_expiry: string | null;
  availability: string | null;
  performance_score: number | null;
  assigned_vehicle_id: string | null;
  profiles: DriverProfile | DriverProfile[] | null;
};

type DriverRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  isActive: boolean;
  licenseNumber: string;
  licenseExpiry: string;
  availability: string;
  performanceScore: string;
  assignedVehicleId: string;
};

function normalizeProfile(profile: DriverRow["profiles"]) {
  if (Array.isArray(profile)) {
    return profile[0] ?? null;
  }

  return profile;
}

function toDriverRecord(driver: DriverRow): DriverRecord {
  const profile = normalizeProfile(driver.profiles);

  return {
    id: driver.id,
    firstName: profile?.first_name ?? "",
    lastName: profile?.last_name ?? "",
    email: profile?.email ?? "",
    phone: profile?.phone ?? "",
    role: profile?.role ?? "",
    isActive: profile?.is_active ?? false,
    licenseNumber: driver.license_number ?? "",
    licenseExpiry: driver.license_expiry ?? "",
    availability: driver.availability ?? "",
    performanceScore:
      driver.performance_score === null ? "" : String(driver.performance_score),
    assignedVehicleId: driver.assigned_vehicle_id ?? "",
  };
}

export default function AdminDriversPage() {
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadDrivers = useCallback(async () => {
    const { data, error } = await supabase
      .from("drivers")
      .select(
        "id, user_id, license_number, license_expiry, availability, performance_score, assigned_vehicle_id, profiles:user_id (id, first_name, last_name, email, phone, role, is_active)",
      )
      .order("created_at", { ascending: false })
      .returns<DriverRow[]>();

    if (error) {
      setErrorMessage(error.message);
      setDrivers([]);
      setIsLoading(false);
      return;
    }

    setDrivers((data ?? []).map(toDriverRecord));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadDrivers();
    });
  }, [loadDrivers]);

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Drivers</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          View driver profiles, licensing details, availability, and active
          status.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm leading-6 text-slate-700">
          Driver account creation will be handled in a later admin
          user-management flow.
        </p>
      </div>

      {errorMessage ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-950">
            Driver records
          </h2>
        </div>

        {isLoading ? (
          <p className="px-6 py-8 text-sm text-slate-600">
            Loading driver records...
          </p>
        ) : drivers.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-600">
            No drivers have been created yet. Driver records will appear here
            after the admin user-management flow creates driver accounts and
            related driver records.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    License
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Availability
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Score
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Vehicle
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {drivers.map((driver) => (
                  <tr key={driver.id}>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-950">
                      {driver.firstName || driver.lastName
                        ? `${driver.firstName} ${driver.lastName}`.trim()
                        : "Unnamed driver"}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      <div>{driver.email || "No email"}</div>
                      <div>{driver.phone || "No phone"}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      {driver.role || "No role"}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      <div>{driver.licenseNumber || "No license"}</div>
                      <div className="text-xs text-slate-500">
                        Expires {driver.licenseExpiry || "not set"}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      {driver.availability || "Not set"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      {driver.performanceScore || "Not scored"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      {driver.assignedVehicleId || "Unassigned"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          driver.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {driver.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400"
                          disabled
                          type="button"
                        >
                          Edit planned
                        </button>
                        <button
                          className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-400"
                          disabled
                          type="button"
                        >
                          Inactive planned
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
