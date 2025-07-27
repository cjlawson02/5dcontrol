import { CameraStream } from "@/components/CameraStream";
import { CaptureButton } from "@/components/CaptureButton";
import { FocusIndicator } from "@/components/FocusIndicator";
import { TopStatusBar } from "@/components/TopStatusBar";
import { useWebSocketContext } from "@/components/WebSocketContext";
import { ControlType } from "@proto/control";
import { LinearProgress, Text } from "@rneui/themed";
import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [fps, setFps] = useState(0);
  const [focusBox, setFocusBox] = useState<{ x: number; y: number } | null>(
    null
  );
  const frameTimes = useRef<number[]>([]);
  const { cameraStatus, ip, sendCommand } = useWebSocketContext();

  const handleFocusTap = (event: any) => {
    const { locationX, locationY } = event.nativeEvent;
    setFocusBox({ x: locationX, y: locationY });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendCommand(ControlType.FOCUS);
    setTimeout(() => setFocusBox(null), 800);
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
      <Pressable style={styles.touchOverlay} onPress={handleFocusTap}>
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
            {focusBox && <FocusIndicator x={focusBox.x} y={focusBox.y} />}
            <CaptureButton onPress={() => sendCommand(ControlType.CAPTURE)} />
            <TopStatusBar fps={fps} />
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  touchOverlay: {
    flex: 1,
  },
});
