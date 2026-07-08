export type Schedule = {
  schedule_id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  shift_date: string | null;
  shift_type: string | null;
  shift_name: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
  notes: string | null;
};

export type VehicleSummary = {
  vehicle_id: string;
  vehicle_number: string | null;
  license_plate: string | null;
  make: string | null;
  model: string | null;
  status: string | null;
};
