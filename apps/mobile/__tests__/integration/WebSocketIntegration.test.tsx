import { ControlType } from "@proto/control";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import {
  WebSocketProvider,
  useWebSocketContext,
} from "../../components/WebSocketContext";
import {
  IntegrationTestHelper,
  mockWebSocket,
} from "./IntegrationTestUtils.util";

// Mock dependencies
const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage);

// Mock WebSocket
const mockWebSocketConstructor = jest.fn(() => mockWebSocket);
(global as any).WebSocket = mockWebSocketConstructor;

// Mock the proto module
jest.mock("@proto/control", () => ({
  ControlType: {
    FOCUS: 1,
    CAPTURE: 2,
    QUERY_STATUS: 3,
  },
  MessageType: {
    COMMAND: 1,
    STATUS: 2,
  },
  Command: {
    startCommand: jest.fn(),
    addType: jest.fn(),
    endCommand: jest.fn(),
  },
  Message: {
    startMessage: jest.fn(),
    addMessageType: jest.fn(),
    addCommand: jest.fn(),
    endMessage: jest.fn(),
    getRootAsMessage: jest.fn(),
  },
}));

describe("WebSocket Integration Tests", () => {
  let testHelper: IntegrationTestHelper;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();

    // Reset WebSocket mock
    mockWebSocket.close.mockClear();
    mockWebSocket.send.mockClear();
    mockWebSocket.onopen = null;
    mockWebSocket.onclose = null;
    mockWebSocket.onerror = null;
    mockWebSocket.onmessage = null;
    mockWebSocket.readyState = 1; // OPEN

    testHelper = new IntegrationTestHelper();
  });

  afterEach(async () => {
    await testHelper.teardownTestServer();
  });

  describe("WebSocket Connection Lifecycle", () => {
    it("should connect to test server and receive initial status", async () => {
      await testHelper.setupTestServer();

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.ip).toBe("192.168.1.1");
      });

      // Simulate WebSocket connection
      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen();
        }
      });

      await waitFor(() => {
        expect(result.current.status).toBe("connected");
      });

      // Verify WebSocket was created with correct URL
      expect(mockWebSocketConstructor).toHaveBeenCalledWith(
        "ws://192.168.1.1:8888/ws"
      );
    });

    it("should handle connection errors gracefully", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.ip).toBe("192.168.1.1");
      });

      // Simulate WebSocket error
      act(() => {
        if (mockWebSocket.onerror) {
          mockWebSocket.onerror(new Error("Connection failed"));
        }
      });

      // Should remain in loading state (no state change on error)
      expect(result.current.status).toBe("loading");
    });

    it("should handle connection close and update status", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.ip).toBe("192.168.1.1");
      });

      // Simulate WebSocket open
      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen();
        }
      });

      await waitFor(() => {
        expect(result.current.status).toBe("connected");
      });

      // Simulate WebSocket close
      act(() => {
        if (mockWebSocket.onclose) {
          mockWebSocket.onclose({ code: 1000, reason: "Normal closure" });
        }
      });

      await waitFor(() => {
        expect(result.current.status).toBe("disconnected");
        expect(result.current.cameraStatus).toBe("disconnected");
      });
    });

    it("should reconnect when reconnect is called", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.ip).toBe("192.168.1.1");
      });

      // Initial connection
      expect(mockWebSocketConstructor).toHaveBeenCalledTimes(1);

      // Call reconnect
      act(() => {
        result.current.reconnect();
      });

      // Should create new WebSocket connection
      expect(mockWebSocketConstructor).toHaveBeenCalledTimes(2);
    });
  });

  describe("Command Sending", () => {
    it("should send focus command to server", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.ip).toBe("192.168.1.1");
      });

      // Simulate WebSocket connection
      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen();
        }
      });

      await waitFor(() => {
        expect(result.current.status).toBe("connected");
      });

      // Send focus command
      act(() => {
        result.current.sendCommand(ControlType.FOCUS);
      });

      expect(mockWebSocket.send).toHaveBeenCalled();
    });

    it("should send capture command to server", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.ip).toBe("192.168.1.1");
      });

      // Simulate WebSocket connection
      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen();
        }
      });

      await waitFor(() => {
        expect(result.current.status).toBe("connected");
      });

      // Send capture command
      act(() => {
        result.current.sendCommand(ControlType.CAPTURE);
      });

      expect(mockWebSocket.send).toHaveBeenCalled();
    });

    it("should send status query command to server", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.ip).toBe("192.168.1.1");
      });

      // Simulate WebSocket connection
      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen();
        }
      });

      await waitFor(() => {
        expect(result.current.status).toBe("connected");
      });

      // Send status query command
      act(() => {
        result.current.sendCommand(ControlType.QUERY_STATUS);
      });

      expect(mockWebSocket.send).toHaveBeenCalled();
    });

    it("should not send command when WebSocket is not connected", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.ip).toBe("192.168.1.1");
      });

      // Don't simulate WebSocket connection
      // Send command without connection
      act(() => {
        result.current.sendCommand(ControlType.FOCUS);
      });

      // Should not throw error but also not send
      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });
  });

  describe("Status Message Handling", () => {
    it("should handle status messages and update camera status", async () => {
      const { Message } = require("@proto/control");
      const { ByteBuffer } = require("flatbuffers");

      // Mock status message
      const mockStatusMessage = {
        messageType: () => 2, // STATUS
        status: () => ({
          cameraConnected: () => true,
          batteryLevel: () => 85,
        }),
      };

      Message.getRootAsMessage.mockReturnValue(mockStatusMessage);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.ip).toBe("192.168.1.1");
      });

      // Simulate WebSocket connection
      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen();
        }
      });

      await waitFor(() => {
        expect(result.current.status).toBe("connected");
      });

      // Simulate status message
      act(() => {
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage({
            data: new Uint8Array([1, 2, 3, 4]),
          });
        }
      });

      await waitFor(() => {
        expect(result.current.cameraStatus).toBe("connected");
      });
    });

    it("should handle camera disconnected status", async () => {
      const { Message } = require("@proto/control");

      // Mock status message with camera disconnected
      const mockStatusMessage = {
        messageType: () => 2, // STATUS
        status: () => ({
          cameraConnected: () => false,
          batteryLevel: () => 0,
        }),
      };

      Message.getRootAsMessage.mockReturnValue(mockStatusMessage);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.ip).toBe("192.168.1.1");
      });

      // Simulate WebSocket connection
      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen();
        }
      });

      await waitFor(() => {
        expect(result.current.status).toBe("connected");
      });

      // Simulate status message
      act(() => {
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage({
            data: new Uint8Array([1, 2, 3, 4]),
          });
        }
      });

      await waitFor(() => {
        expect(result.current.cameraStatus).toBe("disconnected");
      });
    });
  });

  describe("IP Management", () => {
    it("should update IP and trigger reconnection", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.ip).toBe("192.168.1.1");
      });

      // Update IP
      await act(async () => {
        await result.current.setIp("192.168.1.100");
      });

      expect(result.current.ip).toBe("192.168.1.100");
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "server_ip",
        "192.168.1.100"
      );

      // Should trigger reconnection with new IP
      expect(mockWebSocketConstructor).toHaveBeenCalledWith(
        "ws://192.168.1.100:8888/ws"
      );
    });

    it("should load saved IP from storage", async () => {
      mockAsyncStorage.getItem.mockResolvedValue("192.168.1.200");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.ip).toBe("192.168.1.200");
      });

      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith("server_ip");
    });

    it("should handle storage errors gracefully", async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error("Storage error"));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.status).toBe("disconnected");
      });
    });
  });

  describe("Real Server Integration", () => {
    it("should connect to real test server", async () => {
      await testHelper.setupTestServer();

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      // Set IP to test server
      await act(async () => {
        await result.current.setIp("localhost");
      });

      // Wait for connection
      await waitFor(
        () => {
          expect(result.current.status).toBe("connected");
        },
        { timeout: 5000 }
      );

      // Verify server received connection
      expect(testHelper.getTestServer()?.getConnectionCount()).toBe(1);
    });

    it("should send commands to real test server", async () => {
      await testHelper.setupTestServer();

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      // Set IP to test server
      await act(async () => {
        await result.current.setIp("localhost");
      });

      // Wait for connection
      await waitFor(
        () => {
          expect(result.current.status).toBe("connected");
        },
        { timeout: 5000 }
      );

      // Send focus command
      act(() => {
        result.current.sendCommand(ControlType.FOCUS);
      });

      // Wait a bit for command to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Command should be sent (we can't easily verify server-side processing in this test)
      expect(result.current.status).toBe("connected");
    });
  });
});
