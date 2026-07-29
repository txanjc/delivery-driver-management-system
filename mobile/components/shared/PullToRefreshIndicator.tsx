import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

type PullToRefreshIndicatorProps = {
  color: string;
  showPullHint?: boolean;
  topInset: number;
  visible: boolean;
};

const pullCueThreshold = 8;
const refreshTriggerThreshold = 34;

export function usePullToRefreshCue(refreshing: boolean, onRefresh: () => void) {
  const [showPullHint, setShowPullHint] = useState(false);
  const pullDistanceRef = useRef(0);
  const refreshRequestedRef = useRef(false);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const pullDistance = Math.max(0, -event.nativeEvent.contentOffset.y);
      pullDistanceRef.current = pullDistance;

      // Do not re-arm the pull cue until the native scroll view has fully
      // settled. RefreshControl can remain negatively offset for a moment
      // after the request resolves.
      if (pullDistance <= 1) {
        refreshRequestedRef.current = false;
        setShowPullHint((current) => (current ? false : current));
        return;
      }

      const isPulling =
        !refreshing &&
        !refreshRequestedRef.current &&
        pullDistance >= pullCueThreshold;
      setShowPullHint((current) => (current === isPulling ? current : isPulling));
    },
    [refreshing],
  );

  useEffect(() => {
    if (refreshing) {
      setShowPullHint(false);
      return;
    }

  }, [refreshing]);

  const onScrollEndDrag = useCallback(() => {
    if (
      refreshing ||
      refreshRequestedRef.current ||
      pullDistanceRef.current < refreshTriggerThreshold
    ) {
      return;
    }

    refreshRequestedRef.current = true;
    setShowPullHint(false);
    onRefresh();
  }, [onRefresh, refreshing]);

  return { onScroll, onScrollEndDrag, showPullHint };
}

/**
 * A native spinner rendered above the screen chrome while a RefreshControl is
 * active. Some Android device skins draw RefreshControl behind an absolute
 * header/blur layer; this keeps the same native activity indicator visible.
 */
export function PullToRefreshIndicator({
  color,
  topInset,
  visible,
}: PullToRefreshIndicatorProps) {
  if (!visible) return null;

  return (
    <View
      accessibilityLabel="Refreshing"
      accessibilityRole="progressbar"
      pointerEvents="none"
      style={[styles.container, { top: topInset + 8 }]}
    >
      <ActivityIndicator color={color} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 100,
  },
});
