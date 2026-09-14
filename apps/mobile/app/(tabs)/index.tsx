import { ControlType } from "@5dcontrol/proto";
import { Feather } from "@expo/vector-icons";
import { LinearProgress, Text } from "@rneui/themed";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Animated, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraStream } from "../../components/CameraStream";
import { GridOverlay } from "../../components/GridOverlay";
import { useWebSocketContext } from "../../components/WebSocketContext";
import { useSettings } from "../../contexts/SettingsContext";
import { logger } from "../../utils/logger";

export default function HomeScreen() {
  const [focusActive, setFocusActive] = useState(false);
  const [captureFlash, setCaptureFlash] = useState(false);
  const frameTimes = useRef<number[]>([]);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { cameraStatus, ip, sendCommand, status, batteryLevel } = useWebSocketContext();
  const { state: settings } = useSettings();

  const handleFocus = () => {
    // Don't allow focus if camera is not connected
    if (cameraStatus !== "connected") {
      return;
    }

    setFocusActive(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendCommand(ControlType.FOCUS);
    setTimeout(() => setFocusActive(false), 800);
  };

  const handleCapture = () => {
    // Medium impact haptic for capture
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Send capture command
    sendCommand(ControlType.CAPTURE);

    // Trigger flash animation
    setCaptureFlash(true);
    Animated.sequence([
      Animated.timing(flashOpacity, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(flashOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCaptureFlash(false);
      // Success haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  };

  const handleCapturePressIn = () => {
    if (cameraStatus !== "connected") {
      return;
    }
    // Start timer for long press (focus)
    pressTimer.current = setTimeout(() => {
      handleFocus();
      pressTimer.current = null;
    }, 300); // 300ms for long press
  };

  const handleCapturePressOut = () => {
    if (cameraStatus !== "connected") {
      return;
    }
    // If timer is still active, it was a short press (capture)
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
      handleCapture();
    }
  };

  const openSettings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/settings");
  };

  const handleFrame = () => {
    logger.debug("Frame received");
    const now = Date.now();
    frameTimes.current.push(now);
    frameTimes.current = frameTimes.current.filter((t) => now - t <= 1000);
  };

  const getBatteryColor = (level: number) => {
    if (level > 50) return "#4CAF50"; // Green
    if (level > 20) return "#FFC107"; // Yellow/Amber
    return "#F44336"; // Red
  };

  const getConnectionColor = () => {
    if (cameraStatus === "connected") return "#4CAF50"; // Green
    if (status === "connected") return "#FFC107"; // Yellow - server connected but camera disconnected
    return "#F44336"; // Red - fully disconnected
  };

  return (
    <View style={styles.container}>
      {cameraStatus !== "connected" ? (
        <SafeAreaView
          style={{
            ...StyleSheet.absoluteFill,
            backgroundColor: "black",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 200,
          }}
        >
          <Text
            style={{
              color: "white",
              fontSize: 30,
              marginBottom: 5,
            }}
          >
            Camera Disconnected
          </Text>
          <Text
            style={{
              color: "white",
              fontSize: 18,
              marginBottom: 20,
            }}
          >
            Please ensure the camera is powered on and connected to the
            5DControl.
          </Text>
          <LinearProgress />
        </SafeAreaView>
      ) : (
        <>
          <CameraStream
            url={`http://${ip}:8080/live.mjpeg`}
            onFrame={handleFrame}
          />
          <GridOverlay type={settings.gridType} visible={true} />
          {focusActive && (
            <View style={styles.focusIndicator}>
              <View style={styles.focusBox} />
            </View>
          )}
          {captureFlash && (
            <Animated.View
              style={[styles.captureFlash, { opacity: flashOpacity }]}
            />
          )}

          {/* Top-left connection status and camera mode */}
          <View style={styles.leftNav}>
            <View style={styles.connectionIndicator}>
              <Feather
                name="wifi"
                color={getConnectionColor()}
                size={20}
              />
              <Text style={[styles.connectionText, { color: getConnectionColor() }]}>
                {cameraStatus === "connected" ? "Camera" : status === "connected" ? "Server" : "Offline"}
              </Text>
            </View>
          </View>

          {/* Right side navigation - consolidated */}
          <View style={styles.rightNav}>
            {/* Battery indicator */}
            <View style={styles.batteryIndicator}>
              <Feather
                name="battery-charging"
                color={getBatteryColor(batteryLevel)}
                size={20}
              />
              <Text style={[styles.batteryText, { color: getBatteryColor(batteryLevel) }]}>
                {batteryLevel}%
              </Text>
            </View>

            {/* Settings */}
            <TouchableOpacity
              style={styles.navButton}
              onPress={openSettings}
              activeOpacity={0.7}
            >
              <Feather name="settings" color="#fff" size={24} />
            </TouchableOpacity>

            {/* Capture/Focus button */}
            <TouchableOpacity
              style={styles.captureButton}
              onPressIn={handleCapturePressIn}
              onPressOut={handleCapturePressOut}
              activeOpacity={0.9}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>

            {/* Gallery */}
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => router.push("/gallery")}
              activeOpacity={0.7}
            >
              <Feather name="grid" color="#fff" size={24} />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  captureFlash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#fff",
    zIndex: 100,
    pointerEvents: "none",
  },
  focusIndicator: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
    pointerEvents: "none",
  },
  focusBox: {
    width: 70,
    height: 70,
    borderWidth: 5,
    borderColor: "#fff",
    backgroundColor: "transparent",
  },
  leftNav: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 20,
    flexDirection: "column",
    zIndex: 10,
    alignItems: "center",
  },
  rightNav: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 20,
    flexDirection: "column",
    justifyContent: "space-evenly",
    zIndex: 10,
    alignItems: "center",
  },
  navButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(144, 144, 144, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  connectionIndicator: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  connectionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  batteryIndicator: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  batteryText: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  captureButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#ff4444",
  },
});
