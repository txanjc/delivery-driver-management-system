import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getDriverTabDefinition } from "@/components/shared/driverTabs";
import { colors } from "@/theme/shared";

export function DriverTabBar({ descriptors, navigation, state }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.shell, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const options = descriptors[route.key].options;
        const tab = getDriverTabDefinition(route.name);
        const focused = state.index === index;
        const label = tab?.label ?? String(options.tabBarLabel ?? options.title ?? route.name);
        const badge = options.tabBarBadge;
        const badgeLabel = typeof badge === "number" || typeof badge === "string" ? String(badge) : null;

        return (
          <Pressable
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            accessibilityRole="tab"
            accessibilityState={focused ? { selected: true } : {}}
            key={route.key}
            onPress={() => {
              const event = navigation.emit({
                canPreventDefault: true,
                target: route.key,
                type: "tabPress",
              });

              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            }}
            style={styles.item}
          >
            <View style={[styles.iconPill, focused ? styles.iconPillActive : null]}>
              <Text style={[styles.icon, focused ? styles.iconActive : styles.iconInactive]}>{tab?.icon ?? "•"}</Text>
            </View>
            {badgeLabel ? (
              <View accessibilityElementsHidden importantForAccessibility="no" style={styles.badge}>
                <Text style={styles.badgeText}>{badgeLabel}</Text>
              </View>
            ) : null}
            <Text numberOfLines={2} style={[styles.label, focused ? styles.active : styles.inactive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: 72,
    paddingHorizontal: 6,
    paddingTop: 8,
  },
  item: {
    alignItems: "center",
    flex: 1,
    gap: 2,
    justifyContent: "center",
    minHeight: 56,
    minWidth: 44,
    paddingHorizontal: 2,
  },
  iconPill: {
    alignItems: "center",
    borderRadius: 999,
    height: 26,
    justifyContent: "center",
    minWidth: 38,
    paddingHorizontal: 8,
  },
  iconPillActive: {
    backgroundColor: "rgba(109, 74, 255, 0.14)",
  },
  badge: {
    alignItems: "center",
    backgroundColor: "#ef4444",
    borderRadius: 999,
    minHeight: 16,
    minWidth: 16,
    paddingHorizontal: 4,
    position: "absolute",
    right: "28%",
    top: 2,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 16,
    textAlign: "center",
  },
  icon: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 20,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
    textAlign: "center",
  },
  active: {
    color: colors.primary,
  },
  iconActive: {
    color: colors.primary,
  },
  iconInactive: {
    color: "rgba(109, 74, 255, 0.58)",
  },
  inactive: {
    color: colors.muted,
  },
});
