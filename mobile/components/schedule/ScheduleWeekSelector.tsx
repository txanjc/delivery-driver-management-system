import { Pressable, StyleSheet, Text, View } from "react-native";

import { triggerButtonHaptic } from "@/utils/haptics";

export type ScheduleDayMarker = {
  color: string;
  date: string;
};

type ScheduleWeekSelectorProps = {
  markers: ScheduleDayMarker[];
  onDateChange: (date: Date) => void;
  selectedDate: Date;
  textPrimary: string;
  textSecondary: string;
};

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

function isSameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function getWeekDates(selectedDate: Date) {
  const weekdayOffset = (selectedDate.getDay() + 6) % 7;
  const weekStart = addDays(startOfDay(selectedDate), -weekdayOffset);
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function ScheduleWeekSelector({ markers, onDateChange, selectedDate, textPrimary, textSecondary }: ScheduleWeekSelectorProps) {
  const markerMap = new Map(markers.map((marker) => [marker.date, marker.color]));
  const weekDates = getWeekDates(selectedDate);
  const daysInSelectedMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();

  return (
    <View style={styles.calendarContent}>
      <Text accessibilityRole="header" maxFontSizeMultiplier={1.1} style={[styles.dayCount, { color: textPrimary }]}>
        DAY <Text style={styles.dayCountNumber}>{selectedDate.getDate()}</Text><Text style={[styles.dayCountTotal, { color: textSecondary }]}> / {daysInSelectedMonth}</Text>
      </Text>

      <View style={styles.weekRow}>
        {weekDates.map((date) => {
          const selected = isSameDay(date, selectedDate);
          const markerColor = markerMap.get(getDateKey(date));

          return (
            <Pressable
              accessibilityLabel={`${new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" }).format(date)}${selected ? ", selected" : ""}${markerColor ? ", scheduled shift" : ""}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={getDateKey(date)}
              onPress={() => {
                if (selected) return;
                triggerButtonHaptic();
                onDateChange(date);
              }}
              style={({ pressed }) => [styles.day, { opacity: pressed ? 0.68 : 1 }]}
            >
              <Text maxFontSizeMultiplier={1.05} style={[styles.weekday, { color: textSecondary }]}>
                {new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date).toUpperCase()}
              </Text>
              <View style={[styles.datePill, selected ? styles.datePillSelected : styles.datePillUnselected]}>
                <Text maxFontSizeMultiplier={1.1} style={[styles.dayNumber, { color: selected ? "#FFFFFF" : textPrimary }]}>{date.getDate()}</Text>
                <View accessibilityElementsHidden style={[styles.marker, { backgroundColor: markerColor ?? "transparent" }]} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calendarContent: {
    gap: 16,
  },
  day: {
    alignItems: "center",
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  dayCount: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.3,
    lineHeight: 28,
  },
  dayCountNumber: {
    fontSize: 28,
    fontWeight: "800",
  },
  dayCountTotal: {
    fontSize: 16,
    fontWeight: "700",
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 23,
  },
  datePill: {
    alignItems: "center",
    alignSelf: "stretch",
    borderRadius: 18,
    height: 44,
    justifyContent: "center",
  },
  datePillSelected: {
    backgroundColor: "#6D4AFF",
  },
  datePillUnselected: {
    backgroundColor: "rgba(109, 74, 255, 0.1)",
  },
  marker: {
    borderRadius: 999,
    height: 7,
    marginTop: 6,
    width: 7,
  },
  weekday: {
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 14,
  },
  weekRow: {
    flexDirection: "row",
    gap: 6,
  },
});
