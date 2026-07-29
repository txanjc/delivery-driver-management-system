import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { triggerButtonHaptic } from "@/utils/haptics";

export type ScheduleDayMarker = {
  color: string;
  date: string;
};

const dialDigitHeight = 20;

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
  const weekStart = addDays(startOfDay(selectedDate), -selectedDate.getDay());
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function MechanicalDigit({ color, digit }: { color: string; digit: string }) {
  const priorDigitRef = useRef(digit);
  const [priorDigit, setPriorDigit] = useState(digit);
  const progress = useSharedValue(1);

  useEffect(() => {
    if (priorDigitRef.current === digit) return;

    setPriorDigit(priorDigitRef.current);
    priorDigitRef.current = digit;
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: 190,
      easing: Easing.out(Easing.cubic),
    });
  }, [digit, progress]);

  const outgoingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.8, 1], [1, 0.8, 0]),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -dialDigitHeight]) }],
  }));
  const incomingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.2, 1], [0.8, 1, 1]),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [dialDigitHeight, 0]) }],
  }));

  return (
    <View style={styles.dialDigit}>
      <Animated.Text maxFontSizeMultiplier={1.1} style={[styles.dayCountNumber, styles.dialText, { color }, outgoingStyle]}>{priorDigit}</Animated.Text>
      <Animated.Text maxFontSizeMultiplier={1.1} style={[styles.dayCountNumber, styles.dialText, { color }, incomingStyle]}>{digit}</Animated.Text>
    </View>
  );
}

function MechanicalDayNumber({ color, day }: { color: string; day: number }) {
  return (
    <View accessibilityElementsHidden style={styles.dialNumber}>
      {String(day).split("").map((digit, index) => <MechanicalDigit color={color} digit={digit} key={index} />)}
    </View>
  );
}

export function ScheduleWeekSelector({ markers, onDateChange, selectedDate, textPrimary, textSecondary }: ScheduleWeekSelectorProps) {
  const markerMap = new Map(markers.map((marker) => [marker.date, marker.color]));
  const weekDates = getWeekDates(selectedDate);
  const daysInSelectedMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();

  return (
    <View style={styles.calendarContent}>
      <View accessibilityLabel={"Day " + selectedDate.getDate() + " of " + daysInSelectedMonth} accessibilityRole="header" style={styles.dayCount}>
        <Text maxFontSizeMultiplier={1.1} style={[styles.dayCountLabel, { color: textPrimary }]}>DAY</Text>
        <MechanicalDayNumber color={textPrimary} day={selectedDate.getDate()} />
        <Text maxFontSizeMultiplier={1.1} style={[styles.dayCountTotal, { color: textSecondary }]}>/ {daysInSelectedMonth}</Text>
      </View>

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
              <View style={[styles.dateCircle, selected ? styles.dateCircleSelected : styles.dateCircleUnselected]}>
                <Text maxFontSizeMultiplier={1.1} style={[styles.dayNumber, { color: selected ? "#FFFFFF" : textPrimary }]}>{date.getDate()}</Text>
              </View>
              <View accessibilityElementsHidden style={[styles.marker, { backgroundColor: markerColor ?? "transparent" }]} />
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
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  dayCountLabel: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.3,
    lineHeight: 28,
  },
  dayCountNumber: {
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 20,
  },
  dayCountTotal: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  dialDigit: {
    height: dialDigitHeight,
    overflow: "hidden",
    width: 11,
  },
  dialNumber: {
    flexDirection: "row",
  },
  dialText: {
    left: 0,
    position: "absolute",
    top: 0,
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 23,
  },
  dateCircle: {
    alignItems: "center",
    borderRadius: 999,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  dateCircleSelected: {
    backgroundColor: "#6D4AFF",
  },
  dateCircleUnselected: {
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
