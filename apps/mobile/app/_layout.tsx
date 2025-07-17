import { ThemeProvider } from "@rneui/themed";
import { Stack } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import { useEffect } from "react";

export default function RootLayout() {
  useEffect(() => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT
    );
  }, []);

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
