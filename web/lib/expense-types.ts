export const expenseTypeOptions = [
  { value: "fuel", label: "Fuel", requiresVehicle: false, showsVehicle: true, syncsVehicleMaintenance: false },
  { value: "maintenance", label: "Maintenance", requiresVehicle: true, showsVehicle: true, syncsVehicleMaintenance: true },
  { value: "repair", label: "Repair", requiresVehicle: true, showsVehicle: true, syncsVehicleMaintenance: true },
  { value: "insurance", label: "Insurance", requiresVehicle: false, showsVehicle: true, syncsVehicleMaintenance: false },
  { value: "registration", label: "Registration", requiresVehicle: false, showsVehicle: true, syncsVehicleMaintenance: false },
  { value: "other", label: "Other", requiresVehicle: false, showsVehicle: false, syncsVehicleMaintenance: false },
] as const;

export type ExpenseType = (typeof expenseTypeOptions)[number]["value"];

export function isExpenseType(value: string): value is ExpenseType {
  return expenseTypeOptions.some((option) => option.value === value);
}

export function expenseTypeLabel(value: string | null | undefined) {
  return expenseTypeOptions.find((option) => option.value === value)?.label ?? "Other";
}

export function expenseTypeRequiresVehicle(value: string | null | undefined) {
  return expenseTypeOptions.some((option) => option.value === value && option.requiresVehicle);
}

export function expenseTypeShowsVehicle(value: string | null | undefined) {
  return expenseTypeOptions.some((option) => option.value === value && option.showsVehicle);
}

export function expenseTypeSyncsVehicleMaintenance(value: string | null | undefined) {
  return expenseTypeOptions.some((option) => option.value === value && option.syncsVehicleMaintenance);
}
