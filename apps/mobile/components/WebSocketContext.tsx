import { Command, ControlType, Message, MessageType } from "@proto/control";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Builder, ByteBuffer } from "flatbuffers";
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
  cameraStatus: ConnectionStatus;
  ip: string | null;
  setIp: (ip: string | null) => void;
  sendCommand: (type: ControlType) => void;
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(
  undefined
);

const buildCommandMessage = (type: ControlType): Uint8Array => {
  const builder = new Builder(64);

  // Build Command table
  Command.startCommand(builder);
  Command.addType(builder, type);
  const commandOffset = Command.endCommand(builder);

  // Build Message table
  Message.startMessage(builder);
  Message.addMessageType(builder, MessageType.COMMAND);
  Message.addCommand(builder, commandOffset);
  const messageOffset = Message.endMessage(builder);

  builder.finish(messageOffset);
  return builder.asUint8Array();
};

const STORAGE_KEY = "server_ip";
const DEFAULT_IP = "192.168.1.1";

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<ConnectionStatus>("loading");
  const [cameraStatus, setCameraStatus] = useState<ConnectionStatus>("loading");
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
      } catch {
        // Handle error silently
      } finally {
        setDisconnected();
      }
    };
    loadIp();
  }, []);

  useEffect(() => {
    if (!ip) return;

    const ws = new WebSocket(`http://${ip}:8888/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      setConnected();

      // Request camera status
      const msg = buildCommandMessage(ControlType.QUERY_STATUS);
      ws.send(msg);
    };

    ws.onclose = (e) => {
      console.log(`WebSocket closed:`, e);
      setDisconnected();
      setCameraStatus("disconnected");
    };

    ws.onmessage = (e) => {
      const data = new Uint8Array(e.data);
      const msg = Message.getRootAsMessage(new ByteBuffer(data));

      if (msg.messageType() === MessageType.STATUS) {
        const status = msg.status();
        if (status) {
          const connected = status.cameraConnected();
          console.log("Camera connected:", connected);
          setCameraStatus(connected ? "connected" : "disconnected");
        }
      }
    };

    return () => {
      ws.close();
    };
  }, [ip, setConnected, setDisconnected]);

  const sendCommand = useCallback((type: ControlType) => {
    console.log(`Sending command: ${ControlType[type]}`);
    const msg = buildCommandMessage(type);
    wsRef.current?.send(msg);
  }, []);

  const value: WebSocketContextValue = {
    status,
    cameraStatus,
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
