import { StyleSheet, View } from "react-native";
import { GridType } from "../contexts/SettingsContext";

interface GridOverlayProps {
  type: GridType;
  visible: boolean;
}

export function GridOverlay({ type, visible }: GridOverlayProps) {
  if (!visible || type === "none") {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents="none">
      {type === "rule-of-thirds" && <RuleOfThirds />}
      {type === "golden-ratio" && <GoldenRatio />}
    </View>
  );
}

function RuleOfThirds() {
  return (
    <>
      {/* Vertical lines */}
      <View style={[styles.line, { left: "33.33%", height: "100%" }]} />
      <View style={[styles.line, { left: "66.66%", height: "100%" }]} />

      {/* Horizontal lines */}
      <View style={[styles.line, { top: "33.33%", width: "100%" }]} />
      <View style={[styles.line, { top: "66.66%", width: "100%" }]} />
    </>
  );
}

function GoldenRatio() {
  const goldenRatio = 61.8; // 1.618 as percentage
  return (
    <>
      {/* Vertical lines */}
      <View
        style={[styles.line, { left: `${goldenRatio}%`, height: "100%" }]}
      />
      <View
        style={[styles.line, { left: `${100 - goldenRatio}%`, height: "100%" }]}
      />

      {/* Horizontal lines */}
      <View style={[styles.line, { top: `${goldenRatio}%`, width: "100%" }]} />
      <View
        style={[styles.line, { top: `${100 - goldenRatio}%`, width: "100%" }]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  line: {
    position: "absolute",
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    width: 1,
    height: 1,
  },
});
