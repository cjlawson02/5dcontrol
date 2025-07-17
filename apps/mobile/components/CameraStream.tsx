import { StyleSheet } from "react-native";
import WebView from "react-native-webview";

interface Props {
  url: string;
  onFrame: () => void;
}

export function CameraStream({ url, onFrame }: Props) {
  return (
    <WebView
      source={{
        html: `
        <html>
        <body style="margin:0;background:black;">
            <img id="view" src="${url}" style="width:100vw;height:100vh;object-fit:contain;position:absolute;top:0;left:0;" />
            <script>
            const img = document.getElementById('view');
            img.onload = () => window.ReactNativeWebView.postMessage('frame');
            </script>
        </body>
        </html>
        `,
      }}
      onMessage={onFrame}
      style={StyleSheet.absoluteFill}
    />
  );
}
