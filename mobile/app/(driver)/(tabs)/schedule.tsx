import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from "react-native";
import { SymbolView } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  dashboardMaxFontSizeMultipliers,
  dashboardShadows,
  dashboardSpacing,
  dashboardTypography,
  getCardPadding,
  getCardRadius,
  getDashboardColors,
  getScrollContentBottomPadding,
  getScreenHorizontalPadding,
  getSectionGap,
} from "@/components/dashboard/dashboardDesignSpec";
import { DashboardScrollEdge } from "@/components/dashboard/DashboardScrollEdge";
import { DailyScheduleCard } from "@/components/schedule/DailyScheduleCard";
import { ScheduleWeekSelector, type ScheduleDayMarker } from "@/components/schedule/ScheduleWeekSelector";
import { ProfileButton } from "@/components/shared/ProfileButton";
import { useDriverProfile } from "@/hooks/useDriverProfile";
import { getSchedulesForDriver, getVehicle } from "@/services/schedule.service";
import type { Schedule, VehicleSummary } from "@/types/schedule";

type ShiftTone = "morning" | "evening" | "custom";

const shiftColors = {
  custom: "#1A1424",
  evening: "#8F75FF",
  morning: "#57D7A4",
} as const;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getDateKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function getScheduleDateKey(schedule: Schedule) {
  if (schedule.shift_date) return schedule.shift_date;
  if (schedule.start_time) return getDateKey(new Date(schedule.start_time));
  return null;
}

function getShiftTone(schedule: Schedule): ShiftTone {
  const label = `${schedule.shift_type ?? ""} ${schedule.shift_name ?? ""}`.toLowerCase();
  if (label.includes("morning") || label.includes("am")) return "morning";
  if (label.includes("evening") || label.includes("pm") || label.includes("night")) return "evening";
  return "custom";
}

function getWeekRange(date: Date) {
  const weekdayOffset = (date.getDay() + 6) % 7;
  const start = addDays(startOfDay(date), -weekdayOffset);
  return { end: addDays(start, 6), start };
}

function formatSelectedDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", weekday: "long" }).format(date);
}

function findConflictScheduleIds(schedules: Schedule[]) {
  const conflicts = new Set<string>();

  schedules.forEach((schedule, index) => {
    if (schedule.status?.trim().toLowerCase() === "conflict") conflicts.add(schedule.schedule_id);
    if (!schedule.start_time || !schedule.end_time) return;

    const start = new Date(schedule.start_time).getTime();
    const end = new Date(schedule.end_time).getTime();
    schedules.slice(index + 1).forEach((other) => {
      if (!other.start_time || !other.end_time || getScheduleDateKey(other) !== getScheduleDateKey(schedule)) return;
      const otherStart = new Date(other.start_time).getTime();
      const otherEnd = new Date(other.end_time).getTime();
      if (start < otherEnd && otherStart < end) {
        conflicts.add(schedule.schedule_id);
        conflicts.add(other.schedule_id);
      }
    });
  });

  return conflicts;
}

