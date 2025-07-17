import { StyleSheet, View } from "react-native";

export function FocusIndicator({ x, y }: { x: number; y: number }) {
  return <View style={[styles.focusBox, { left: x - 25, top: y - 25 }]} />;
}

const styles = StyleSheet.create({
  focusBox: {
    position: "absolute",
    width: 50,
    height: 50,
    borderWidth: 2,
    borderColor: "#00ffcc",
    borderRadius: 4,
    zIndex: 10,
  },
});
