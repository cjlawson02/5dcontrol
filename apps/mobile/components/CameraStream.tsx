import { StyleSheet } from "react-native";
import WebView from "react-native-webview";

interface Props {
  url: string;
  onFrame: () => void;
}

export function CameraStream({ url, onFrame }: Props) {
  const handleMessage = (event: any) => {
    const data = event.nativeEvent.data;
    if (data === "frame") {
      onFrame();
    }
  };

  return (
    <WebView
      source={{
        html: `
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
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
                position: fixed;
                touch-action: none;
              }
              #container {
                width: 100vw;
                height: 100vh;
                position: relative;
                overflow: hidden;
              }
              #view {
                width: 100vw;
                height: 100vh;
                object-fit: contain;
                position: absolute;
                top: 0;
                left: 0;
                transform-origin: center center;
              }
            </style>
        </head>
        <body>
            <div id="container">
                <img id="view" src="${url}" />
            </div>
            <script>
            const img = document.getElementById('view');
            const container = document.getElementById('container');

            img.onload = () => window.ReactNativeWebView.postMessage('frame');

            // Zoom and pan state
            let scale = 1;
            let translateX = 0;
            let translateY = 0;

            // Touch handling
            let lastDistance = 0;
            let lastCenter = { x: 0, y: 0 };
            let isPinching = false;

            function getDistance(touches) {
                const dx = touches[0].clientX - touches[1].clientX;
                const dy = touches[0].clientY - touches[1].clientY;
                return Math.sqrt(dx * dx + dy * dy);
            }

            function getCenter(touches) {
                return {
                    x: (touches[0].clientX + touches[1].clientX) / 2,
                    y: (touches[0].clientY + touches[1].clientY) / 2
                };
            }

            function constrainTranslate() {
                const maxTranslate = Math.max(0, (scale - 1) * window.innerWidth / 2);
                const maxTranslateY = Math.max(0, (scale - 1) * window.innerHeight / 2);

                translateX = Math.max(-maxTranslate, Math.min(maxTranslate, translateX));
                translateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, translateY));
            }

            function updateTransform() {
                img.style.transform = \`translate(\${translateX}px, \${translateY}px) scale(\${scale})\`;
            }

            container.addEventListener('touchstart', function(e) {
                if (e.touches.length === 2) {
                    e.preventDefault();
                    isPinching = true;
                    lastDistance = getDistance(e.touches);
                    lastCenter = getCenter(e.touches);
                } else if (e.touches.length === 1) {
                    if (scale > 1) {
                        e.preventDefault();
                    }
                    lastCenter = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                }
            }, { passive: false });

            container.addEventListener('touchmove', function(e) {
                if (e.touches.length === 2 && isPinching) {
                    e.preventDefault();

                    // Calculate zoom
                    const distance = getDistance(e.touches);
                    const deltaScale = distance / lastDistance;
                    const newScale = scale * deltaScale;

                    // Constrain zoom between 1.0 and 5.0
                    scale = Math.max(1.0, Math.min(5.0, newScale));

                    // Calculate pan
                    const center = getCenter(e.touches);
                    const deltaX = center.x - lastCenter.x;
                    const deltaY = center.y - lastCenter.y;

                    translateX += deltaX;
                    translateY += deltaY;

                    constrainTranslate();
                    updateTransform();

                    lastDistance = distance;
                    lastCenter = center;
                } else if (e.touches.length === 1 && scale > 1) {
                    e.preventDefault();

                    const deltaX = e.touches[0].clientX - lastCenter.x;
                    const deltaY = e.touches[0].clientY - lastCenter.y;

                    translateX += deltaX;
                    translateY += deltaY;

                    constrainTranslate();
                    updateTransform();

                    lastCenter = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                }
            }, { passive: false });

            container.addEventListener('touchend', function(e) {
                if (e.touches.length < 2) {
                    isPinching = false;
                }

                // Reset to 1.0 if zoomed out too far
                if (scale < 1.0) {
                    scale = 1.0;
                    translateX = 0;
                    translateY = 0;
                    updateTransform();
                }
            }, { passive: false });
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
    />
  );
}