export default function ScheduleScreen() {
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { driver } = useDriverProfile();
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [vehiclesById, setVehiclesById] = useState<Record<string, VehicleSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dashboardColors = getDashboardColors(colorScheme);
  const cardPadding = getCardPadding(width);
  const cardRadius = getCardRadius(width);
  const horizontalPadding = getScreenHorizontalPadding(width);
  const sectionGap = getSectionGap(width);

  useEffect(() => {
    let active = true;

    async function loadSchedules() {
      if (!driver) {
        if (active) {
          setSchedules([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      const response = await getSchedulesForDriver(driver.driver_id);
      if (!active) return;
      setSchedules(response.data ?? []);
      setError(response.error?.message ?? null);
      setLoading(false);
    }

    void loadSchedules();
    return () => { active = false; };
  }, [driver]);

  const selectedSchedules = useMemo(
    () => schedules.filter((schedule) => getScheduleDateKey(schedule) === getDateKey(selectedDate)),
    [schedules, selectedDate],
  );
  const selectedVehicleIdsKey = useMemo(
    () => [...new Set(selectedSchedules.map((schedule) => schedule.vehicle_id).filter((vehicleId): vehicleId is string => Boolean(vehicleId)))].join(","),
    [selectedSchedules],
  );

  useEffect(() => {
    let active = true;
    const vehicleIds = selectedVehicleIdsKey ? selectedVehicleIdsKey.split(",") : [];

    async function loadVehicles() {
      if (vehicleIds.length === 0) {
        if (active) setVehiclesById({});
        return;
      }
      const responses = await Promise.all(vehicleIds.map(async (vehicleId) => ({ response: await getVehicle(vehicleId), vehicleId })));
      if (!active) return;
      const nextVehicles: Record<string, VehicleSummary> = {};
      responses.forEach(({ response, vehicleId }) => { if (response.data) nextVehicles[vehicleId] = response.data; });
      setVehiclesById(nextVehicles);
    }

    void loadVehicles();
    return () => { active = false; };
  }, [selectedVehicleIdsKey]);

  const weekRange = useMemo(() => getWeekRange(selectedDate), [selectedDate]);
  const weeklySchedules = useMemo(
    () => schedules.filter((schedule) => {
      const key = getScheduleDateKey(schedule);
      return Boolean(key && key >= getDateKey(weekRange.start) && key <= getDateKey(weekRange.end));
    }),
    [schedules, weekRange.end, weekRange.start],
  );
  const conflictIds = useMemo(() => findConflictScheduleIds(weeklySchedules), [weeklySchedules]);
  const dayMarkers = useMemo<ScheduleDayMarker[]>(() => {
    const markers = new Map<string, ScheduleDayMarker>();
    schedules.forEach((schedule) => {
      const date = getScheduleDateKey(schedule);
      if (date && !markers.has(date)) markers.set(date, { color: shiftColors[getShiftTone(schedule)], date });
    });
    return [...markers.values()];
  }, [schedules]);

  return (
    <View style={[styles.container, { backgroundColor: dashboardColors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { gap: sectionGap, paddingBottom: getScrollContentBottomPadding(width, insets.bottom), paddingHorizontal: horizontalPadding, paddingTop: insets.top + dashboardSpacing.scale.md }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.pageTitle} style={[styles.pageTitle, { color: dashboardColors.textPrimary, fontSize: dashboardTypography.largePageTitle.fontSize, fontWeight: dashboardTypography.largePageTitle.fontWeight, lineHeight: dashboardTypography.largePageTitle.lineHeight }]}>Schedule</Text>
          <ProfileButton dashboardIcon />
        </View>

        <View style={styles.summaryRow}>
          <ScheduleSummaryCard color={dashboardColors.accent} count={loading ? null : weeklySchedules.length} iconName="calendar" label="This week" textPrimary={dashboardColors.textPrimary} textSecondary={dashboardColors.textSecondary} title="Weekly schedule" width={width} />
          <ScheduleSummaryCard color={conflictIds.size > 0 ? dashboardColors.danger : dashboardColors.success} count={loading ? null : conflictIds.size} iconName={conflictIds.size > 0 ? "exclamationmark.triangle" : "checkmark.circle"} label={conflictIds.size > 0 ? "Needs attention" : "All clear"} textPrimary={dashboardColors.textPrimary} textSecondary={dashboardColors.textSecondary} title="Schedule conflicts" width={width} />
        </View>

        <View style={[styles.calendarSection, dashboardShadows.subtleCard, { backgroundColor: dashboardColors.surfaceElevated, borderColor: dashboardColors.subtleBorder, borderRadius: cardRadius, padding: cardPadding + dashboardSpacing.scale.xs }]}>
          <View style={styles.sectionHeader}>
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.sectionTitle, { color: dashboardColors.textPrimary }]}>Week schedule</Text>
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.sectionCaption, { color: dashboardColors.textSecondary }]}>Select a day</Text>
          </View>
          <ScheduleWeekSelector markers={dayMarkers} onDateChange={setSelectedDate} selectedDate={selectedDate} textPrimary={dashboardColors.textPrimary} textSecondary={dashboardColors.textSecondary} />
        </View>

        <View style={styles.dailySection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.sectionTitle, { color: dashboardColors.textPrimary }]}>Daily schedule</Text>
              <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.sectionCaption, { color: dashboardColors.textSecondary }]}>{formatSelectedDate(selectedDate)}</Text>
            </View>
            <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.sectionCaption, { color: dashboardColors.textSecondary }]}>{selectedSchedules.length === 1 ? "1 shift" : `${selectedSchedules.length} shifts`}</Text>
          </View>

          {loading ? <View style={styles.loading}><ActivityIndicator color={dashboardColors.accent} /></View> : null}
          {!loading && error ? <EmptyScheduleCard message={error} title="Schedule unavailable" textPrimary={dashboardColors.textPrimary} textSecondary={dashboardColors.textSecondary} /> : null}
          {!loading && !error && selectedSchedules.length === 0 ? <EmptyScheduleCard message="No shifts are assigned for this day." title="No daily schedule" textPrimary={dashboardColors.textPrimary} textSecondary={dashboardColors.textSecondary} /> : null}
          {!loading && !error ? selectedSchedules.map((schedule) => <DailyScheduleCard key={schedule.schedule_id} schedule={schedule} vehicle={schedule.vehicle_id ? vehiclesById[schedule.vehicle_id] ?? null : null} />) : null}
        </View>
      </ScrollView>
      <DashboardScrollEdge topInset={insets.top} />
    </View>
  );
}

