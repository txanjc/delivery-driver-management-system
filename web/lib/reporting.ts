export type ReportCategory = "delivery" | "driver" | "financial" | "operational" | "history";

export type ReportSummaryItem = { label: string; value: string | number; context?: string };
export type ReportChart = { type: "bar" | "line" | "horizontal-bar"; labels: string[]; series: Array<{ name: string; values: number[] }> };
export type ReportColumn = { key: string; label: string };
export type GeneratedReport = {
  category: ReportCategory;
  reportType: string;
  title: string;
  period: { from: string; to: string };
  filters: Array<{ label: string; value: string }>;
  summary: ReportSummaryItem[];
  chart?: ReportChart;
  columns: ReportColumn[];
  rows: Array<Record<string, unknown>>;
  generatedAt: string;
};

const options = (...items: Array<[string, string]>) => items.map(([value, label]) => ({ value, label }));

export const reportTypes: Record<ReportCategory, Array<{ value: string; label: string }>> = {
  delivery: options(
    ["overview", "Delivery Overview"], ["status_breakdown", "Delivery Status Breakdown"], ["by_driver", "Deliveries by Driver"], ["by_vehicle", "Deliveries by Vehicle"], ["by_route", "Deliveries by Route"], ["exceptions", "Delivery Exceptions"], ["activity_by_date", "Delivery Activity by Date"],
  ),
  driver: options(
    ["delivery_summary", "Driver Delivery Summary"], ["completed_by_driver", "Completed Deliveries by Driver"], ["exceptions", "Driver Exception Report"], ["scheduled_hours", "Scheduled Driver Hours"], ["availability", "Driver Availability"], ["ranking", "Driver Ranking"],
  ),
  financial: options(
    ["summary", "Financial Summary"], ["revenue", "Revenue Report"], ["expenses", "Expense Report"], ["expenses_by_category", "Expenses by Category"], ["maintenance", "Vehicle Maintenance Costs"], ["revenue_vs_expenses", "Revenue vs Expenses"], ["net_position", "Net Financial Position"],
  ),
  operational: options(
    ["overview", "Operational Overview"], ["active_deliveries", "Active Deliveries"], ["route_activity", "Route Generation Activity"], ["schedule_coverage", "Schedule Coverage"], ["schedule_conflicts", "Schedule Conflicts"], ["missing_drivers", "Missing Driver Assignments"], ["missing_vehicles", "Missing Vehicle Assignments"], ["missing_routes", "Deliveries Without Routes"], ["vehicle_status", "Vehicle Status Report"], ["exceptions", "Operational Exceptions"],
  ),
  history: options(
    ["changes", "Delivery Status Changes"], ["by_delivery", "Status Changes by Delivery"], ["by_user", "Status Changes by User"], ["by_date", "Status Changes by Date"],
  ),
};
