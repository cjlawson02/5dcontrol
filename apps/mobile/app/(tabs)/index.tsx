import { CameraStream } from "@/components/CameraStream";
import { CaptureButton } from "@/components/CaptureButton";
import { FocusIndicator } from "@/components/FocusIndicator";
import { GridOverlay, GridType } from "@/components/GridOverlay";
import { TopStatusBar } from "@/components/TopStatusBar";
import { useWebSocketContext } from "@/components/WebSocketContext";
import { ControlType } from "@proto/control";
import { Icon, LinearProgress, Text } from "@rneui/themed";
import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import { Animated, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [fps, setFps] = useState(0);
  const [focusBox, setFocusBox] = useState<{ x: number; y: number } | null>(
    null
  );
  const [gridType, setGridType] = useState<GridType>("none");
  const [captureFlash, setCaptureFlash] = useState(false);
  const frameTimes = useRef<number[]>([]);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const { cameraStatus, ip, sendCommand } = useWebSocketContext();

  const handleFocusTap = (x: number, y: number) => {
    // Don't allow focus if camera is not connected
    if (cameraStatus !== "connected") {
      return;
    }

    setFocusBox({ x, y });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendCommand(ControlType.FOCUS);
    setTimeout(() => setFocusBox(null), 800);
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

  const cycleGrid = () => {
    const grids: GridType[] = [
      "none",
      "rule-of-thirds",
      "golden-ratio",
      "center-cross",
      "diagonal",
    ];
    const currentIndex = grids.indexOf(gridType);
    const nextIndex = (currentIndex + 1) % grids.length;
    setGridType(grids[nextIndex]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleFrame = () => {
    console.log("Frame received");
    const now = Date.now();
    frameTimes.current.push(now);
    frameTimes.current = frameTimes.current.filter((t) => now - t <= 1000);
    setFps(frameTimes.current.length);
    if (loading) setLoading(false);
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
            onTap={handleFocusTap}
          />
          <GridOverlay type={gridType} visible={true} />
          {focusBox && <FocusIndicator x={focusBox.x} y={focusBox.y} />}
          {captureFlash && (
            <Animated.View
              style={[styles.captureFlash, { opacity: flashOpacity }]}
            />
          )}
          <CaptureButton onPress={handleCapture} />
          <TopStatusBar fps={fps} />

          {/* Grid toggle button */}
          <TouchableOpacity
            style={styles.gridButton}
            onPress={cycleGrid}
            activeOpacity={0.7}
          >
            <Icon
              name="grid"
              type="feather"
              color={gridType === "none" ? "#888" : "#00ffcc"}
              size={24}
            />
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
  gridButton: {
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
