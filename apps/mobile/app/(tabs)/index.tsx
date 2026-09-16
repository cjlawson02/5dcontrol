import { ControlType } from "@5dcontrol/proto";
import { Button, Column, Host, Text } from "@expo/ui";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraStream } from "../../components/CameraStream";
import { ConnectionHud } from "../../components/ConnectionHud";
import { ExposureControls } from "../../components/ExposureControls";
import { FocusIndicator } from "../../components/FocusIndicator";
import { GridOverlay } from "../../components/GridOverlay";
import {
  ViewfinderGlass,
  ViewfinderGlassContainer,
} from "../../components/ViewfinderGlass";
import { useWebSocketContext } from "../../components/WebSocketContext";
import { useSettings } from "../../contexts/SettingsContext";
import {
  downloadCaptureStill,
  GalleryImage,
  mediaUrlForIp,
} from "../../utils/galleryCache";
import { logger } from "../../utils/logger";
import { liveViewUrlForHost } from "../../utils/serverEndpoints";

export default function HomeScreen() {
  const [focusActive, setFocusActive] = useState(false);
  const [focusTarget, setFocusTarget] = useState<{
    x: number;
    y: number;
    centered: boolean;
  } | null>(null);
  const [lastThumb, setLastThumb] = useState<GalleryImage | null>(null);
  const frameTimes = useRef<number[]>([]);
  const flashOpacity = useSharedValue(0);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledReadyAt = useRef<number | null>(null);
  const {
    cameraStatus,
    ip,
    sendCommand,
    status,
    batteryLevel,
    lastImageReady,
    currentSettings,
    availableSettings,
    setCameraSetting,
    reconnect,
    disconnect,
    httpPort,
  } = useWebSocketContext();
  const { state: settings } = useSettings();

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  useEffect(() => {
    if (!ip || !lastImageReady) {
      return;
    }
    if (handledReadyAt.current === lastImageReady.receivedAt) {
      return;
    }
    handledReadyAt.current = lastImageReady.receivedAt;

    let cancelled = false;
    (async () => {
      try {
        const image = await downloadCaptureStill(
          ip,
          lastImageReady.fullPath,
          lastImageReady.imageId,
          httpPort
        );
        if (!cancelled) {
          setLastThumb(image);
        }
      } catch (err) {
        logger.warn("Viewfinder: failed to cache capture after notify", err);
        if (!cancelled && lastImageReady.thumbPath) {
          setLastThumb({
            id: lastImageReady.imageId,
            filename: `capture-${lastImageReady.imageId}.jpg`,
            uri: mediaUrlForIp(ip, lastImageReady.thumbPath, httpPort),
            cacheKey: `remote:${lastImageReady.imageId}`,
            createdAt: Number(lastImageReady.imageId) || Date.now(),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ip, httpPort, lastImageReady]);

  const notifyCaptureSuccess = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleFocus = (target?: {
    x: number;
    y: number;
    centered: boolean;
    normX?: number;
    normY?: number;
  }) => {
    if (cameraStatus !== "connected") {
      return;
    }

    const next = target ?? { x: 0, y: 0, centered: true };
    setFocusTarget(next);
    setFocusActive(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (next.centered || next.normX == null || next.normY == null) {
      sendCommand(ControlType.FOCUS);
    } else {
      sendCommand(ControlType.FOCUS, { x: next.normX, y: next.normY });
    }
    setTimeout(() => {
      setFocusActive(false);
      setFocusTarget(null);
    }, 800);
  };

  const handleStreamTap = (
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    if (width <= 0 || height <= 0) {
      return;
    }
    handleFocus({
      x,
      y,
      centered: false,
      normX: width > 0 ? Math.min(1, Math.max(0, x / width)) : 0.5,
      normY: height > 0 ? Math.min(1, Math.max(0, y / height)) : 0.5,
    });
  };

  const handleCapture = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    sendCommand(ControlType.CAPTURE);

    flashOpacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(0, { duration: 200 }, (finished) => {
        if (finished) {
          runOnJS(notifyCaptureSuccess)();
        }
      })
    );
  };

  const handleCapturePressIn = () => {
    if (cameraStatus !== "connected") {
      return;
    }
    pressTimer.current = setTimeout(() => {
      handleFocus();
      pressTimer.current = null;
    }, 300);
  };

  const handleCapturePressOut = () => {
    if (cameraStatus !== "connected") {
      return;
    }
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

  const openGallery = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/gallery");
  };

  const handleFrame = () => {
    logger.debug("Frame received");
    const now = Date.now();
    frameTimes.current.push(now);
    frameTimes.current = frameTimes.current.filter((t) => now - t <= 1000);
  };

  const getBatteryColor = (level: number) => {
    if (level > 50) return "#4CAF50";
    if (level > 20) return "#FFC107";
    return "#F44336";
  };

  return (
    <View style={styles.container}>
      {cameraStatus !== "connected" ? (
        <SafeAreaView style={styles.disconnected}>
          <Host colorScheme="dark" style={styles.disconnectedHost}>
            <Column spacing={12} alignment="center" style={{ padding: 24 }}>
              <Text
                textStyle={{
                  color: "#FFFFFF",
                  fontSize: 28,
                  fontWeight: "700",
                  textAlign: "center",
                }}
              >
                Camera Disconnected
              </Text>
              <Text
                textStyle={{
                  color: "#FFFFFF",
                  fontSize: 16,
                  textAlign: "center",
                }}
              >
                Please ensure the camera is powered on and connected to the
                5DControl.
              </Text>
              <ActivityIndicator color="#fff" />
              <Button
                label="Reconnect"
                onPress={() => reconnect()}
              />
              <Button
                label="Change server"
                onPress={() => disconnect()}
              />
            </Column>
          </Host>
        </SafeAreaView>
      ) : (
        <>
          <CameraStream
            url={liveViewUrlForHost(ip ?? "", httpPort)}
            onFrame={handleFrame}
            onTap={handleStreamTap}
          />
          <GridOverlay type={settings.gridType} visible={true} />
          {focusActive && focusTarget ? (
            <FocusIndicator
              x={focusTarget.x}
              y={focusTarget.y}
              centered={focusTarget.centered}
            />
          ) : null}

          <Animated.View
            pointerEvents="none"
            style={[styles.captureFlash, flashStyle]}
          />

          <View style={styles.leftNav}>
            <ConnectionHud
              cameraStatus={cameraStatus}
              serverStatus={status}
              onReconnect={reconnect}
              onDisconnect={disconnect}
            />

            <ViewfinderGlass
              style={styles.batteryIndicator}
              fallbackStyle={styles.chromeFallback}
            >
              <Feather
                name="battery-charging"
                color={getBatteryColor(batteryLevel)}
                size={20}
              />
              <RNText
                style={[
                  styles.batteryText,
                  { color: getBatteryColor(batteryLevel) },
                ]}
              >
                {batteryLevel}%
              </RNText>
            </ViewfinderGlass>
          </View>

          <ViewfinderGlassContainer style={styles.rightNav} spacing={16}>
            <Pressable
              onPress={openSettings}
              accessibilityRole="button"
              accessibilityLabel="App settings"
            >
              <ViewfinderGlass
                style={styles.navButton}
                fallbackStyle={styles.navButtonFallback}
                isInteractive
              >
                <Feather name="settings" color="#fff" size={24} />
              </ViewfinderGlass>
            </Pressable>

            <Pressable
              onPressIn={handleCapturePressIn}
              onPressOut={handleCapturePressOut}
              accessibilityRole="button"
              accessibilityLabel="Capture"
            >
              <ViewfinderGlass
                style={styles.captureButton}
                fallbackStyle={styles.captureButtonFallback}
                isInteractive
              >
                <View style={styles.captureButtonInner} />
              </ViewfinderGlass>
            </Pressable>

            <Pressable
              onPress={openGallery}
              accessibilityRole="button"
              accessibilityLabel="Gallery"
              testID="gallery-button"
            >
              <ViewfinderGlass
                style={styles.navButton}
                fallbackStyle={styles.navButtonFallback}
                isInteractive
              >
                {lastThumb ? (
                  <Image
                    source={{
                      uri: lastThumb.uri,
                      cacheKey: lastThumb.cacheKey,
                    }}
                    style={styles.galleryThumb}
                    contentFit="cover"
                    testID="last-capture-thumb"
                  />
                ) : (
                  <Feather name="grid" color="#fff" size={24} />
                )}
              </ViewfinderGlass>
            </Pressable>
          </ViewfinderGlassContainer>

          <ExposureControls
            current={currentSettings}
            available={availableSettings}
            onSet={setCameraSetting}
            disabled={cameraStatus !== "connected"}
          />
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
  disconnected: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
  },
  disconnectedHost: {
    width: "100%",
    maxWidth: 420,
  },
  captureFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fff",
    zIndex: 100,
  },
  leftNav: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 20,
    flexDirection: "column",
    justifyContent: "space-between",
    zIndex: 10,
    alignItems: "center",
    paddingVertical: 20,
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
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  navButtonFallback: {
    backgroundColor: "rgba(144, 144, 144, 0.5)",
  },
  galleryThumb: {
    width: 50,
    height: 50,
  },
  chromeFallback: {
    backgroundColor: "rgba(144, 144, 144, 0.35)",
  },
  batteryIndicator: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
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
    justifyContent: "center",
    alignItems: "center",
  },
  captureButtonFallback: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
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
    backgroundColor: "#FFFFFF",
  },
});
