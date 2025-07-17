import { StyleSheet, Text, View } from "react-native";

export function TopStatusBar({
  fps,
  batteryLevel = 82,
}: {
  fps: number;
  batteryLevel?: number;
}) {
  const getSignalBars = (fps: number) => {
    if (fps >= 20) return "📶📶📶";
    if (fps >= 10) return "📶📶▫️";
    if (fps >= 5) return "📶▫️▫️";
    return "▫️▫️▫️";
  };

  return (
    <View style={styles.topOverlay}>
      <Text style={styles.infoText}>🔋 {batteryLevel}%</Text>
      <Text style={styles.infoText}>{getSignalBars(fps)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topOverlay: {
    position: "absolute",
    top: 20,
    right: 20,
    flexDirection: "column",
    alignItems: "flex-end",
    zIndex: 10,
  },
  infoText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginBottom: 4,
  },
});
