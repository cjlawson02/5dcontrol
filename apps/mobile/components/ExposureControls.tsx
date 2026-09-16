import { SettingField } from "@5dcontrol/proto";
import * as Haptics from "expo-haptics";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { ViewfinderGlass } from "./ViewfinderGlass";
import type {
  AvailableExposureSettings,
  CameraExposureSettings,
} from "./WebSocketContext";

/**
 * Viewfinder exposure HUD.
 *
 * Design: a single glass pill docked in the bottom thumb zone reads out
 * ISO / Tv / Av. Tapping a segment arms it and expands a horizontal value
 * rail directly above, snapping through the camera's discrete option list.
 * Nothing is presented modally — the live frame stays fully visible, which
 * is the whole point of a remote viewfinder.
 *
 * Separate from app grid settings (`settings.tsx`).
 */

const ACCENT = "#FFD60A";
const ITEM_WIDTH = 62;

type ExposureControlsProps = {
  current: CameraExposureSettings | null;
  available: AvailableExposureSettings | null;
  onSet: (field: SettingField, value: string) => void;
  disabled?: boolean;
};

type ArmedControl = {
  field: SettingField;
  label: string;
  options: string[];
  /** Live value while scrubbing — may lead the server echo. */
  value: string;
};

function indexOfOption(options: string[], value: string): number {
  const i = options.indexOf(value);
  return i >= 0 ? i : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

type ValueRailProps = {
  options: string[];
  value: string;
  width: number;
  onPreview: (value: string) => void;
  onCommit: (value: string) => void;
};

/**
 * Snap-scrolling list of discrete values with a fixed center detent.
 * Ticks haptically as values pass the detent, commits once motion settles.
 */
function ValueRail({
  options,
  value,
  width,
  onPreview,
  onCommit,
}: ValueRailProps) {
  const scrollRef = useRef<ScrollView>(null);
  const selectedIndex = indexOfOption(options, value);
  const settledIndex = useRef(selectedIndex);
  const sidePadding = Math.max((width - ITEM_WIDTH) / 2, 0);

  // Frozen at mount. `contentOffset` is re-applied whenever it changes, so
  // deriving it from the live value would yank the scroll mid-drag. The rail
  // is keyed per field, so it remounts with the right value already centered.
  const initialOffset = useRef({
    x: indexOfOption(options, value) * ITEM_WIDTH,
    y: 0,
  }).current;

  const indexAt = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) =>
      clamp(
        Math.round(event.nativeEvent.contentOffset.x / ITEM_WIDTH),
        0,
        options.length - 1
      ),
    [options.length]
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = indexAt(event);
      if (next === settledIndex.current) return;
      settledIndex.current = next;
      Haptics.selectionAsync();
      onPreview(options[next]);
    },
    [indexAt, onPreview, options]
  );

  const handleSettle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = indexAt(event);
      settledIndex.current = next;
      onCommit(options[next]);
    },
    [indexAt, onCommit, options]
  );

  // A flick still has momentum to run; let onMomentumScrollEnd commit instead.
  const handleDragEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (Math.abs(event.nativeEvent.velocity?.x ?? 0) > 0.05) return;
      handleSettle(event);
    },
    [handleSettle]
  );

  const handleTap = useCallback(
    (index: number) => {
      settledIndex.current = index;
      Haptics.selectionAsync();
      onPreview(options[index]);
      onCommit(options[index]);
      scrollRef.current?.scrollTo({ x: index * ITEM_WIDTH, animated: true });
    },
    [onCommit, onPreview, options]
  );

  return (
    <ViewfinderGlass
      style={[styles.rail, { width }]}
      fallbackStyle={styles.railFallback}
      testID="exposure-rail"
    >
      <View pointerEvents="none" style={styles.detent} />
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        // Between "fast" (0.9, overshoots nothing but kills flicks) and
        // "normal" (0.998, drifts past the value you aimed at).
        decelerationRate={0.95}
        snapToInterval={ITEM_WIDTH}
        snapToAlignment="start"
        contentOffset={initialOffset}
        contentContainerStyle={{ paddingHorizontal: sidePadding }}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleSettle}
        onScrollEndDrag={handleDragEnd}
      >
        {options.map((option, index) => (
          <Pressable
            key={option}
            onPress={() => handleTap(index)}
            accessibilityRole="button"
            accessibilityState={{ selected: index === selectedIndex }}
            testID={`exposure-rail-option-${option}`}
            style={styles.railItem}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.railItemText,
                index === selectedIndex && styles.railItemTextActive,
              ]}
            >
              {option}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </ViewfinderGlass>
  );
}

type SegmentProps = {
  label: string;
  value: string;
  armed: boolean;
  disabled: boolean;
  onPress: () => void;
  testID: string;
};

