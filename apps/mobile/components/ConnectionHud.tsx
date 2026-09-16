import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ViewfinderGlass } from "./ViewfinderGlass";

type ConnectionHudProps = {
  cameraStatus: string;
  serverStatus: string;
  onReconnect: () => void;
  onDisconnect: () => void;
};

function connectionColor(cameraStatus: string, serverStatus: string): string {
  if (cameraStatus === "connected") return "#4CAF50";
  if (serverStatus === "connected") return "#FFC107";
  return "#F44336";
}

function connectionLabel(cameraStatus: string, serverStatus: string): string {
  if (cameraStatus === "connected") return "Camera";
  if (serverStatus === "connected") return "Server";
  return "Offline";
}

/**
 * Top-left glass wifi pill. Tap to reconnect or return to the connection screen.
 * Not an Expo sheet — those go full-screen on iPhone.
 */
export function ConnectionHud({
  cameraStatus,
  serverStatus,
  onReconnect,
  onDisconnect,
}: ConnectionHudProps) {
  const [open, setOpen] = useState(false);
  const color = connectionColor(cameraStatus, serverStatus);
  const label = connectionLabel(cameraStatus, serverStatus);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setOpen((prev) => !prev);
        }}
        accessibilityRole="button"
        accessibilityLabel="Connection options"
        testID="connection-hud-toggle"
      >
        <ViewfinderGlass
          style={styles.connectionIndicator}
          fallbackStyle={styles.chromeFallback}
          isInteractive
        >
          <Feather name="wifi" color={color} size={20} />
          <Text style={[styles.connectionText, { color }]}>{label}</Text>
        </ViewfinderGlass>
      </Pressable>

      {open ? (
        <ViewfinderGlass
          style={styles.menu}
          fallbackStyle={styles.menuFallback}
          testID="connection-hud-menu"
        >
          <Pressable
            onPress={() => {
              setOpen(false);
              onReconnect();
            }}
            accessibilityRole="button"
            accessibilityLabel="Reconnect"
            testID="connection-hud-reconnect"
            style={styles.menuRow}
          >
            <Text style={styles.menuText}>Reconnect</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setOpen(false);
              onDisconnect();
            }}
            accessibilityRole="button"
            accessibilityLabel="Disconnect"
            testID="connection-hud-disconnect"
            style={styles.menuRow}
          >
            <Text style={styles.menuText}>Disconnect</Text>
          </Pressable>
        </ViewfinderGlass>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
  },
  chromeFallback: {
    backgroundColor: "rgba(144, 144, 144, 0.35)",
  },
  connectionIndicator: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  connectionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  menu: {
    marginTop: 8,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 120,
  },
  menuFallback: {
    backgroundColor: "rgba(20, 20, 20, 0.82)",
  },
  menuRow: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  menuText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
});
