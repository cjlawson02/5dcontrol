import { ControlType } from "@5dcontrol/proto";
import { Icon, LinearProgress, Text } from "@rneui/themed";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Animated, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraStream } from "../../components/CameraStream";
import { CaptureButton } from "../../components/CaptureButton";
import { GridOverlay } from "../../components/GridOverlay";
import { TopStatusBar } from "../../components/TopStatusBar";
import { useWebSocketContext } from "../../components/WebSocketContext";
import { useSettings } from "../../contexts/SettingsContext";
import { logger } from "../../utils/logger";

export default function HomeScreen() {
  const [fps, setFps] = useState(0);
  const [focusActive, setFocusActive] = useState(false);
  const [captureFlash, setCaptureFlash] = useState(false);
  const frameTimes = useRef<number[]>([]);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const { cameraStatus, ip, sendCommand } = useWebSocketContext();
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

  const openSettings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/settings");
  };

  const handleFrame = () => {
    logger.debug("Frame received");
    const now = Date.now();
    frameTimes.current.push(now);
    frameTimes.current = frameTimes.current.filter((t) => now - t <= 1000);
    setFps(frameTimes.current.length);
  };

  return (
    <View style={styles.container}>
      {cameraStatus !== "connected" ? (
        <SafeAreaView
          style={{
            ...StyleSheet.absoluteFillObject,
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
          <CaptureButton onPress={handleCapture} />

          {/* Focus button */}
          <TouchableOpacity
            style={styles.focusButton}
            onPress={handleFocus}
            activeOpacity={0.7}
          >
            <Icon name="focus-2" type="feather" color="#fff" size={24} />
          </TouchableOpacity>
          <TopStatusBar fps={fps} />

          {/* Settings button */}
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={openSettings}
            activeOpacity={0.7}
          >
            <Icon name="settings" type="feather" color="#fff" size={24} />
          </TouchableOpacity>
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fff",
    zIndex: 100,
    pointerEvents: "none",
  },
  focusIndicator: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
    pointerEvents: "none",
  },
  focusBox: {
    width: 50,
    height: 50,
    borderWidth: 2,
    borderColor: "#00ffff",
    backgroundColor: "transparent",
  },
  focusButton: {
    position: "absolute",
    bottom: 120,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  settingsButton: {
    position: "absolute",
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
});
