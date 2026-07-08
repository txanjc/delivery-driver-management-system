export type UserRole = "administrator" | "admin" | "dispatcher" | "driver";

export type Profile = {
  profile_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole | string | null;
  is_active: boolean | null;
};

export type Driver = {
  driver_id: string;
  user_id: string | null;
  license_number: string | null;
  license_expiry_date: string | null;
  availability: string | null;
  performance_score: number | null;
  assigned_vehicle_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};
