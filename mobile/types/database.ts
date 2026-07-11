import type { Delivery } from "@/types/delivery";
import type { Driver, Profile } from "@/types/driver";
import type { DriverNotification } from "@/types/notification";
import type { Route } from "@/types/route";
import type { Schedule, VehicleSummary } from "@/types/schedule";

type TableDefinition<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
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
      notifications: TableDefinition<DriverNotification>;
    };
  };
};
