import { useCallback } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import WebView from "react-native-webview";

const MIN_SCALE = 1;
const MAX_SCALE = 5;

interface Props {
  url: string;
  onFrame?: () => void;
}

function clamp(value: number, min: number, max: number) {
  "worklet";
  return Math.min(max, Math.max(min, value));
}

function maxTranslate(scale: number, size: number) {
  "worklet";
  return Math.max(0, ((scale - 1) * size) / 2);
}

export function CameraStream({ url, onFrame }: Props) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const containerWidth = useSharedValue(0);
  const containerHeight = useSharedValue(0);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      containerWidth.value = event.nativeEvent.layout.width;
      containerHeight.value = event.nativeEvent.layout.height;
    },
    [containerWidth, containerHeight]
  );

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      const nextScale = clamp(
        savedScale.value * event.scale,
        MIN_SCALE,
        MAX_SCALE
      );
      scale.value = nextScale;

      const maxX = maxTranslate(nextScale, containerWidth.value);
      const maxY = maxTranslate(nextScale, containerHeight.value);
      translateX.value = clamp(translateX.value, -maxX, maxX);
      translateY.value = clamp(translateY.value, -maxY, maxY);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= MIN_SCALE) {
        scale.value = withTiming(MIN_SCALE);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedScale.value = MIN_SCALE;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        return;
      }

      const maxX = maxTranslate(scale.value, containerWidth.value);
      const maxY = maxTranslate(scale.value, containerHeight.value);
      translateX.value = clamp(translateX.value, -maxX, maxX);
      translateY.value = clamp(translateY.value, -maxY, maxY);
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pan = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (scale.value <= MIN_SCALE) {
        translateX.value = 0;
        translateY.value = 0;
        return;
      }

      const maxX = maxTranslate(scale.value, containerWidth.value);
      const maxY = maxTranslate(scale.value, containerHeight.value);
      translateX.value = clamp(
        savedTranslateX.value + event.translationX,
        -maxX,
        maxX
      );
      translateY.value = clamp(
        savedTranslateY.value + event.translationY,
        -maxY,
        maxY
      );
    })
    .onEnd(() => {
      if (scale.value <= MIN_SCALE) {
        translateX.value = 0;
        translateY.value = 0;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        return;
      }

      const maxX = maxTranslate(scale.value, containerWidth.value);
      const maxY = maxTranslate(scale.value, containerHeight.value);
      translateX.value = clamp(translateX.value, -maxX, maxX);
      translateY.value = clamp(translateY.value, -maxY, maxY);
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const gesture = Gesture.Simultaneous(pinch, pan);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    if (event.nativeEvent.data === "frame" && onFrame) {
      onFrame();
    }
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={onLayout}
      testID="camera-stream"
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, animatedStyle]}
        pointerEvents="none"
      >
        <WebView
          source={{
            html: `
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
            <style>
              * {
                -webkit-user-select: none;
                -webkit-touch-callout: none;
                -webkit-tap-highlight-color: transparent;
              }
              body, html {
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
                overflow: hidden;
                background: black;
              }
              img {
                width: 100%;
                height: 100%;
                object-fit: contain;
                display: block;
              }
            </style>
        </head>
        <body>
            <img id="view" src="${url}" />
            <script>
              document.getElementById('view').onload = function () {
                window.ReactNativeWebView.postMessage('frame');
              };
            </script>
        </body>
        </html>
        `,
          }}
          onMessage={handleMessage}
          style={StyleSheet.absoluteFill}
          scrollEnabled={false}
          bounces={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          pointerEvents="none"
          testID="webview"
        />
      </Animated.View>
      {/* Transparent overlay so WKWebView cannot steal pinch/pan touches */}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={StyleSheet.absoluteFill}
          testID="camera-stream-gestures"
        />
      </GestureDetector>
    </View>
  );
}
