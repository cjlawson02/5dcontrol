import { createTheme, ThemeProvider } from "@rneui/themed";
import { Stack } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { useEffect } from "react";
import ConnectionPage from "../components/ConnectionPage";
import {
  WebSocketProvider,
  useWebSocketContext,
} from "../components/WebSocketContext";
import { SettingsProvider } from "../contexts/SettingsContext";

// Stable reference — ThemeProvider's default `createTheme({})` is a new object
// every render and its useEffect([theme]) then loops ("Maximum update depth").
const appTheme = createTheme({});

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
    <SettingsProvider>
      <WebSocketProvider>
        <ThemeProvider theme={appTheme}>
          <LayoutContent />
        </ThemeProvider>
      </WebSocketProvider>
    </SettingsProvider>
  );
}