function ScheduleSummaryCard({ color, count, iconName, label, textPrimary, textSecondary, title, width }: { color: string; count: number | null; iconName: "calendar" | "checkmark.circle" | "exclamationmark.triangle"; label: string; textPrimary: string; textSecondary: string; title: string; width: number }) {
  const cardRadius = getCardRadius(width);
  const cardPadding = Math.max(14, getCardPadding(width) - 2);
  const dashboardColors = getDashboardColors(useColorScheme());

  return (
    <View style={[styles.summaryCard, dashboardShadows.subtleCard, { backgroundColor: dashboardColors.surfaceElevated, borderColor: dashboardColors.subtleBorder, borderRadius: cardRadius, padding: cardPadding }]}>
      <View style={[styles.summaryIcon, { backgroundColor: `${color}18`}]}>
        <SymbolView fallback={null} name={iconName} size={18} tintColor={color} type="hierarchical" />
      </View>
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.summaryTitle, { color: textSecondary }]}>{title}</Text>
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.metric} style={[styles.summaryCount, { color: textPrimary }]}>{count === null ? "—" : count}</Text>
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.caption} style={[styles.summaryLabel, { color: textSecondary }]}>{label}</Text>
    </View>
  );
}

function EmptyScheduleCard({ message, textPrimary, textSecondary, title }: { message: string; textPrimary: string; textSecondary: string; title: string }) {
  const dashboardColors = getDashboardColors(useColorScheme());
  return (
    <View style={[styles.emptyCard, { backgroundColor: dashboardColors.surfaceElevated, borderColor: dashboardColors.subtleBorder }]}>
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.compactTitle} style={[styles.emptyTitle, { color: textPrimary }]}>{title}</Text>
      <Text maxFontSizeMultiplier={dashboardMaxFontSizeMultipliers.secondary} style={[styles.emptyText, { color: textSecondary }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  calendarSection: { borderWidth: StyleSheet.hairlineWidth, gap: dashboardSpacing.scale.lg },
  container: { flex: 1 },
  content: { width: "100%" },
  dailySection: { gap: dashboardSpacing.scale.md },
  emptyCard: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, gap: 6, padding: 20 },
  emptyText: { fontSize: dashboardTypography.secondary.fontSize, lineHeight: dashboardTypography.secondary.lineHeight },
  emptyTitle: { fontSize: dashboardTypography.compactPageTitle.fontSize, fontWeight: "700", lineHeight: dashboardTypography.compactPageTitle.lineHeight },
  header: { alignItems: "center", flexDirection: "row", gap: dashboardSpacing.scale.md, justifyContent: "space-between" },
  loading: { alignItems: "center", minHeight: 160, justifyContent: "center" },
  pageTitle: { flex: 1 },
  sectionCaption: { fontSize: dashboardTypography.caption.fontSize, lineHeight: dashboardTypography.caption.lineHeight },
  sectionHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  sectionTitle: { fontSize: dashboardTypography.compactPageTitle.fontSize, fontWeight: dashboardTypography.compactPageTitle.fontWeight, lineHeight: dashboardTypography.compactPageTitle.lineHeight },
  summaryCard: { borderWidth: StyleSheet.hairlineWidth, flex: 1, gap: dashboardSpacing.scale.xs, minHeight: 152 },
  summaryCount: { fontSize: dashboardTypography.metric.fontSize, fontWeight: dashboardTypography.metric.fontWeight, lineHeight: dashboardTypography.metric.lineHeight, marginTop: dashboardSpacing.scale.xs },
  summaryIcon: { alignItems: "center", borderRadius: 999, height: 38, justifyContent: "center", marginBottom: dashboardSpacing.scale.xs, width: 38 },
  summaryLabel: { fontSize: dashboardTypography.caption.fontSize, lineHeight: dashboardTypography.caption.lineHeight },
  summaryRow: { flexDirection: "row", gap: dashboardSpacing.scale.md },
  summaryTitle: { fontSize: dashboardTypography.caption.fontSize, fontWeight: "700", lineHeight: dashboardTypography.caption.lineHeight },
});
