import { Button } from "@rneui/themed";
import { StyleSheet, View } from "react-native";

export function CaptureButton({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.captureContainer}>
      <View style={styles.captureButtonOuter}>
        <Button
          onPress={onPress}
          buttonStyle={styles.captureButtonInner}
          containerStyle={{ borderRadius: 50 }}
          type="clear"
        />
      </View>
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
