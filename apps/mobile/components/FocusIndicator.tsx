import { StyleSheet, View } from "react-native";

type FocusIndicatorProps = {
  x: number;
  y: number;
  /** When true, ignore x/y and center on the viewfinder. */
  centered?: boolean;
};

export function FocusIndicator({ x, y, centered }: FocusIndicatorProps) {
  if (centered) {
    return (
      <View style={styles.centeredHost} pointerEvents="none">
        <View testID="focus-indicator" style={styles.focusBoxCentered} />
      </View>
    );
  }

  return (
    <View
      testID="focus-indicator"
      style={[styles.focusBox, { left: x - 25, top: y - 25 }]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  centeredHost: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },
  focusBox: {
    position: "absolute",
    width: 50,
    height: 50,
    borderWidth: 2,
    borderColor: "#00ffcc",
    borderRadius: 4,
    zIndex: 50,
  },
  focusBoxCentered: {
    width: 70,
    height: 70,
    borderWidth: 5,
    borderColor: "#fff",
    backgroundColor: "transparent",
  },
});
