import { CameraStream } from "@/components/CameraStream";
import { CaptureButton } from "@/components/CaptureButton";
import { FocusIndicator } from "@/components/FocusIndicator";
import { TopStatusBar } from "@/components/TopStatusBar";
import { Control, ControlType } from "@proto/control";
import * as Haptics from "expo-haptics";
import { Builder } from "flatbuffers";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

const MJPEG_URL = "http://192.168.1.168:8080/live.mjpeg";

const buildMessage = (type: ControlType): Uint8Array => {
  const builder = new Builder(32);
  Control.startControl(builder);
  Control.addType(builder, type);
  const control = Control.endControl(builder);
  builder.finish(control);
  return builder.asUint8Array();
};

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [fps, setFps] = useState(0);
  const [focusBox, setFocusBox] = useState<{ x: number; y: number } | null>(
    null
  );
  const frameTimes = useRef<number[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    wsRef.current = new WebSocket("http://192.168.1.168:8888/ws");
    return () => wsRef.current?.close();
  }, []);

  const sendCommand = (type: ControlType) => {
    console.log(`Sending command: ${ControlType[type]}`);
    const msg = buildMessage(type);
    wsRef.current?.send(msg);
  };

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
        <CameraStream url={MJPEG_URL} onFrame={handleFrame} />
        {focusBox && <FocusIndicator x={focusBox.x} y={focusBox.y} />}
        <CaptureButton onPress={() => sendCommand(ControlType.CAPTURE)} />
        <TopStatusBar fps={fps} />
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