function Segment({
  label,
  value,
  armed,
  disabled,
  onPress,
  testID,
}: SegmentProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
      accessibilityState={{ expanded: armed, disabled }}
      testID={testID}
      style={styles.segment}
    >
      <Text style={[styles.segmentLabel, armed && styles.segmentLabelArmed]}>
        {label}
      </Text>
      <Text
        style={[
          styles.segmentValue,
          armed && styles.segmentValueArmed,
          disabled && styles.segmentValueDisabled,
        ]}
      >
        {value || "—"}
      </Text>
    </Pressable>
  );
}

export function ExposureControls({
  current,
  available,
  onSet,
  disabled,
}: ExposureControlsProps) {
  const [armed, setArmed] = useState<ArmedControl | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  const railWidth = Math.min(windowWidth - 32, 420);

  const toggle = useCallback(
    (field: SettingField, label: string, options: string[], value: string) => {
      if (disabled || options.length < 2) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setArmed((prev) =>
        prev?.field === field ? null : { field, label, options, value }
      );
    },
    [disabled]
  );

  const dismiss = useCallback(() => setArmed(null), []);

  const handlePreview = useCallback((value: string) => {
    setArmed((prev) => (prev ? { ...prev, value } : prev));
  }, []);

  const handleCommit = useCallback(
    (value: string) => {
      setArmed((prev) => {
        if (prev && prev.value !== value) {
          return { ...prev, value };
        }
        return prev;
      });
      if (armed) {
        onSet(armed.field, value);
      }
    },
    [armed, onSet]
  );

  const readout = useMemo(() => {
    if (!current) return null;
    const override = (field: SettingField, fallback: string) =>
      armed?.field === field ? armed.value : fallback;
    return {
      iso: override(SettingField.ISO, current.iso),
      shutter: override(SettingField.SHUTTER_SPEED, current.shutterSpeed),
      aperture: override(SettingField.APERTURE, current.aperture),
    };
  }, [armed, current]);

  if (!current || !readout) {
    return null;
  }

  const isos = available?.isos ?? [];
  const tvs = available?.shutterSpeeds ?? [];
  const avs = available?.apertures ?? [];

  return (
    <>
      {armed ? (
        <Pressable
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Close exposure control"
          testID="exposure-scrim"
          style={styles.scrim}
        />
      ) : null}

      <View style={styles.dock} pointerEvents="box-none">
        {armed ? (
          <ValueRail
            // Remount per field so the rail opens centered on that value.
            key={armed.field}
            options={armed.options}
            value={armed.value}
            width={railWidth}
            onPreview={handlePreview}
            onCommit={handleCommit}
          />
        ) : null}

        <ViewfinderGlass
          style={styles.pill}
          fallbackStyle={styles.pillFallback}
          testID="exposure-controls"
        >
          <Segment
            label="ISO"
            value={readout.iso}
            armed={armed?.field === SettingField.ISO}
            disabled={!!disabled || isos.length < 2}
            onPress={() =>
              toggle(SettingField.ISO, "ISO", isos, readout.iso)
            }
            testID="exposure-iso-chip"
          />
          <View style={styles.divider} />
          <Segment
            label="TV"
            value={readout.shutter}
            armed={armed?.field === SettingField.SHUTTER_SPEED}
            disabled={!!disabled || tvs.length < 2}
            onPress={() =>
              toggle(
                SettingField.SHUTTER_SPEED,
                "Shutter",
                tvs,
                readout.shutter
              )
            }
            testID="exposure-shutter-chip"
          />
          <View style={styles.divider} />
          <Segment
            label="AV"
            value={readout.aperture}
            armed={armed?.field === SettingField.APERTURE}
            disabled={!!disabled || avs.length < 2}
            onPress={() =>
              toggle(SettingField.APERTURE, "Aperture", avs, readout.aperture)
            }
            testID="exposure-aperture-chip"
          />
        </ViewfinderGlass>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 19,
  },
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: "center",
    gap: 12,
    zIndex: 20,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    paddingHorizontal: 6,
    overflow: "hidden",
  },
  pillFallback: {
    backgroundColor: "rgba(18, 18, 18, 0.72)",
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 26,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  segment: {
    minWidth: 76,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentLabel: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  segmentLabelArmed: {
    color: ACCENT,
  },
  segmentValue: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    marginTop: 1,
  },
  segmentValueArmed: {
    color: ACCENT,
  },
  segmentValueDisabled: {
    color: "rgba(255, 255, 255, 0.35)",
  },
  rail: {
    height: 62,
    borderRadius: 18,
    justifyContent: "center",
    overflow: "hidden",
  },
  railFallback: {
    backgroundColor: "rgba(18, 18, 18, 0.72)",
  },
  detent: {
    position: "absolute",
    alignSelf: "center",
    width: ITEM_WIDTH - 8,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 214, 10, 0.9)",
    backgroundColor: "rgba(255, 214, 10, 0.12)",
    zIndex: 1,
  },
  railItem: {
    width: ITEM_WIDTH,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
  },
  railItemText: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  railItemTextActive: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
});
