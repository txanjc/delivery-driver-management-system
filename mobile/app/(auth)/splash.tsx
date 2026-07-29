import { SymbolView } from "expo-symbols";
import { useRouter } from "expo-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Image, ImageBackground, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/hooks/useAuth";
import { triggerButtonHaptic } from "@/utils/haptics";

const SPLASH_IMAGES = [
  {
    description: "Keep packages moving efficiently from the warehouse to their next destination.",
    id: "warehouse",
    source: require("../../assets/images/splash/warehouse-delivery.png"),
    title: "Built for Every Delivery",
  },
  {
    description: "Access delivery details, updates, and directions while managing every stop with confidence.",
    id: "road",
    source: require("../../assets/images/splash/driver-package.png"),
    title: "Stay Connected on the Road",
  },
  {
    description: "Complete deliveries accurately, stay organized, and provide reliable service every time.",
    id: "confidence",
    source: require("../../assets/images/splash/delivery-van.png"),
    title: "Deliver with Confidence",
  },
] as const;

// The final duplicate gives the automatic carousel a forward-only path from
// the third image back to the first. It resets invisibly after that page lands.
const CAROUSEL_IMAGES = [...SPLASH_IMAGES, { ...SPLASH_IMAGES[0], id: "warehouse-loop" }] as const;
const SLIDE_VISIBLE_MS = 3000;

type SplashImage = (typeof CAROUSEL_IMAGES)[number];

const SplashImageSlide = memo(function SplashImageSlide({ copyBottom, image, width }: { copyBottom: number; image: SplashImage; width: number }) {
  return (
    <View style={[styles.slide, { width }]}>
      <ImageBackground fadeDuration={0} resizeMode="cover" source={image.source} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={[styles.copy, { bottom: copyBottom }]}>
        <Text style={styles.title}>{image.title}</Text>
        <Text style={styles.description}>{image.description}</Text>
      </View>
    </View>
  );
});

export default function SplashScreen() {
  const { bottom, top } = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { driver, loading, mfaRequired, session } = useAuth();
  const listRef = useRef<FlatList<SplashImage>>(null);
  const activeIndexRef = useRef(0);
  const isLeavingRef = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const startControlBottom = Math.max(bottom, 22) + 18;
  const [pageWidth, setPageWidth] = useState(width);
  const copyBottom = startControlBottom + 58 + 26;

  const clearAdvanceTimer = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = undefined;
  }, []);

  const scheduleAdvance = useCallback(() => {
    clearAdvanceTimer();
    refreshTimerRef.current = setTimeout(() => {
      if (isLeavingRef.current) return;
      const nextIndex = activeIndexRef.current + 1;
      listRef.current?.scrollToOffset({ animated: true, offset: nextIndex * pageWidth });
    }, SLIDE_VISIBLE_MS);
  }, [clearAdvanceTimer, pageWidth]);

  useEffect(() => {
    void Promise.all(
      SPLASH_IMAGES.map((image) => {
        const { uri } = Image.resolveAssetSource(image.source);
        return Image.prefetch(uri);
      }),
    );
  }, []);

  useEffect(() => {
    if (loading) return;
    if (session && driver) {
      router.replace("/(driver)/(tabs)");
      return;
    }
    if (session && mfaRequired) router.replace("/(auth)/login");
  }, [driver, loading, mfaRequired, router, session]);

  useEffect(() => {
    listRef.current?.scrollToOffset({ animated: false, offset: activeIndexRef.current * pageWidth });
    scheduleAdvance();

    return clearAdvanceTimer;
  }, [clearAdvanceTimer, pageWidth, scheduleAdvance]);

  const handleMomentumScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const rawIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    const isLoopPage = rawIndex === CAROUSEL_IMAGES.length - 1;
    activeIndexRef.current = isLoopPage ? 0 : rawIndex;

    if (isLoopPage) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ animated: false, offset: 0 });
      });
    }

    scheduleAdvance();
  }, [pageWidth, scheduleAdvance]);

  const handleStart = useCallback(() => {
    if (loading || isLeavingRef.current) return;

    isLeavingRef.current = true;
    clearAdvanceTimer();
    router.replace("/(auth)/login");
  }, [clearAdvanceTimer, loading, router]);

  const renderItem = useCallback(
    ({ item }: { item: SplashImage }) => <SplashImageSlide copyBottom={copyBottom} image={item} width={pageWidth} />,
    [copyBottom, pageWidth],
  );

  const handleCarouselLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth > 0) setPageWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
  }, []);

  return (
    <View style={styles.screen}>
      <FlatList
        bounces={false}
        data={CAROUSEL_IMAGES}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({ index, length: pageWidth, offset: pageWidth * index })}
        horizontal
        initialNumToRender={1}
        keyExtractor={(item) => item.id}
        maxToRenderPerBatch={1}
        onMomentumScrollBegin={clearAdvanceTimer}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        onLayout={handleCarouselLayout}
        overScrollMode="never"
        pagingEnabled
        ref={listRef}
        removeClippedSubviews
        renderItem={renderItem}
        scrollEnabled={false}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        style={StyleSheet.absoluteFill}
        windowSize={2}
      />

      <View pointerEvents="none" style={[styles.staticHeader, { paddingTop: top + 20 }]}>
        <Image
          accessibilityLabel="DeliverEaze Logistics"
          fadeDuration={0}
          resizeMode="contain"
          source={require("../../assets/images/delivereaze-logo-splash-white.png")}
          style={styles.logo}
        />
      </View>

      <View style={[styles.staticStart, { paddingBottom: startControlBottom }]}>
        <Pressable
          accessibilityLabel="Start DeliverEaze driver sign in"
          accessibilityRole="button"
          disabled={loading}
          onPress={handleStart}
          onPressIn={triggerButtonHaptic}
          style={({ pressed }) => [styles.startControl, { opacity: pressed || loading ? 0.76 : 1 }]}
        >
          <View style={styles.startIcon}>
            <SymbolView fallback={null} name="arrow.right" size={18} tintColor="#28145A" type="hierarchical" />
          </View>
          <Text style={styles.startText}>Start</Text>
          <SymbolView fallback={null} name="chevron.right" size={16} tintColor="rgba(255,255,255,0.76)" type="hierarchical" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  copy: { left: 28, position: "absolute", right: 28 },
  description: { color: "rgba(255,255,255,0.88)", fontSize: 18, lineHeight: 26, marginTop: 14, textShadowColor: "rgba(0,0,0,0.34)", textShadowRadius: 8 },
  logo: { height: 69, width: 206 },
  screen: { backgroundColor: "#26065A", flex: 1 },
  slide: { flex: 1, overflow: "hidden" },
  startControl: { alignItems: "center", alignSelf: "center", backgroundColor: "rgba(255,255,255,0.16)", borderColor: "rgba(255,255,255,0.24)", borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: 22, minHeight: 58, paddingHorizontal: 10, width: 236 },
  startIcon: { alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 999, height: 42, justifyContent: "center", width: 42 },
  startText: { color: "#FFFFFF", flex: 1, fontSize: 16, fontWeight: "800", textAlign: "center" },
  staticHeader: { alignItems: "center", left: 0, position: "absolute", right: 0, top: 0 },
  staticStart: { bottom: 0, left: 0, position: "absolute", right: 0 },
  title: { color: "#FFFFFF", fontSize: 39, fontWeight: "800", letterSpacing: -1, lineHeight: 45, textShadowColor: "rgba(0,0,0,0.34)", textShadowRadius: 10 },
});
