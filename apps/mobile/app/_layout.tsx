import { ThemeProvider } from "@rneui/themed";
import { Stack } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { useEffect } from "react";
import ConnectionPage from "../components/ConnectionPage";
import {
  WebSocketProvider,
  useWebSocketContext,
} from "../components/WebSocketContext";

function LayoutContent() {
  const { status } = useWebSocketContext();

  if (status !== "connected") {
    return <ConnectionPage />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  useEffect(() => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT
    );
  }, []);

  return (
    <WebSocketProvider>
      <ThemeProvider>
        <LayoutContent />
      </ThemeProvider>
    </WebSocketProvider>
  );
}
