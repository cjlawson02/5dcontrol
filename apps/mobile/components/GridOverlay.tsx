import { StyleSheet, View } from "react-native";

type GridType =
  | "none"
  | "rule-of-thirds"
  | "golden-ratio"
  | "center-cross"
  | "diagonal";

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
      {type === "center-cross" && <CenterCross />}
      {type === "diagonal" && <Diagonal />}
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

function CenterCross() {
  return (
    <>
      {/* Vertical center line */}
      <View style={[styles.line, { left: "50%", height: "100%" }]} />

      {/* Horizontal center line */}
      <View style={[styles.line, { top: "50%", width: "100%" }]} />
    </>
  );
}

function Diagonal() {
  return (
    <>
      <View style={styles.diagonalLine1} />
      <View style={styles.diagonalLine2} />
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
  diagonalLine1: {
    position: "absolute",
    width: "141%", // sqrt(2) * 100%
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    top: "50%",
    left: "-20.5%",
    transform: [{ rotate: "45deg" }],
  },
  diagonalLine2: {
    position: "absolute",
    width: "141%",
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    top: "50%",
    left: "-20.5%",
    transform: [{ rotate: "-45deg" }],
  },
});

export type { GridType };
