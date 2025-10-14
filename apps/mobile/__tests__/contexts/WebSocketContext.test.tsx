import { ControlType } from "@proto/control";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import {
  WebSocketProvider,
  useWebSocketContext,
} from "../../components/WebSocketContext";

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
    getRootAsMessage: jest.fn(() => ({
      messageType: () => 2, // STATUS
      status: () => ({
        cameraConnected: () => true,
      }),
    })),
  },
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe("WebSocketContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
  });

  describe("WebSocketProvider", () => {
    it("should provide initial loading state", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      // In test environment, initial state is set immediately
      expect(result.current.status).toBe("disconnected");
      expect(result.current.cameraStatus).toBe("loading");
      expect(result.current.ip).toBe("192.168.1.1");
    });

    it("should load default IP from storage on mount", async () => {
      mockAsyncStorage.getItem.mockResolvedValue("192.168.1.100");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      // Manually call loadIp to test the function
      if (result.current.loadIp) {
        await act(async () => {
          await result.current.loadIp!();
        });
      }

      expect(result.current.ip).toBe("192.168.1.100");
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith("server_ip");
    });

    it("should use default IP when no saved IP exists", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      // Manually call loadIp to test the function
      if (result.current.loadIp) {
        await act(async () => {
          await result.current.loadIp!();
        });
      }

      expect(result.current.ip).toBe("192.168.1.1");
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith("server_ip");
    });

    it("should handle storage errors gracefully", async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error("Storage error"));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      // Manually call loadIp to test error handling
      if (result.current.loadIp) {
        await act(async () => {
          await result.current.loadIp!();
        });
      }

      // Should not crash and maintain default state
      expect(result.current.ip).toBe("192.168.1.1");
    });
  });

  describe("setIp", () => {
    it("should update IP and save to storage", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await act(async () => {
        await result.current.setIp("192.168.1.200");
      });

      // State should be updated immediately
      expect(result.current.ip).toBe("192.168.1.200");
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "server_ip",
        "192.168.1.200"
      );
    });

    it("should handle storage errors when setting IP", async () => {
      mockAsyncStorage.setItem.mockRejectedValue(new Error("Storage error"));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await act(async () => {
        await result.current.setIp("192.168.1.200");
      });

      // State should be updated immediately
      expect(result.current.ip).toBe("192.168.1.200");
    });
  });

  describe("reconnect", () => {
    it("should trigger reconnection", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.ip).toBe("192.168.1.1");
      });

      const initialTrigger = result.current.reconnect;

      act(() => {
        result.current.reconnect();
      });

      // The reconnect function should be stable (same reference)
      expect(result.current.reconnect).toBe(initialTrigger);
    });
  });

  describe("sendCommand", () => {
    it("should send command when WebSocket is available", async () => {
      const mockWebSocket = {
        close: jest.fn(),
        send: jest.fn(),
        onopen: null,
        onclose: null,
        onerror: null,
        onmessage: null,
      };

      (global.WebSocket as jest.Mock).mockImplementation(() => mockWebSocket);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.ip).toBe("192.168.1.1");
      });

      act(() => {
        result.current.sendCommand(ControlType.FOCUS);
      });

      expect(mockWebSocket.send).toHaveBeenCalled();
    });

    it("should not send command when WebSocket is not available", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.ip).toBe("192.168.1.1");
      });

      // Mock WebSocket to be null
      const originalWebSocket = global.WebSocket;
      global.WebSocket = jest.fn().mockImplementation(() => null);

      act(() => {
        result.current.sendCommand(ControlType.FOCUS);
      });

      // Should not throw error
      expect(() => result.current.sendCommand(ControlType.FOCUS)).not.toThrow();

      global.WebSocket = originalWebSocket;
    });
  });

  describe("useWebSocketContext hook", () => {
    it("should throw error when used outside provider", () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => {
        renderHook(() => useWebSocketContext());
      }).toThrow("useWebSocketContext must be used within a WebSocketProvider");

      console.error = originalError;
    });
  });

  describe("WebSocket connection lifecycle", () => {
    it("should handle WebSocket connection events", async () => {
      const mockWebSocket = {
        close: jest.fn(),
        send: jest.fn(),
        onopen: null,
        onclose: null,
        onerror: null,
        onmessage: null,
      };

      (global.WebSocket as jest.Mock).mockImplementation(() => mockWebSocket);

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

    it("should handle WebSocket error events", async () => {
      const mockWebSocket = {
        close: jest.fn(),
        send: jest.fn(),
        onopen: null,
        onclose: null,
        onerror: null,
        onmessage: null,
      };

      (global.WebSocket as jest.Mock).mockImplementation(() => mockWebSocket);

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

      // Error should be handled gracefully without changing state
      expect(result.current.status).toBe("disconnected");
    });

    it("should handle WebSocket message events", async () => {
      const mockWebSocket = {
        close: jest.fn(),
        send: jest.fn(),
        onopen: null,
        onclose: null,
        onerror: null,
        onmessage: null,
      };

      (global.WebSocket as jest.Mock).mockImplementation(() => mockWebSocket);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.ip).toBe("192.168.1.1");
      });

      // Simulate WebSocket message
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

    it("should close existing connection before creating new one", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <WebSocketProvider>{children}</WebSocketProvider>
      );

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      // Mock WebSocket
      const mockWebSocket1 = {
        close: jest.fn(),
        send: jest.fn(),
        onopen: null as any,
        onclose: null as any,
        onerror: null as any,
        onmessage: null as any,
      };

      const mockWebSocket2 = {
        close: jest.fn(),
        send: jest.fn(),
        onopen: null as any,
        onclose: null as any,
        onerror: null as any,
        onmessage: null as any,
      };

      let callCount = 0;
      (global as any).WebSocket = jest.fn(() => {
        callCount++;
        return callCount === 1 ? mockWebSocket1 : mockWebSocket2;
      });

      // First connection
      await act(async () => {
        await result.current.setIp("192.168.1.100");
      });

      // Second connection should close the first one
      await act(async () => {
        await result.current.setIp("192.168.1.200");
      });

      expect(mockWebSocket1.close).toHaveBeenCalled();
      expect(mockWebSocket2.close).not.toHaveBeenCalled();
    });
  });
});
