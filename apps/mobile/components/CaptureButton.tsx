import { Pressable, StyleSheet, View } from "react-native";

export function CaptureButton({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.captureContainer}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={styles.captureButtonOuter}
      >
        <View style={styles.captureButtonInner} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  captureContainer: {
    position: "absolute",
    right: 30,
    bottom: "50%",
    transform: [{ translateY: 40 }],
  },
  captureButtonOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#ff4444",
  },
});
