import { apiError, authorizeAdministratorRequest, requireAdministratorAal2 } from "@/lib/server/administrator-api";
import { reportTypes, type GeneratedReport, type ReportCategory, type ReportChart, type ReportColumn, type ReportSummaryItem } from "@/lib/reporting";

type Row = Record<string, unknown>;
const terminalStatuses = new Set(["delivered", "failed", "returned"]);
const exceptionStatuses = new Set(["delayed", "failed", "returned"]);
const activeStatuses = new Set(["assigned", "in_transit", "delayed"]);

function text(row: Row, key: string) { return typeof row[key] === "string" ? row[key] as string : ""; }
function number(row: Row, key: string) { const value = Number(row[key]); return Number.isFinite(value) ? value : 0; }
function dateKey(value: unknown) { return typeof value === "string" ? value.slice(0, 10) : ""; }
function inPeriod(value: unknown, from: string, to: string) { const date = dateKey(value); return Boolean(date) && (!from || date >= from) && (!to || date <= to); }
function label(value: unknown) { return String(value || "Not recorded").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
function name(profile?: Row) { return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || text(profile ?? {}, "email") || "Not recorded"; }
function hours(start: unknown, end: unknown) { const left = typeof start === "string" ? Date.parse(start) : NaN; const right = typeof end === "string" ? Date.parse(end) : NaN; return Number.isFinite(left) && Number.isFinite(right) && right > left ? (right - left) / 3_600_000 : 0; }
function countBy(rows: Row[], key: (row: Row) => string) { const result = new Map<string, number>(); rows.forEach((row) => { const value = key(row); result.set(value, (result.get(value) ?? 0) + 1); }); return result; }
function chartFromMap(map: Map<string, number>, seriesName: string, type: ReportChart["type"] = "bar"): ReportChart { const entries = [...map.entries()]; return { type, labels: entries.map(([key]) => key), series: [{ name: seriesName, values: entries.map(([, value]) => value) }] }; }
function cols(...pairs: Array<[string, string]>): ReportColumn[] { return pairs.map(([key, columnLabel]) => ({ key, label: columnLabel })); }
function values(url: URL, key: string) { return url.searchParams.get(key)?.trim() ?? ""; }

export async function GET(request: Request) {
  const authorization = await authorizeAdministratorRequest(request);
  if (!authorization.client) return authorization.response;
  const url = new URL(request.url);
  const category = values(url, "category") as ReportCategory;
  const reportType = values(url, "reportType");
  const dateFrom = values(url, "dateFrom"); const dateTo = values(url, "dateTo");
  if (!reportTypes[category]?.some((option) => option.value === reportType)) return apiError("Select a supported report category and report type.", 400);

  let client = authorization.client;
  let protectedReportUserId: string | null = null;
  if (category === "financial") {
    const aal2Authorization = await requireAdministratorAal2(request, "financial_report_generate");
    if (!aal2Authorization.client) return aal2Authorization.response;
    client = aal2Authorization.client;
    protectedReportUserId = aal2Authorization.userId;
  }

  const [deliveriesResult, driversResult, profilesResult, vehiclesResult, schedulesResult, routesResult, expensesResult, revenueResult, maintenanceResult, historyResult] = await Promise.all([
    client.from("deliveries").select("delivery_id, delivery_number, customer_name, assigned_driver_id, assigned_vehicle_id, status, priority, created_at"),
    client.from("drivers").select("driver_id, user_id, availability"),
    client.from("profiles").select("profile_id, first_name, last_name, email"),
    client.from("vehicles").select("vehicle_id, vehicle_number, license_plate, make, model, status"),
    client.from("schedules").select("schedule_id, driver_id, vehicle_id, shift_date, shift_type, shift_name, start_time, end_time, status"),
    client.from("routes").select("route_id, delivery_id, route_generated_at, created_at"),
    category === "financial" ? client.from("expenses").select("expense_id, delivery_id, vehicle_id, driver_id, expense_type, description, amount, expense_date") : Promise.resolve({ data: [], error: null }),
    category === "financial" ? client.from("delivery_revenue").select("revenue_id, delivery_id, revenue_amount, tax_amount, discount_amount, net_revenue, invoice_number, revenue_date") : Promise.resolve({ data: [], error: null }),
    category === "financial" ? client.from("vehicle_maintenance").select("maintenance_id, vehicle_id, maintenance_type, cost, maintenance_date") : Promise.resolve({ data: [], error: null }),
    client.from("delivery_status_history").select("delivery_id, status, changed_by, created_at").order("created_at", { ascending: false }),
  ]);
  const error = category === "delivery"
    ? deliveriesResult.error ?? driversResult.error ?? vehiclesResult.error ?? routesResult.error
    : category === "driver"
      ? deliveriesResult.error ?? driversResult.error ?? profilesResult.error ?? schedulesResult.error
      : category === "financial"
        ? expensesResult.error ?? revenueResult.error ?? maintenanceResult.error
        : category === "operational"
          ? deliveriesResult.error ?? driversResult.error ?? vehiclesResult.error ?? schedulesResult.error ?? routesResult.error
          : historyResult.error ?? deliveriesResult.error ?? profilesResult.error;
  if (error) { console.info("[DeliverEaze security]", JSON.stringify({ event: "report_query_failed", category, reportType })); return apiError("The report could not be generated.", 400); }
  const deliveries = (deliveriesResult.data ?? []) as Row[]; const drivers = (driversResult.data ?? []) as Row[]; const profiles = (profilesResult.data ?? []) as Row[]; const vehicles = (vehiclesResult.data ?? []) as Row[]; const schedules = (schedulesResult.data ?? []) as Row[]; const routes = (routesResult.data ?? []) as Row[]; const expenses = (expensesResult.data ?? []) as Row[]; const revenue = (revenueResult.data ?? []) as Row[]; const maintenance = (maintenanceResult.data ?? []) as Row[]; const history = (historyResult.data ?? []) as Row[];
  const driverProfiles = new Map(drivers.map((driver) => [text(driver, "driver_id"), profiles.find((profile) => text(profile, "profile_id") === text(driver, "user_id"))]));
  const driverNames = new Map(drivers.map((driver) => [text(driver, "driver_id"), name(driverProfiles.get(text(driver, "driver_id")))]));
  const profileNames = new Map(profiles.map((profile) => [text(profile, "profile_id"), name(profile)]));
  const vehicleNames = new Map(vehicles.map((vehicle) => [text(vehicle, "vehicle_id"), text(vehicle, "vehicle_number") || text(vehicle, "license_plate") || "Not recorded"]));
  const deliveryNames = new Map(deliveries.map((delivery) => [text(delivery, "delivery_id"), text(delivery, "delivery_number") || "Unnumbered"]));
  const routeByDelivery = new Map(routes.map((route) => [text(route, "delivery_id"), route]));
  const filters = { driverId: values(url, "driverId"), vehicleId: values(url, "vehicleId"), deliveryId: values(url, "deliveryId"), routeId: values(url, "routeId"), status: values(url, "status"), priority: values(url, "priority"), availability: values(url, "availability"), shift: values(url, "shift"), expenseCategory: values(url, "expenseCategory"), vehicleStatus: values(url, "vehicleStatus"), changedBy: values(url, "changedBy") };
  const appliedFilters = Object.entries(filters).filter(([, value]) => value).map(([key, value]) => ({ label: label(key.replace(/Id$/, "")), value: key === "driverId" ? driverNames.get(value) ?? value : key === "vehicleId" ? vehicleNames.get(value) ?? value : key === "deliveryId" ? deliveryNames.get(value) ?? value : key === "changedBy" ? profileNames.get(value) ?? value : label(value) }));
  let rows: Row[] = []; let columns: ReportColumn[] = []; let summary: ReportSummaryItem[] = []; let chart: ReportChart | undefined;
  const deliveryScope = deliveries.filter((row) => inPeriod(row.created_at, dateFrom, dateTo) && (!filters.driverId || row.assigned_driver_id === filters.driverId) && (!filters.vehicleId || row.assigned_vehicle_id === filters.vehicleId) && (!filters.status || row.status === filters.status) && (!filters.priority || row.priority === filters.priority) && (!filters.deliveryId || row.delivery_id === filters.deliveryId));
  const historyScope = history.filter((row) => inPeriod(row.created_at, dateFrom, dateTo) && (!filters.deliveryId || row.delivery_id === filters.deliveryId) && (!filters.changedBy || row.changed_by === filters.changedBy) && (!filters.status || row.status === filters.status));
  const completedIds = new Set(historyScope.filter((row) => row.status === "delivered").map((row) => text(row, "delivery_id")));

  if (category === "delivery") {
    const scoped = reportType === "activity_by_date" || reportType === "status_breakdown" ? deliveryScope : deliveryScope;
    const statusCounts = countBy(scoped, (row) => label(row.status));
    summary = [{ label: "Total Deliveries", value: scoped.length }, { label: "Completed", value: scoped.filter((row) => row.status === "delivered").length }, { label: "Active", value: scoped.filter((row) => activeStatuses.has(text(row, "status"))).length }, { label: "Exceptions", value: scoped.filter((row) => exceptionStatuses.has(text(row, "status"))).length }, { label: "Assigned Drivers", value: new Set(scoped.map((row) => row.assigned_driver_id).filter(Boolean)).size }];
    if (reportType === "by_driver" || reportType === "by_vehicle" || reportType === "by_route" || reportType === "status_breakdown" || reportType === "activity_by_date") {
      const grouping = reportType === "by_driver" ? countBy(scoped, (row) => driverNames.get(text(row, "assigned_driver_id")) ?? "Unassigned") : reportType === "by_vehicle" ? countBy(scoped, (row) => vehicleNames.get(text(row, "assigned_vehicle_id")) ?? "Unassigned") : reportType === "by_route" ? countBy(scoped, (row) => routeByDelivery.has(text(row, "delivery_id")) ? deliveryNames.get(text(row, "delivery_id")) ?? "Route" : "No route") : reportType === "activity_by_date" ? countBy(scoped, (row) => dateKey(row.created_at)) : statusCounts;
      rows = [...grouping].map(([group, count]) => ({ group, count })); columns = cols(["group", reportType === "activity_by_date" ? "Date" : "Group"], ["count", "Deliveries"]); chart = chartFromMap(grouping, "Deliveries", reportType === "activity_by_date" ? "line" : "bar");
    } else {
      rows = (reportType === "exceptions" ? scoped.filter((row) => exceptionStatuses.has(text(row, "status"))) : scoped).map((row) => ({ delivery: deliveryNames.get(text(row, "delivery_id")), customer: row.customer_name, driver: driverNames.get(text(row, "assigned_driver_id")) ?? "Unassigned", vehicle: vehicleNames.get(text(row, "assigned_vehicle_id")) ?? "Unassigned", status: label(row.status), priority: label(row.priority), created: dateKey(row.created_at) })); columns = cols(["delivery", "Delivery"], ["customer", "Customer"], ["driver", "Driver"], ["vehicle", "Vehicle"], ["status", "Status"], ["priority", "Priority"], ["created", "Created"]); chart = chartFromMap(statusCounts, "Deliveries");
    }
  }

  if (category === "driver") {
    const scopedDrivers = drivers.filter((row) => (!filters.driverId || row.driver_id === filters.driverId) && (!filters.availability || row.availability === filters.availability));
    const scopedSchedules = schedules.filter((row) => inPeriod(row.shift_date || row.start_time, dateFrom, dateTo) && row.status !== "cancelled" && (!filters.driverId || row.driver_id === filters.driverId) && (!filters.shift || row.shift_name === filters.shift || row.shift_type === filters.shift));
    const driverRows = scopedDrivers.map((driver) => { const id = text(driver, "driver_id"); const assigned = deliveryScope.filter((delivery) => delivery.assigned_driver_id === id); const completed = assigned.filter((delivery) => delivery.status === "delivered" || completedIds.has(text(delivery, "delivery_id"))).length; const exceptions = assigned.filter((delivery) => exceptionStatuses.has(text(delivery, "status"))).length; const scheduledHours = scopedSchedules.filter((schedule) => schedule.driver_id === id).reduce((sum, schedule) => sum + hours(schedule.start_time, schedule.end_time), 0); const completionComponent = assigned.length ? completed / assigned.length * 60 : 0; const activityComponent = Math.min(completed / 10, 1) * 25; const exceptionPenalty = assigned.length ? exceptions / assigned.length * 25 : 0; return { driver: driverNames.get(id), assigned: assigned.length, completed, exceptions, scheduledHours: Math.round(scheduledHours * 10) / 10, availability: label(driver.availability), score: Math.max(0, Math.min(100, Math.round(completionComponent + activityComponent - exceptionPenalty))) }; });
    rows = reportType === "exceptions" ? driverRows.filter((row) => row.exceptions > 0) : reportType === "availability" ? driverRows.map(({ driver, availability }) => ({ driver, availability })) : reportType === "scheduled_hours" ? driverRows.map(({ driver, scheduledHours }) => ({ driver, scheduledHours })) : reportType === "completed_by_driver" ? driverRows.map(({ driver, completed }) => ({ driver, completed })) : reportType === "ranking" ? [...driverRows].filter((row) => row.assigned > 0 || row.scheduledHours > 0).sort((a, b) => b.score - a.score) : driverRows;
    columns = Object.keys(rows[0] ?? { driver: "", assigned: 0, completed: 0, exceptions: 0, scheduledHours: 0, availability: "", score: 0 }).map((key) => ({ key, label: label(key) }));
    summary = [{ label: "Drivers Included", value: scopedDrivers.length }, { label: "Completed Deliveries", value: driverRows.reduce((sum, row) => sum + row.completed, 0) }, { label: "Exception Deliveries", value: driverRows.reduce((sum, row) => sum + row.exceptions, 0) }, { label: "Scheduled Hours", value: driverRows.reduce((sum, row) => sum + row.scheduledHours, 0).toFixed(1) }, { label: "Available Drivers", value: scopedDrivers.filter((row) => row.availability === "available").length }];
    const metric = reportType === "scheduled_hours" ? "scheduledHours" : reportType === "ranking" ? "score" : "completed"; chart = { type: "horizontal-bar", labels: rows.map((row) => String(row.driver)), series: [{ name: label(metric), values: rows.map((row) => Number(row[metric]) || 0) }] };
  }

  if (category === "financial") {
    const scopedRevenue = revenue.filter((row) => inPeriod(row.revenue_date, dateFrom, dateTo) && (!filters.deliveryId || row.delivery_id === filters.deliveryId));
    const scopedExpenses = expenses.filter((row) => inPeriod(row.expense_date, dateFrom, dateTo) && (!filters.expenseCategory || row.expense_type === filters.expenseCategory) && (!filters.driverId || row.driver_id === filters.driverId) && (!filters.vehicleId || row.vehicle_id === filters.vehicleId) && (!filters.deliveryId || row.delivery_id === filters.deliveryId));
    const scopedMaintenance = maintenance.filter((row) => inPeriod(row.maintenance_date, dateFrom, dateTo) && (!filters.vehicleId || row.vehicle_id === filters.vehicleId));
    const revenueTotal = scopedRevenue.reduce((sum, row) => sum + number(row, "net_revenue"), 0); const expenseTotal = scopedExpenses.reduce((sum, row) => sum + number(row, "amount"), 0); const maintenanceTotal = scopedMaintenance.reduce((sum, row) => sum + number(row, "cost"), 0); const net = revenueTotal - expenseTotal - maintenanceTotal;
    summary = [{ label: "Revenue", value: revenueTotal.toFixed(2) }, { label: "Expenses", value: expenseTotal.toFixed(2) }, { label: "Maintenance Costs", value: maintenanceTotal.toFixed(2), context: "vehicle_maintenance is authoritative" }, { label: "Net Position", value: net.toFixed(2) }, { label: "Transactions", value: scopedRevenue.length + scopedExpenses.length + scopedMaintenance.length }];
    if (reportType === "revenue") { rows = scopedRevenue.map((row) => ({ delivery: deliveryNames.get(text(row, "delivery_id")), invoice: row.invoice_number, gross: row.revenue_amount, tax: row.tax_amount, discount: row.discount_amount, net: row.net_revenue, date: dateKey(row.revenue_date) })); }
    else if (reportType === "expenses") { rows = scopedExpenses.map((row) => ({ category: label(row.expense_type), description: row.description, delivery: deliveryNames.get(text(row, "delivery_id")), driver: driverNames.get(text(row, "driver_id")), vehicle: vehicleNames.get(text(row, "vehicle_id")), amount: row.amount, date: dateKey(row.expense_date) })); }
    else if (reportType === "maintenance") { rows = scopedMaintenance.map((row) => ({ vehicle: vehicleNames.get(text(row, "vehicle_id")), type: label(row.maintenance_type), cost: row.cost, date: dateKey(row.maintenance_date) })); }
    else if (reportType === "expenses_by_category") { rows = [...scopedExpenses.reduce((map, row) => map.set(label(row.expense_type), (map.get(label(row.expense_type)) ?? 0) + number(row, "amount")), new Map<string, number>())].map(([categoryName, amount]) => ({ category: categoryName, amount })); }
    else { rows = [{ metric: "Revenue", amount: revenueTotal }, { metric: "Expenses", amount: expenseTotal }, { metric: "Maintenance", amount: maintenanceTotal }, { metric: "Net Position", amount: net }]; }
    columns = Object.keys(rows[0] ?? { metric: "", amount: 0 }).map((key) => ({ key, label: label(key) })); const map = new Map(rows.map((row) => [String(row.metric ?? row.category ?? row.date ?? "Value"), Number(row.amount ?? row.net ?? row.cost) || 0])); chart = chartFromMap(map, "Amount");
  }

  if (category === "operational") {
    const active = deliveryScope.filter((row) => activeStatuses.has(text(row, "status"))); const scopedRoutes = routes.filter((row) => inPeriod(row.route_generated_at || row.created_at, dateFrom, dateTo) && (!filters.routeId || row.route_id === filters.routeId)); const scopedSchedules = schedules.filter((row) => inPeriod(row.shift_date || row.start_time, dateFrom, dateTo) && (!filters.driverId || row.driver_id === filters.driverId) && (!filters.vehicleId || row.vehicle_id === filters.vehicleId) && (!filters.shift || row.shift_name === filters.shift || row.shift_type === filters.shift)); const missingDrivers = deliveryScope.filter((row) => !row.assigned_driver_id); const missingVehicles = deliveryScope.filter((row) => !row.assigned_vehicle_id); const missingRoutes = deliveryScope.filter((row) => !routeByDelivery.has(text(row, "delivery_id"))); const scopedVehicles = vehicles.filter((row) => !filters.vehicleStatus || row.status === filters.vehicleStatus);
    const conflicts = scopedSchedules.filter((schedule, index) => scopedSchedules.some((other, otherIndex) => otherIndex > index && (schedule.driver_id === other.driver_id || Boolean(schedule.vehicle_id && schedule.vehicle_id === other.vehicle_id)) && String(schedule.start_time) < String(other.end_time) && String(other.start_time) < String(schedule.end_time)));
    summary = [{ label: "Active Deliveries", value: active.length }, { label: "Active Shifts", value: scopedSchedules.filter((row) => row.status !== "cancelled" && String(row.start_time) <= new Date().toISOString() && String(row.end_time) > new Date().toISOString()).length }, { label: "Routes Generated", value: scopedRoutes.length }, { label: "Missing Assignments", value: new Set([...missingDrivers, ...missingVehicles].map((row) => row.delivery_id)).size }, { label: "Operational Exceptions", value: missingDrivers.length + missingVehicles.length + missingRoutes.length + conflicts.length }];
    const deliveryOutput = (source: Row[]) => source.map((row) => ({ delivery: deliveryNames.get(text(row, "delivery_id")), status: label(row.status), driver: driverNames.get(text(row, "assigned_driver_id")) ?? "Unassigned", vehicle: vehicleNames.get(text(row, "assigned_vehicle_id")) ?? "Unassigned" }));
    if (reportType === "active_deliveries") rows = deliveryOutput(active); else if (reportType === "missing_drivers") rows = deliveryOutput(missingDrivers); else if (reportType === "missing_vehicles") rows = deliveryOutput(missingVehicles); else if (reportType === "missing_routes") rows = deliveryOutput(missingRoutes); else if (reportType === "route_activity") rows = scopedRoutes.map((row) => ({ route: row.route_id, delivery: deliveryNames.get(text(row, "delivery_id")), generated: dateKey(row.route_generated_at || row.created_at) })); else if (reportType === "vehicle_status") rows = scopedVehicles.map((row) => ({ vehicle: vehicleNames.get(text(row, "vehicle_id")), status: label(row.status) })); else if (reportType === "schedule_conflicts") rows = conflicts.map((row) => ({ schedule: row.schedule_id, driver: driverNames.get(text(row, "driver_id")), vehicle: vehicleNames.get(text(row, "vehicle_id")), start: row.start_time, end: row.end_time })); else if (reportType === "schedule_coverage") rows = scopedSchedules.map((row) => ({ shift: row.shift_name || row.shift_type, driver: driverNames.get(text(row, "driver_id")), vehicle: vehicleNames.get(text(row, "vehicle_id")), date: dateKey(row.shift_date || row.start_time), status: label(row.status) })); else rows = deliveryOutput(reportType === "exceptions" ? [...missingDrivers, ...missingVehicles, ...missingRoutes] : deliveryScope);
    columns = Object.keys(rows[0] ?? { record: "" }).map((key) => ({ key, label: label(key) })); const exceptionMap = new Map([["Missing driver", missingDrivers.length], ["Missing vehicle", missingVehicles.length], ["Missing route", missingRoutes.length], ["Schedule conflict", conflicts.length], ["Maintenance", scopedVehicles.filter((row) => ["maintenance", "maintenance_due"].includes(text(row, "status"))).length], ["Out of service", scopedVehicles.filter((row) => row.status === "out_of_service").length]]); chart = chartFromMap(exceptionMap, "Records");
  }

  if (category === "history") {
    const changes = historyScope.map((row) => ({ delivery: deliveryNames.get(text(row, "delivery_id")) ?? "Unknown delivery", status: label(row.status), changedBy: profileNames.get(text(row, "changed_by")) ?? "Not recorded", changedAt: row.created_at }));
    if (reportType === "by_delivery") { const grouped = countBy(historyScope, (row) => deliveryNames.get(text(row, "delivery_id")) ?? "Unknown delivery"); rows = [...grouped].map(([delivery, changesCount]) => ({ delivery, changes: changesCount })); }
    else if (reportType === "by_user") { const grouped = countBy(historyScope, (row) => profileNames.get(text(row, "changed_by")) ?? "Not recorded"); rows = [...grouped].map(([user, changesCount]) => ({ user, changes: changesCount })); }
    else if (reportType === "by_date") { const grouped = countBy(historyScope, (row) => dateKey(row.created_at)); rows = [...grouped].map(([date, changesCount]) => ({ date, changes: changesCount })); }
    else rows = changes;
    columns = Object.keys(rows[0] ?? { delivery: "", status: "", changedBy: "", changedAt: "" }).map((key) => ({ key, label: label(key) })); const statusMap = countBy(historyScope, (row) => label(row.status)); chart = chartFromMap(statusMap, "Status changes"); summary = [{ label: "Status Changes", value: historyScope.length }, { label: "Deliveries Affected", value: new Set(historyScope.map((row) => row.delivery_id)).size }, { label: "Users Recorded", value: new Set(historyScope.map((row) => row.changed_by).filter(Boolean)).size }, { label: "Terminal Changes", value: historyScope.filter((row) => terminalStatuses.has(text(row, "status"))).length }, { label: "Exception Changes", value: historyScope.filter((row) => exceptionStatuses.has(text(row, "status"))).length }];
  }

  const title = reportTypes[category].find((option) => option.value === reportType)?.label ?? "Report";
  const response: GeneratedReport = { category, reportType, title, period: { from: dateFrom, to: dateTo }, filters: appliedFilters, summary, chart, columns, rows, generatedAt: new Date().toISOString() };
  const optionPayload = {
    drivers: drivers.map((row) => ({ value: text(row, "driver_id"), label: driverNames.get(text(row, "driver_id")) ?? "Not recorded" })),
    vehicles: vehicles.map((row) => ({ value: text(row, "vehicle_id"), label: vehicleNames.get(text(row, "vehicle_id")) ?? "Not recorded" })),
    deliveries: deliveries.map((row) => ({ value: text(row, "delivery_id"), label: deliveryNames.get(text(row, "delivery_id")) ?? "Unnumbered" })),
    routes: routes.map((row) => ({ value: text(row, "route_id"), label: deliveryNames.get(text(row, "delivery_id")) ?? text(row, "route_id") })),
    shifts: [...new Set(schedules.map((row) => text(row, "shift_name") || text(row, "shift_type")).filter(Boolean))].map((value) => ({ value, label: label(value) })),
    users: profiles.map((row) => ({ value: text(row, "profile_id"), label: name(row) })),
  };
  if (category === "financial") {
    console.info("[DeliverEaze security]", JSON.stringify({ event: "financial_report_generated_at_aal2", userId: protectedReportUserId, reportType }));
  }
  return Response.json({ ...response, options: optionPayload });
}
