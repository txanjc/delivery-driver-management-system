export type DriverTabName = "index" | "deliveries" | "status" | "schedule" | "alerts";

export type DriverTabDefinition = {
  name: DriverTabName;
  label: string;
  icon: string;
};

export const driverTabs: DriverTabDefinition[] = [
  { name: "index", label: "Dashboard", icon: "D" },
  { name: "schedule", label: "Schedules", icon: "C" },
  { name: "deliveries", label: "Deliveries", icon: "D" },
  { name: "status", label: "Status", icon: "S" },
  { name: "alerts", label: "Alerts", icon: "A" },
];

export function getDriverTabDefinition(routeName: string) {
  return driverTabs.find((tab) => tab.name === routeName);
}
