import type { Delivery, DeliveryStatusHistory } from "@/types/delivery";
import type { Driver, Profile } from "@/types/driver";
import type { DriverNotification } from "@/types/notification";
import type { DeliveryProof } from "@/types/proofOfDelivery";
import type { Route } from "@/types/route";
import type { Schedule, VehicleSummary } from "@/types/schedule";

type TableDefinition<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableDefinition<Profile>;
      drivers: TableDefinition<Driver>;
      schedules: TableDefinition<Schedule>;
      vehicles: TableDefinition<VehicleSummary>;
      deliveries: TableDefinition<Delivery>;
      delivery_status_history: TableDefinition<DeliveryStatusHistory>;
      delivery_signatures: TableDefinition<DeliveryProof>;
      routes: TableDefinition<Route>;
      notifications: TableDefinition<DriverNotification>;
    };
    Views: {};
    Functions: {};
  };
};
