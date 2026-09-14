import {
  Command,
  ControlType,
  Message,
  MessageType,
} from "@5dcontrol/proto";
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

/** Paths are HTTP paths on :8080; prepend http://{ip}:8080 on the client. */
export type ImageReadyInfo = {
  imageId: string;
  thumbPath: string;
  fullPath: string;
  receivedAt: number;
};

interface WebSocketContextValue {
  status: ConnectionStatus;
  cameraStatus: ConnectionStatus;
  batteryLevel: number;
  ip: string | null;
  lastImageReady: ImageReadyInfo | null;
  setIp: (ip: string | null) => void;
  reconnect: () => void;
  connect: (ip: string) => Promise<void>;
  sendCommand: (type: ControlType) => void;
  loadIp?: () => Promise<void>;
  clearLastImageReady: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(
  undefined
);

const buildCommandMessage = (type: ControlType): Uint8Array => {
  const builder = new Builder(64);

  Command.startCommand(builder);
  Command.addType(builder, type);
  const commandOffset = Command.endCommand(builder);

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
  const [batteryLevel, setBatteryLevel] = useState<number>(0);
  const [ip, setInternalIp] = useState<string | null>(null);
  const [connectionTrigger, setConnectionTrigger] = useState(0);
  const [lastImageReady, setLastImageReady] = useState<ImageReadyInfo | null>(
    null
  );

  const setConnected = useCallback(() => setStatus("connected"), []);
  const setDisconnected = useCallback(() => setStatus("disconnected"), []);

  const wsRef = useRef<WebSocket | null>(null);

  const clearLastImageReady = useCallback(() => {
    setLastImageReady(null);
  }, []);

  const setIp = useCallback(async (newIp: string | null) => {
    logger.debug(`WebSocket: setIp called with: ${newIp}`);
    setInternalIp(newIp);
    if (newIp) {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, newIp);
        logger.debug(`WebSocket: IP saved to storage: ${newIp}`);
      } catch (error) {
        logger.error(`WebSocket: Error saving IP to storage:`, error);
      }
    }
  }, []);

  const reconnect = useCallback(() => {
    logger.debug(`WebSocket: reconnect called`);
    setConnectionTrigger((prev) => prev + 1);
  }, []);

  const connect = useCallback(async (targetIp: string) => {
    logger.debug(`WebSocket: connect called with: ${targetIp}`);
    setInternalIp(targetIp);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, targetIp);
    } catch (error) {
      logger.error(`WebSocket: Error saving IP to storage:`, error);
    }
    setConnectionTrigger((prev) => prev + 1);
  }, []);

  const loadIp = useCallback(async () => {
    logger.debug(`WebSocket: Loading IP from storage`);
    try {
      const savedIp = await AsyncStorage.getItem(STORAGE_KEY);
      logger.debug(`WebSocket: Saved IP from storage: ${savedIp}`);
      // Prefill only — do not auto-connect until the user taps Connect.
      setInternalIp(savedIp ?? DEFAULT_IP);
    } catch (error) {
      logger.error(`WebSocket: Error loading IP from storage:`, error);
      setInternalIp(DEFAULT_IP);
    } finally {
      logger.debug(`WebSocket: Setting initial status to disconnected`);
      setDisconnected();
    }
  }, [setDisconnected]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "test") {
      loadIp();
    } else {
      setInternalIp(DEFAULT_IP);
      setDisconnected();
    }
  }, [loadIp, setDisconnected]);

  useEffect(() => {
    // Wait for an explicit Connect/reconnect before opening a socket.
    if (connectionTrigger === 0 || !ip) {
      logger.debug(
        `WebSocket: Skipping connect (trigger=${connectionTrigger}, ip=${ip})`
      );
      return;
    }

    if (wsRef.current) {
      logger.debug(`WebSocket: Closing existing connection`);
      wsRef.current.close();
    }

    const wsUrl = `ws://${ip}:8888/ws`;
    logger.info(`WebSocket: Creating new connection to: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      logger.info(`WebSocket: Connection opened successfully to ${wsUrl}`);
      setConnected();

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

    ws.onmessage = async (e) => {
      logger.debug(
        `WebSocket: Message received, data type: ${typeof e.data}, is ArrayBuffer: ${
          e.data instanceof ArrayBuffer
        }`
      );

      let data: Uint8Array;
      if (e.data instanceof ArrayBuffer) {
        data = new Uint8Array(e.data);
      } else if (e.data instanceof Blob) {
        logger.debug(
          `WebSocket: Received Blob data, converting to ArrayBuffer`
        );
        try {
          const arrayBuffer = await e.data.arrayBuffer();
          data = new Uint8Array(arrayBuffer);
        } catch (error) {
          logger.error(
            `WebSocket: Error converting Blob to ArrayBuffer:`,
            error
          );
          return;
        }
      } else if (typeof e.data === "string") {
        logger.error(`WebSocket: Received string data instead of binary`);
        return;
      } else {
        data = new Uint8Array(e.data);
      }

      logger.debug(`WebSocket: Data length: ${data.length} bytes`);
      const msg = Message.getRootAsMessage(new ByteBuffer(data));
      const msgType = msg.messageType();
      logger.debug(
        `WebSocket: Message type: ${msgType} (STATUS=${MessageType.STATUS}, IMAGE_READY=${MessageType.IMAGE_READY})`
      );

      if (msgType === MessageType.STATUS) {
        const statusMsg = msg.status();
        logger.debug(
          `WebSocket: Status object: ${statusMsg ? "exists" : "null"}`
        );
        if (statusMsg) {
          const connected = statusMsg.cameraConnected();
          logger.info(
            `WebSocket: Camera status: ${
              connected ? "connected" : "disconnected"
            }`
          );
          setCameraStatus(connected ? "connected" : "disconnected");
          setBatteryLevel(statusMsg.batteryLevel());
        } else {
          logger.warn(
            `WebSocket: Received STATUS message but status object is null`
          );
        }
      } else if (msgType === MessageType.IMAGE_READY) {
        const ready = msg.imageReady();
        if (!ready) {
          logger.warn(`WebSocket: IMAGE_READY missing payload`);
          return;
        }
        const imageId = ready.imageId() ?? "";
        const thumbPath = ready.thumbPath() ?? "";
        const fullPath = ready.fullPath() ?? "";
        if (!imageId || !fullPath) {
          logger.warn(`WebSocket: IMAGE_READY missing id/path`);
          return;
        }
        logger.info(`WebSocket: Image ready id=${imageId} full=${fullPath}`);
        setLastImageReady({
          imageId,
          thumbPath,
          fullPath,
          receivedAt: Date.now(),
        });
      } else {
        logger.warn(`WebSocket: Received unhandled message type: ${msgType}`);
      }
    };

    return () => {
      logger.debug(`WebSocket: Cleaning up connection`);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [ip, connectionTrigger, setConnected, setDisconnected]);

  const sendCommand = useCallback((type: ControlType) => {
    logger.debug(`WebSocket: Sending command: ${ControlType[type]}`);
    const msg = buildCommandMessage(type);
    wsRef.current?.send(msg);
  }, []);

  const value: WebSocketContextValue = {
    status,
    cameraStatus,
    batteryLevel,
    ip,
    lastImageReady,
    setIp,
    reconnect,
    connect,
    sendCommand,
    loadIp,
    clearLastImageReady,
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
