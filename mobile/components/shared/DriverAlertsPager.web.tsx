import { forwardRef, useImperativeHandle, useState } from "react";
import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

export type DriverAlertsPagerHandle = {
  setPage: (page: number) => void;
  setPageWithoutAnimation: (page: number) => void;
};

export type DriverAlertsPagerOnPageScrollEvent = {
  nativeEvent: { offset: number; position: number };
};

export type DriverAlertsPagerOnPageSelectedEvent = {
  nativeEvent: { position: number };
};

type DriverAlertsPagerProps = PropsWithChildren<{
  initialPage: number;
  onPageScroll?: (event: DriverAlertsPagerOnPageScrollEvent) => void;
  onPageSelected?: (event: DriverAlertsPagerOnPageSelectedEvent) => void;
  overdrag?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export const DriverAlertsPager = forwardRef<DriverAlertsPagerHandle, DriverAlertsPagerProps>(function DriverAlertsPager({ children, initialPage, onPageScroll, onPageSelected, style }, ref) {
  const pages = Array.isArray(children) ? children : [children];
  const [page, setPage] = useState(() => Math.max(0, Math.min(initialPage, pages.length - 1)));

  function selectPage(nextPage: number) {
    const safePage = Math.max(0, Math.min(nextPage, pages.length - 1));
    setPage(safePage);
    onPageScroll?.({ nativeEvent: { offset: 0, position: safePage } });
    onPageSelected?.({ nativeEvent: { position: safePage } });
  }

  useImperativeHandle(ref, () => ({ setPage: selectPage, setPageWithoutAnimation: selectPage }), [pages.length]);

  return <View style={[styles.pager, style]}>{pages[page] ?? null}</View>;
});

const styles = StyleSheet.create({ pager: { flex: 1 } });
