import { Stack } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ConnectionPage from "../components/ConnectionPage";
import {
  WebSocketProvider,
  useWebSocketContext,
} from "../components/WebSocketContext";
import { SettingsProvider } from "../contexts/SettingsContext";

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
    <GestureHandlerRootView style={styles.root}>
      <SettingsProvider>
        <WebSocketProvider>
          <LayoutContent />
        </WebSocketProvider>
      </SettingsProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
