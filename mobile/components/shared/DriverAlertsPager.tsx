import type { ComponentProps } from "react";
import Animated from "react-native-reanimated";
import PagerView from "react-native-pager-view";

export type DriverAlertsPagerHandle = PagerView;
export type DriverAlertsPagerOnPageScrollEvent = Parameters<NonNullable<ComponentProps<typeof PagerView>["onPageScroll"]>>[0];
export type DriverAlertsPagerOnPageSelectedEvent = Parameters<NonNullable<ComponentProps<typeof PagerView>["onPageSelected"]>>[0];

export const DriverAlertsPager = Animated.createAnimatedComponent(PagerView);
