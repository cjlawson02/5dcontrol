import { ControlType } from "@5dcontrol/proto";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
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

export default function HomeScreen() {
  const [focusActive, setFocusActive] = useState(false);
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
          lastImageReady.imageId
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
            uri: mediaUrlForIp(ip, lastImageReady.thumbPath),
            cacheKey: `remote:${lastImageReady.imageId}`,
            createdAt: Number(lastImageReady.imageId) || Date.now(),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ip, lastImageReady]);

  const notifyCaptureSuccess = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleFocus = () => {
    if (cameraStatus !== "connected") {
      return;
    }

    setFocusActive(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendCommand(ControlType.FOCUS);
    setTimeout(() => setFocusActive(false), 800);
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

  const getConnectionColor = () => {
    if (cameraStatus === "connected") return "#4CAF50";
    if (status === "connected") return "#FFC107";
    return "#F44336";
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
          <ActivityIndicator color="#fff" />
        </SafeAreaView>
      ) : (
        <>
          <CameraStream
            url={`http://${ip}:8080/live.mjpeg`}
            onFrame={handleFrame}
          />
          <GridOverlay type={settings.gridType} visible={true} />
          {focusActive ? <FocusIndicator x={0} y={0} centered /> : null}

          <Animated.View
            pointerEvents="none"
            style={[styles.captureFlash, flashStyle]}
          />

          <View style={styles.leftNav}>
            <ViewfinderGlass
              style={styles.connectionIndicator}
              fallbackStyle={styles.chromeFallback}
            >
              <Feather name="wifi" color={getConnectionColor()} size={20} />
              <Text
                style={[styles.connectionText, { color: getConnectionColor() }]}
              >
                {cameraStatus === "connected"
                  ? "Camera"
                  : status === "connected"
                    ? "Server"
                    : "Offline"}
              </Text>
            </ViewfinderGlass>

            {lastThumb ? (
              <Pressable
                onPress={openGallery}
                accessibilityRole="button"
                accessibilityLabel="Last capture"
                testID="last-capture-thumb"
                style={styles.lastThumbWrap}
              >
                <Image
                  source={{ uri: lastThumb.uri, cacheKey: lastThumb.cacheKey }}
                  style={styles.lastThumb}
                  contentFit="cover"
                />
              </Pressable>
            ) : null}
          </View>

          <ViewfinderGlassContainer style={styles.rightNav} spacing={16}>
            <ViewfinderGlass
              style={styles.batteryIndicator}
              fallbackStyle={styles.chromeFallback}
            >
              <Feather
                name="battery-charging"
                color={getBatteryColor(batteryLevel)}
                size={20}
              />
              <Text
                style={[
                  styles.batteryText,
                  { color: getBatteryColor(batteryLevel) },
                ]}
              >
                {batteryLevel}%
              </Text>
            </ViewfinderGlass>

            <Pressable
              onPress={openSettings}
              accessibilityRole="button"
              accessibilityLabel="Settings"
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
                <Feather name="grid" color="#fff" size={24} />
              </ViewfinderGlass>
            </Pressable>
          </ViewfinderGlassContainer>
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
  },
  leftNav: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 20,
    flexDirection: "column",
    zIndex: 10,
    alignItems: "center",
    gap: 16,
  },
  lastThumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    backgroundColor: "#1a1a1a",
  },
  lastThumb: {
    width: "100%",
    height: "100%",
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
  },
  navButtonFallback: {
    backgroundColor: "rgba(144, 144, 144, 0.5)",
  },
  chromeFallback: {
    backgroundColor: "rgba(144, 144, 144, 0.35)",
  },
  connectionIndicator: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  connectionText: {
    fontSize: 12,
    fontWeight: "600",
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
    backgroundColor: "#ff4444",
  },
});
