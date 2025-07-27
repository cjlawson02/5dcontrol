import { Control, ControlType } from "@proto/control";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Builder } from "flatbuffers";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type ConnectionStatus = "connected" | "disconnected" | "loading";

interface WebSocketContextValue {
  status: ConnectionStatus;
  ip: string | null;
  setIp: (ip: string | null) => void;
  sendCommand: (type: ControlType) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(
  undefined
);

const buildMessage = (type: ControlType): Uint8Array => {
  const builder = new Builder(32);
  Control.startControl(builder);
  Control.addType(builder, type);
  const control = Control.endControl(builder);
  builder.finish(control);
  return builder.asUint8Array();
};

const STORAGE_KEY = "server_ip";
const DEFAULT_IP = "192.168.1.1";

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<ConnectionStatus>("loading");
  const [ip, setInternalIp] = useState<string | null>(null);

  const setConnected = useCallback(() => setStatus("connected"), []);
  const setDisconnected = useCallback(() => setStatus("disconnected"), []);

  const wsRef = useRef<WebSocket | null>(null);

  const setIp = useCallback(
    async (newIp: string | null) => {
      if (newIp !== ip) {
        setInternalIp(newIp);
        if (newIp) {
          try {
            await AsyncStorage.setItem(STORAGE_KEY, newIp);
          } catch {
            // Handle error silently
          }
        }
      }
    },
    [ip]
  );

  useEffect(() => {
    const loadIp = async () => {
      try {
        const savedIp = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedIp) {
          setIp(savedIp);
        } else {
          setIp(DEFAULT_IP);
        }
      } catch (e) {
        // Handle error silently
      } finally {
        setDisconnected();
      }
    };
    loadIp();
  }, []);

  useEffect(() => {
    wsRef.current = new WebSocket(`http://${ip}:8888/ws`);

    wsRef.current.onopen = () => {
      console.log("WebSocket connected");
      setConnected();
    };

    wsRef.current.onclose = (e) => {
      console.log(
        `WebSocket closed. Code: ${e.code}, Reason: ${e.reason}, WasClean: ${e.wasClean}`
      );
      setDisconnected();
    };

    return () => wsRef.current?.close();
  }, [ip]);

  const sendCommand = useCallback((type: ControlType) => {
    console.log(`Sending command: ${ControlType[type]}`);
    const msg = buildMessage(type);
    wsRef.current?.send(msg);
  }, []);

  const value: WebSocketContextValue = {
    status,
    ip,
    setIp,
    sendCommand,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = (): WebSocketContextValue => {
  const context = React.useContext(WebSocketContext);
  if (!context) {
    throw new Error(
      "useWebSocketContext must be used within a WebSocketProvider"
    );
  }
  return context;
};
