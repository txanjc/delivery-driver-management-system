import { StyleSheet, Text, useColorScheme, View } from "react-native";
import { SymbolView } from "expo-symbols";

import type { Schedule, VehicleSummary } from "@/types/schedule";

type DailyScheduleCardProps = {
  schedule: Schedule;
  vehicle: VehicleSummary | null;
};

function formatShiftTitle(schedule: Schedule) {
  if (schedule.shift_name?.trim()) return schedule.shift_name.trim();
  if (!schedule.shift_type) return "Scheduled shift";
  return schedule.shift_type.split(/[\s_-]+/).filter(Boolean).map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`).join(" ");
}

function formatTime(value: string | null) {
  if (!value) return "Time not set";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatDuration(startTime: string | null, endTime: string | null) {
  if (!startTime || !endTime) return "Duration unavailable";
  const durationMinutes = Math.max(0, Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000));
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  return minutes === 0 ? `${hours} ${hours === 1 ? "hour" : "hours"}` : `${hours}h ${minutes}m`;
}

function getStatus(schedule: Schedule) {
  const normalized = schedule.status?.trim().toLowerCase();
  if (normalized === "completed") return { color: "#3D9B7F", label: "Completed" };
  if (normalized === "conflict") return { color: "#D45A5A", label: "Conflict" };
  if (schedule.start_time && schedule.end_time && new Date(schedule.start_time).getTime() <= Date.now() && new Date(schedule.end_time).getTime() >= Date.now()) {
    return { color: "#4D9A89", label: "Active" };
  }
  return { color: "#4D9A89", label: "Scheduled" };
}

function getVehicleCopy(schedule: Schedule, vehicle: VehicleSummary | null) {
  if (!schedule.vehicle_id) return { primary: "No vehicle assigned", secondary: null };
  if (!vehicle) return { primary: "Assigned vehicle", secondary: "Vehicle details unavailable" };
  return {
    primary: vehicle.vehicle_number ? `Vehicle ${vehicle.vehicle_number}` : vehicle.license_plate || "Assigned vehicle",
    secondary: [vehicle.make, vehicle.model].filter(Boolean).join(" ") || vehicle.license_plate || null,
  };
}

export function DailyScheduleCard({ schedule, vehicle }: DailyScheduleCardProps) {
  const darkMode = useColorScheme() === "dark";
  const status = getStatus(schedule);
  const vehicleCopy = getVehicleCopy(schedule, vehicle);
  const colors = darkMode
    ? {
      border: "rgba(255, 255, 255, 0.09)",
      card: "#1C1C1E",
      details: "rgba(109, 74, 255, 0.2)",
      muted: "rgba(235, 235, 245, 0.62)",
      surface: "rgba(255, 255, 255, 0.08)",
      text: "#F5F5F7",
    }
    : {
      border: "rgba(23, 35, 43, 0.09)",
      card: "#FFFFFF",
      details: "#F0ECFF",
      muted: "#64748B",
      surface: "#F6F8FA",
      text: "#17232B",
    };

  return (
    <View accessible accessibilityLabel={`${formatShiftTitle(schedule)}, ${status.label}, ${formatTime(schedule.start_time)} to ${formatTime(schedule.end_time)}.`} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.topRow}>
        <Text maxFontSizeMultiplier={1.1} style={[styles.sectionLabel, { color: colors.text }]}>{"Today's workshift"}</Text>
        <View style={[styles.statusChip, { backgroundColor: `${status.color}1C` }]}>
          <View accessibilityElementsHidden style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Text maxFontSizeMultiplier={1.1} style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <View style={[styles.shiftDetails, { backgroundColor: colors.details, borderColor: colors.border }]}>
        <View style={styles.shiftHeader}>
          <View style={[styles.shiftIcon, { backgroundColor: darkMode ? "rgba(109, 74, 255, 0.18)" : "#F2F0FF" }]}>
            <SymbolView fallback={null} name="calendar" size={20} tintColor="#6D4AFF" type="hierarchical" />
          </View>
          <View style={styles.shiftCopy}>
            <Text maxFontSizeMultiplier={1.15} style={[styles.shiftTitle, { color: colors.text }]}>{formatShiftTitle(schedule)}</Text>
          </View>
          <View style={styles.timeBadge}>
            <Text maxFontSizeMultiplier={1.05} style={styles.timeBadgeText}>{formatDuration(schedule.start_time, schedule.end_time)}</Text>
          </View>
        </View>

        <View style={[styles.detailDivider, { backgroundColor: colors.border }]} />

        <View style={styles.detailLine}>
          <SymbolView fallback={null} name="clock" size={15} tintColor={colors.muted} type="hierarchical" />
          <Text maxFontSizeMultiplier={1.1} style={[styles.detailText, { color: colors.text }]}>{formatTime(schedule.start_time)} – {formatTime(schedule.end_time)}</Text>
        </View>
        <View style={styles.detailLine}>
          <SymbolView fallback={null} name="car.fill" size={15} tintColor="#6D4AFF" type="hierarchical" />
          <View style={styles.vehicleCopy}>
            <Text maxFontSizeMultiplier={1.1} style={[styles.detailText, { color: colors.text }]}>{vehicleCopy.primary}</Text>
            {vehicleCopy.secondary ? <Text maxFontSizeMultiplier={1.05} style={[styles.detailSecondary, { color: colors.muted }]}>{vehicleCopy.secondary}</Text> : null}
          </View>
        </View>
        {schedule.notes?.trim() ? (
          <View style={styles.detailLine}>
            <SymbolView fallback={null} name="note.text" size={15} tintColor="#6D4AFF" type="hierarchical" />
            <Text maxFontSizeMultiplier={1.1} style={[styles.detailSecondary, styles.notes, { color: colors.muted }]}>{schedule.notes.trim()}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 14,
    shadowColor: "#17232B",
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
  },
  detailDivider: { height: StyleSheet.hairlineWidth, marginVertical: 1 },
  detailLine: { alignItems: "flex-start", flexDirection: "row", gap: 8 },
  detailSecondary: { fontSize: 13, lineHeight: 18 },
  detailText: { fontSize: 14, fontWeight: "600", lineHeight: 19 },
  notes: { flex: 1 },
  sectionLabel: { fontSize: 15, fontWeight: "600", lineHeight: 20 },
  shiftCopy: { flex: 1, minWidth: 0 },
  shiftDetails: { borderRadius: 16, borderWidth: 1, gap: 9, padding: 12 },
  shiftHeader: { alignItems: "center", flexDirection: "row", gap: 9 },
  shiftIcon: { alignItems: "center", borderRadius: 14, height: 42, justifyContent: "center", width: 42 },
  shiftTitle: { fontSize: 16, fontWeight: "700", lineHeight: 21 },
  statusChip: { alignItems: "center", borderRadius: 999, flexDirection: "row", gap: 6, paddingHorizontal: 9, paddingVertical: 6 },
  statusDot: { borderRadius: 999, height: 7, width: 7 },
  statusText: { fontSize: 12, fontWeight: "700", lineHeight: 16 },
  timeBadge: { backgroundColor: "#6D4AFF", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  timeBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800", lineHeight: 14 },
  topRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  vehicleCopy: { flex: 1, gap: 1 },
});
