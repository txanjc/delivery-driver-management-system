import type { Delivery } from "@/types/delivery";
import type { Driver, Profile } from "@/types/driver";
import type { Route } from "@/types/route";
import type { Schedule, VehicleSummary } from "@/types/schedule";

type TableDefinition<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
};

type Notification = {
  notification_id: string;
  user_id: string | null;
  title: string | null;
  message: string | null;
  is_read: boolean | null;
  created_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDefinition<Profile>;
      drivers: TableDefinition<Driver>;
      schedules: TableDefinition<Schedule>;
      vehicles: TableDefinition<VehicleSummary>;
      deliveries: TableDefinition<Delivery>;
      routes: TableDefinition<Route>;
      notifications: TableDefinition<Notification>;
    };
  };
};
