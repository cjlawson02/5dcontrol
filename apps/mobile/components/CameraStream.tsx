import { StyleSheet } from "react-native";
import WebView from "react-native-webview";

interface Props {
  url: string;
  onFrame: () => void;
  onTap?: (x: number, y: number) => void;
}

export function CameraStream({ url, onFrame, onTap }: Props) {
  const handleMessage = (event: any) => {
    const data = event.nativeEvent.data;
    if (data === "frame") {
      onFrame();
    } else if (data.startsWith("tap:")) {
      const coords = data.substring(4).split(",");
      const x = parseFloat(coords[0]);
      const y = parseFloat(coords[1]);
      if (onTap) {
        onTap(x, y);
      }
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
            let touchStartPos = { x: 0, y: 0 };
            let touchStartTime = 0;
            let hasMoved = false;

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
                hasMoved = false;
                touchStartTime = Date.now();

                if (e.touches.length === 2) {
                    e.preventDefault();
                    isPinching = true;
                    lastDistance = getDistance(e.touches);
                    lastCenter = getCenter(e.touches);
                } else if (e.touches.length === 1) {
                    touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };

                    if (scale > 1) {
                        e.preventDefault();
                    }

                    lastCenter = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                }
            }, { passive: false });

            container.addEventListener('touchmove', function(e) {
                const moveThreshold = 10; // pixels

                if (e.touches.length === 1) {
                    const dx = Math.abs(e.touches[0].clientX - touchStartPos.x);
                    const dy = Math.abs(e.touches[0].clientY - touchStartPos.y);
                    if (dx > moveThreshold || dy > moveThreshold) {
                        hasMoved = true;
                    }
                }

                if (e.touches.length === 2 && isPinching) {
                    e.preventDefault();
                    hasMoved = true;

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

                // If it was a quick tap without movement and at 1.0x scale, send tap event
                if (e.touches.length === 0 && !hasMoved && scale === 1.0) {
                    const touchDuration = Date.now() - touchStartTime;
                    if (touchDuration < 300) { // Less than 300ms = tap
                        const rect = container.getBoundingClientRect();
                        const x = touchStartPos.x - rect.left;
                        const y = touchStartPos.y - rect.top;
                        window.ReactNativeWebView.postMessage('tap:' + x + ',' + y);
                    }
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
