import { ControlType, Message, MessageType } from "@5dcontrol/proto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import {
  WebSocketProvider,
  useWebSocketContext,
} from "../../components/WebSocketContext";

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe("WebSocketContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue();
  });

  // Helper function to create wrapper with all required providers
  const createWrapper = () => ({ children }: { children: React.ReactNode }) => (
    <WebSocketProvider>{children}</WebSocketProvider>
  );

  describe("WebSocketProvider", () => {
    it("should provide initial loading state", () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      // In test environment, initial state is set immediately
      expect(result.current.status).toBe("disconnected");
      expect(result.current.cameraStatus).toBe("loading");
      expect(result.current.ip).toBe("192.168.1.1");
    });

    it("should load default IP from storage on mount", async () => {
      mockAsyncStorage.getItem.mockResolvedValue("192.168.1.100");

      const wrapper = createWrapper();

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

      const wrapper = createWrapper();

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

      const wrapper = createWrapper();

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
      const wrapper = createWrapper();

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await act(async () => {
        result.current.setIp("192.168.1.200");
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

      const wrapper = createWrapper();

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await act(async () => {
        result.current.setIp("192.168.1.200");
      });

      // State should be updated immediately
      expect(result.current.ip).toBe("192.168.1.200");
    });
  });

  describe("reconnect", () => {
    it("should trigger reconnection", async () => {
      const wrapper = createWrapper();

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

      (global.WebSocket as unknown as jest.Mock).mockImplementation(
        () => mockWebSocket
      );

      const wrapper = createWrapper();

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.ip).toBe("192.168.1.1");
      });

      act(() => {
        result.current.reconnect();
      });

      await waitFor(() => {
        expect(global.WebSocket).toHaveBeenCalled();
      });

      act(() => {
        result.current.sendCommand(ControlType.FOCUS);
      });

      expect(mockWebSocket.send).toHaveBeenCalled();
    });

    it("should not send command when WebSocket is not available", async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.ip).toBe("192.168.1.1");
      });

      // Mock WebSocket to be null
      const originalWebSocket = global.WebSocket;
      global.WebSocket = jest.fn().mockImplementation(() => null) as any;

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
        onopen: null as null | (() => void),
        onclose: null as null | ((e: { code: number; reason: string }) => void),
        onerror: null,
        onmessage: null,
      };

      (global.WebSocket as unknown as jest.Mock).mockImplementation(
        () => mockWebSocket
      );

      const wrapper = createWrapper();

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.ip).toBe("192.168.1.1");
      });

      act(() => {
        result.current.reconnect();
      });

      await waitFor(() => {
        expect(mockWebSocket.onopen).toEqual(expect.any(Function));
      });

      act(() => {
        mockWebSocket.onopen?.();
      });

      await waitFor(() => {
        expect(result.current.status).toBe("connected");
      });

      act(() => {
        mockWebSocket.onclose?.({ code: 1000, reason: "Normal closure" });
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
        onerror: null as null | ((e: Error) => void),
        onmessage: null,
      };

      (global.WebSocket as unknown as jest.Mock).mockImplementation(
        () => mockWebSocket
      );

      const wrapper = createWrapper();

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.ip).toBe("192.168.1.1");
      });

      act(() => {
        result.current.reconnect();
      });

      await waitFor(() => {
        expect(mockWebSocket.onerror).toEqual(expect.any(Function));
      });

      act(() => {
        mockWebSocket.onerror?.(new Error("Connection failed"));
      });

      expect(result.current.status).toBe("disconnected");
    });

    it("should handle WebSocket message events", async () => {
      const mockStatus = {
        cameraConnected: jest.fn(() => true),
        batteryLevel: jest.fn(() => 85),
      };
      const mockMessage = {
        messageType: jest.fn(() => MessageType.STATUS),
        status: jest.fn(() => mockStatus),
      };

      jest
        .spyOn(Message, "getRootAsMessage")
        .mockReturnValue(mockMessage as any);

      const mockWebSocket = {
        close: jest.fn(),
        send: jest.fn(),
        onopen: null,
        onclose: null,
        onerror: null,
        onmessage: null as null | ((e: { data: Uint8Array }) => Promise<void>),
      };

      (global.WebSocket as unknown as jest.Mock).mockImplementation(
        () => mockWebSocket
      );

      const wrapper = createWrapper();

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.ip).toBe("192.168.1.1");
      });

      act(() => {
        result.current.reconnect();
      });

      await waitFor(() => {
        expect(mockWebSocket.onmessage).toEqual(expect.any(Function));
      });

      await act(async () => {
        await mockWebSocket.onmessage?.({
          data: new Uint8Array([1, 2, 3, 4]),
        });
      });

      await waitFor(() => {
        expect(result.current.cameraStatus).toBe("connected");
      });
    });

    it("should close existing connection before creating new one", async () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useWebSocketContext(), { wrapper });

      await waitFor(() => {
        expect(result.current.ip).toBe("192.168.1.1");
      });

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

      await act(async () => {
        await result.current.setIp("192.168.1.100");
        result.current.reconnect();
      });

      await waitFor(() => {
        expect(callCount).toBe(1);
      });

      await act(async () => {
        await result.current.setIp("192.168.1.200");
        result.current.reconnect();
      });

      await waitFor(() => {
        expect(mockWebSocket1.close).toHaveBeenCalled();
        expect(callCount).toBe(2);
      });
    });
  });
});
