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
  reconnect: () => void;
  sendCommand: (type: ControlType) => void;
  loadIp?: () => Promise<void>;
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
  const [connectionTrigger, setConnectionTrigger] = useState(0);

  const setConnected = useCallback(() => setStatus("connected"), []);
  const setDisconnected = useCallback(() => setStatus("disconnected"), []);

  const wsRef = useRef<WebSocket | null>(null);

  const setIp = useCallback(
    async (newIp: string | null) => {
      console.log(`[WebSocket] setIp called with: ${newIp}, current IP: ${ip}`);
      // Update state immediately
      setInternalIp(newIp);
      if (newIp) {
        try {
          await AsyncStorage.setItem(STORAGE_KEY, newIp);
          console.log(`[WebSocket] IP saved to storage: ${newIp}`);
        } catch (error) {
          console.error(`[WebSocket] Error saving IP to storage:`, error);
        }
      }
    },
    [ip]
  );

  const reconnect = useCallback(() => {
    console.log(`[WebSocket] reconnect called, current IP: ${ip}`);
    setConnectionTrigger((prev) => {
      console.log(
        `[WebSocket] Connection trigger incrementing from ${prev} to ${
          prev + 1
        }`
      );
      return prev + 1;
    });
  }, [ip]);

  const loadIp = useCallback(async () => {
    console.log(`[WebSocket] Loading IP from storage`);
    try {
      const savedIp = await AsyncStorage.getItem(STORAGE_KEY);
      console.log(`[WebSocket] Saved IP from storage: ${savedIp}`);
      if (savedIp) {
        setIp(savedIp);
      } else {
        console.log(`[WebSocket] No saved IP, using default: ${DEFAULT_IP}`);
        setIp(DEFAULT_IP);
      }
    } catch (error) {
      console.error(`[WebSocket] Error loading IP from storage:`, error);
    } finally {
      console.log(`[WebSocket] Setting initial status to disconnected`);
      setDisconnected();
    }
  }, []);

  useEffect(() => {
    // Skip loading IP in test environment to allow mocking
    if (process.env.NODE_ENV !== "test") {
      loadIp();
    } else {
      // In test environment, set default values
      setIp(DEFAULT_IP);
      setDisconnected();
    }
  }, [loadIp]);

  useEffect(() => {
    console.log(
      `[WebSocket] useEffect triggered with IP: ${ip}, trigger: ${connectionTrigger}`
    );
    if (!ip) {
      console.log(`[WebSocket] No IP provided, skipping connection`);
      return;
    }

    // Close existing connection if any
    if (wsRef.current) {
      console.log(`[WebSocket] Closing existing connection`);
      wsRef.current.close();
    }

    const wsUrl = `ws://${ip}:8888/ws`;
    console.log(`[WebSocket] Creating new WebSocket connection to: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[WebSocket] Connection opened successfully to ${wsUrl}`);
      setConnected();

      // Request camera status
      const msg = buildCommandMessage(ControlType.QUERY_STATUS);
      console.log(`[WebSocket] Sending QUERY_STATUS command`);
      ws.send(msg);
    };

    ws.onclose = (e) => {
      console.log(`[WebSocket] Connection closed:`, e.code, e.reason);
      setDisconnected();
      setCameraStatus("disconnected");
    };

    ws.onerror = (error) => {
      console.error(`[WebSocket] Connection error:`, error);
    };

    ws.onmessage = (e) => {
      console.log(`[WebSocket] Message received`);
      const data = new Uint8Array(e.data);
      const msg = Message.getRootAsMessage(new ByteBuffer(data));

      if (msg.messageType() === MessageType.STATUS) {
        const status = msg.status();
        if (status) {
          const connected = status.cameraConnected();
          console.log(
            `[WebSocket] Camera status: ${
              connected ? "connected" : "disconnected"
            }`
          );
          setCameraStatus(connected ? "connected" : "disconnected");
        }
      }
    };

    return () => {
      console.log(`[WebSocket] Cleaning up connection`);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [ip, connectionTrigger, setConnected, setDisconnected]);

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
    reconnect,
    sendCommand,
    loadIp,
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
