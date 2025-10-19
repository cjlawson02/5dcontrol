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
import { logger } from "../utils/logger";

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
      logger.debug(`WebSocket: setIp called with: ${newIp}, current IP: ${ip}`);
      // Update state immediately
      setInternalIp(newIp);
      if (newIp) {
        try {
          await AsyncStorage.setItem(STORAGE_KEY, newIp);
          logger.debug(`WebSocket: IP saved to storage: ${newIp}`);
        } catch (error) {
          logger.error(`WebSocket: Error saving IP to storage:`, error);
        }
      }
    },
    [ip]
  );

  const reconnect = useCallback(() => {
    logger.debug(`WebSocket: reconnect called, current IP: ${ip}`);
    setConnectionTrigger((prev) => {
      logger.debug(
        `WebSocket: Connection trigger incrementing from ${prev} to ${
          prev + 1
        }`
      );
      return prev + 1;
    });
  }, [ip]);

  const loadIp = useCallback(async () => {
    logger.debug(`WebSocket: Loading IP from storage`);
    try {
      const savedIp = await AsyncStorage.getItem(STORAGE_KEY);
      logger.debug(`WebSocket: Saved IP from storage: ${savedIp}`);
      if (savedIp) {
        setIp(savedIp);
      } else {
        logger.debug(`WebSocket: No saved IP, using default: ${DEFAULT_IP}`);
        setIp(DEFAULT_IP);
      }
    } catch (error) {
      logger.error(`WebSocket: Error loading IP from storage:`, error);
    } finally {
      logger.debug(`WebSocket: Setting initial status to disconnected`);
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
    logger.debug(
      `WebSocket: useEffect triggered with IP: ${ip}, trigger: ${connectionTrigger}`
    );
    if (!ip) {
      logger.debug(`WebSocket: No IP provided, skipping connection`);
      return;
    }

    // Close existing connection if any
    if (wsRef.current) {
      logger.debug(`WebSocket: Closing existing connection`);
      wsRef.current.close();
    }

    const wsUrl = `ws://${ip}:8888/ws`;
    logger.info(`WebSocket: Creating new connection to: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      logger.info(`WebSocket: Connection opened successfully to ${wsUrl}`);
      setConnected();

      // Request camera status
      const msg = buildCommandMessage(ControlType.QUERY_STATUS);
      logger.debug(`WebSocket: Sending QUERY_STATUS command`);
      ws.send(msg);
    };

    ws.onclose = (e) => {
      logger.info(`WebSocket: Connection closed:`, e.code, e.reason);
      setDisconnected();
      setCameraStatus("disconnected");
    };

    ws.onerror = (error) => {
      logger.error(`WebSocket: Connection error:`, error);
    };

    ws.onmessage = (e) => {
      logger.debug(`WebSocket: Message received, data type: ${typeof e.data}, is ArrayBuffer: ${e.data instanceof ArrayBuffer}`);
      const data = new Uint8Array(e.data);
      const msg = Message.getRootAsMessage(new ByteBuffer(data));

      if (msg.messageType() === MessageType.STATUS) {
        const status = msg.status();
        if (status) {
          const connected = status.cameraConnected();
          logger.info(
            `WebSocket: Camera status: ${
              connected ? "connected" : "disconnected"
            }`
          );
          setCameraStatus(connected ? "connected" : "disconnected");
        }
      }
    };

    return () => {
      logger.debug(`WebSocket: Cleaning up connection`);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ip, connectionTrigger]);

  const sendCommand = useCallback((type: ControlType) => {
    logger.debug(`WebSocket: Sending command: ${ControlType[type]}`);
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
