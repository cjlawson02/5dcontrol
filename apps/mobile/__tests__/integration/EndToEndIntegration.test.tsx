import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { CameraStream } from "../../components/CameraStream";
import { CaptureButton } from "../../components/CaptureButton";
import { FocusIndicator } from "../../components/FocusIndicator";
import { GridOverlay } from "../../components/GridOverlay";
import { TopStatusBar } from "../../components/TopStatusBar";
import { WebSocketProvider } from "../../components/WebSocketContext";
import { SettingsProvider } from "../../contexts/SettingsContext";
import { IntegrationTestHelper } from "./IntegrationTestUtils.util";

// Mock dependencies
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock WebSocket
const mockWebSocket = {
  close: jest.fn(),
  send: jest.fn(),
  onopen: null as (() => void) | null,
  onclose: null as ((event: any) => void) | null,
  onerror: null as ((error: any) => void) | null,
  onmessage: null as ((event: any) => void) | null,
  readyState: 1, // OPEN
};

const mockWebSocketConstructor = jest.fn(() => mockWebSocket);
(global as any).WebSocket = mockWebSocketConstructor;

// Mock WebView
const mockWebView = {
  source: { html: "" },
  onMessage: jest.fn(),
  style: {},
  scrollEnabled: false,
  bounces: false,
  showsHorizontalScrollIndicator: false,
  showsVerticalScrollIndicator: false,
};

jest.mock("react-native-webview", () => {
  const { View } = require("react-native");
  const React = require("react");
  return {
    __esModule: true,
    default: jest.fn(({ source, onMessage, ...props }) => {
      mockWebView.onMessage = onMessage;
      mockWebView.source = source;
      return React.createElement(View, { testID: "webview", ...props });
    }),
  };
});

// Mock haptics
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: "light",
    Medium: "medium",
    Heavy: "heavy",
  },
}));

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

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <WebSocketProvider>
    <SettingsProvider>{children}</SettingsProvider>
  </WebSocketProvider>
);

// Mock camera screen component
const MockCameraScreen = () => {
  const [frameCount, setFrameCount] = React.useState(0);
  const [showFocusIndicator, setShowFocusIndicator] = React.useState(false);

  const handleFrame = () => {
    setFrameCount((prev) => prev + 1);
  };

  const handleFocus = () => {
    setShowFocusIndicator(true);
    setTimeout(() => setShowFocusIndicator(false), 800);
  };

  return (
    <>
      <CameraStream
        url="http://localhost:8081/live.mjpeg"
        onFrame={handleFrame}
      />
      <GridOverlay gridType="rule-of-thirds" />
      {showFocusIndicator && <FocusIndicator x={100} y={100} />}
      <CaptureButton onPress={() => {}} />
      <TopStatusBar batteryLevel={85} signalStrength={4} />
    </>
  );
};

describe("End-to-End Integration Tests", () => {
  let testHelper: IntegrationTestHelper;

  beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue();

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

  describe("Complete Camera Control Workflow", () => {
    it("should establish connection and start streaming", async () => {
      await testHelper.setupTestServer();

      render(
        <TestWrapper>
          <MockCameraScreen />
        </TestWrapper>
      );

      // Wait for WebSocket connection
      await waitFor(() => {
        expect(mockWebSocketConstructor).toHaveBeenCalled();
      });

      // Simulate WebSocket connection
      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen();
        }
      });

      // Wait for MJPEG stream to start
      await waitFor(
        () => {
          expect(testHelper.getTestServer()?.getFrameCount()).toBeGreaterThan(
            0
          );
        },
        { timeout: 5000 }
      );

      // Verify both WebSocket and MJPEG are working
      expect(mockWebSocket.send).toHaveBeenCalled(); // Initial status query
      expect(testHelper.getTestServer()?.getConnectionCount()).toBe(1);
    });

    it("should handle focus command end-to-end", async () => {
      await testHelper.setupTestServer();

      const { getByTestId } = render(
        <TestWrapper>
          <MockCameraScreen />
        </TestWrapper>
      );

      // Wait for connection
      await waitFor(() => {
        expect(mockWebSocketConstructor).toHaveBeenCalled();
      });

      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen();
        }
      });

      // Simulate tap-to-focus (this would normally come from CameraStream)
      act(() => {
        if (mockWebView.onMessage) {
          mockWebView.onMessage({
            nativeEvent: {
              data: JSON.stringify({ type: "focus", x: 100, y: 100 }),
            },
          });
        }
      });

      // Should send focus command
      await waitFor(() => {
        expect(mockWebSocket.send).toHaveBeenCalled();
      });
    });

    it("should handle capture command end-to-end", async () => {
      await testHelper.setupTestServer();

      const { getByTestId } = render(
        <TestWrapper>
          <MockCameraScreen />
        </TestWrapper>
      );

      // Wait for connection
      await waitFor(() => {
        expect(mockWebSocketConstructor).toHaveBeenCalled();
      });

      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen();
        }
      });

      // Find and press capture button
      const captureButton = getByTestId("capture-button");
      fireEvent.press(captureButton);

      // Should send capture command
      await waitFor(() => {
        expect(mockWebSocket.send).toHaveBeenCalled();
      });
    });

    it("should handle status updates from server", async () => {
      const { Message } = require("@proto/control");
      const { ByteBuffer } = require("flatbuffers");

      await testHelper.setupTestServer();

      // Mock status message
      const mockStatusMessage = {
        messageType: () => 2, // STATUS
        status: () => ({
          cameraConnected: () => true,
          batteryLevel: () => 75,
        }),
      };

      Message.getRootAsMessage.mockReturnValue(mockStatusMessage);

      const { getByTestId } = render(
        <TestWrapper>
          <MockCameraScreen />
        </TestWrapper>
      );

      // Wait for connection
      await waitFor(() => {
        expect(mockWebSocketConstructor).toHaveBeenCalled();
      });

      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen();
        }
      });

      // Simulate status message from server
      act(() => {
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage({
            data: new Uint8Array([1, 2, 3, 4]),
          });
        }
      });

      // Should handle status update
      await waitFor(() => {
        expect(Message.getRootAsMessage).toHaveBeenCalled();
      });
    });
  });

  describe("Error Recovery", () => {
    it("should handle WebSocket disconnection and reconnect", async () => {
      await testHelper.setupTestServer();

      const { getByTestId } = render(
        <TestWrapper>
          <MockCameraScreen />
        </TestWrapper>
      );

      // Wait for initial connection
      await waitFor(() => {
        expect(mockWebSocketConstructor).toHaveBeenCalled();
      });

      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen();
        }
      });

      // Simulate disconnection
      act(() => {
        if (mockWebSocket.onclose) {
          mockWebSocket.onclose({ code: 1000, reason: "Test disconnect" });
        }
      });

      // Should attempt reconnection
      await waitFor(() => {
        expect(mockWebSocketConstructor).toHaveBeenCalledTimes(2);
      });
    });

    it("should handle MJPEG stream interruption", async () => {
      await testHelper.setupTestServer();

      const { getByTestId } = render(
        <TestWrapper>
          <MockCameraScreen />
        </TestWrapper>
      );

      // Wait for initial stream
      await waitFor(
        () => {
          expect(testHelper.getTestServer()?.getFrameCount()).toBeGreaterThan(
            0
          );
        },
        { timeout: 5000 }
      );

      // Stop server
      await testHelper.teardownTestServer();

      // Component should still be rendered (graceful degradation)
      expect(getByTestId("webview")).toBeTruthy();
    });

    it("should handle server restart gracefully", async () => {
      await testHelper.setupTestServer();

      const { getByTestId } = render(
        <TestWrapper>
          <MockCameraScreen />
        </TestWrapper>
      );

      // Wait for initial connection
      await waitFor(() => {
        expect(mockWebSocketConstructor).toHaveBeenCalled();
      });

      // Stop and restart server
      await testHelper.teardownTestServer();
      await testHelper.setupTestServer();

      // Should continue working
      expect(getByTestId("webview")).toBeTruthy();
    });
  });

  describe("Performance and Stress Testing", () => {
    it("should handle rapid command sending", async () => {
      await testHelper.setupTestServer();

      const { getByTestId } = render(
        <TestWrapper>
          <MockCameraScreen />
        </TestWrapper>
      );

      // Wait for connection
      await waitFor(() => {
        expect(mockWebSocketConstructor).toHaveBeenCalled();
      });

      act(() => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen();
        }
      });

      // Send multiple commands rapidly
      const captureButton = getByTestId("capture-button");
      for (let i = 0; i < 10; i++) {
        fireEvent.press(captureButton);
      }

      // Should handle all commands
      await waitFor(() => {
        expect(mockWebSocket.send).toHaveBeenCalledTimes(10);
      });
    });

    it("should handle high frame rate streaming", async () => {
      await testHelper.setupTestServer();

      const { getByTestId } = render(
        <TestWrapper>
          <MockCameraScreen />
        </TestWrapper>
      );

      // Wait for high frame count
      await waitFor(
        () => {
          expect(testHelper.getTestServer()?.getFrameCount()).toBeGreaterThan(
            50
          );
        },
        { timeout: 10000 }
      );

      // Should handle high frame rate without issues
      expect(getByTestId("webview")).toBeTruthy();
    });

    it("should handle concurrent connections", async () => {
      await testHelper.setupTestServer();

      // Create multiple camera screens
      const { getByTestId: getByTestId1 } = render(
        <TestWrapper>
          <MockCameraScreen />
        </TestWrapper>
      );

      const { getByTestId: getByTestId2 } = render(
        <TestWrapper>
          <MockCameraScreen />
        </TestWrapper>
      );

      // Wait for connections
      await waitFor(
        () => {
          expect(testHelper.getTestServer()?.getConnectionCount()).toBe(2);
        },
        { timeout: 5000 }
      );

      // Both should work independently
      expect(getByTestId1("webview")).toBeTruthy();
      expect(getByTestId2("webview")).toBeTruthy();
    });
  });

  describe("Real Server Integration", () => {
    it("should work with real test server", async () => {
      await testHelper.setupTestServer();

      const { getByTestId } = render(
        <TestWrapper>
          <MockCameraScreen />
        </TestWrapper>
      );

      // Wait for real connection
      await waitFor(
        () => {
          expect(testHelper.getTestServer()?.getConnectionCount()).toBe(1);
        },
        { timeout: 5000 }
      );

      // Wait for real MJPEG stream
      await waitFor(
        () => {
          expect(testHelper.getTestServer()?.getFrameCount()).toBeGreaterThan(
            0
          );
        },
        { timeout: 5000 }
      );

      // Verify everything is working
      expect(testHelper.getTestServer()?.getConnectionCount()).toBe(1);
      expect(testHelper.getTestServer()?.getFrameCount()).toBeGreaterThan(0);
    });

    it("should handle server-side camera status changes", async () => {
      await testHelper.setupTestServer();

      const { getByTestId } = render(
        <TestWrapper>
          <MockCameraScreen />
        </TestWrapper>
      );

      // Wait for initial connection
      await waitFor(
        () => {
          expect(testHelper.getTestServer()?.getConnectionCount()).toBe(1);
        },
        { timeout: 5000 }
      );

      // Simulate camera disconnect
      await testHelper.simulateCameraDisconnect();

      // Wait for status update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should handle status change
      expect(testHelper.getTestServer()?.getConnectionCount()).toBe(1);
    });

    it("should handle server-side battery level changes", async () => {
      await testHelper.setupTestServer();

      const { getByTestId } = render(
        <TestWrapper>
          <MockCameraScreen />
        </TestWrapper>
      );

      // Wait for initial connection
      await waitFor(
        () => {
          expect(testHelper.getTestServer()?.getConnectionCount()).toBe(1);
        },
        { timeout: 5000 }
      );

      // Simulate battery level change
      await testHelper.simulateBatteryChange(50);

      // Wait for status update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should handle battery change
      expect(testHelper.getTestServer()?.getConnectionCount()).toBe(1);
    });
  });

  describe("Component Integration", () => {
    it("should integrate all camera components", async () => {
      await testHelper.setupTestServer();

      const { getByTestId } = render(
        <TestWrapper>
          <MockCameraScreen />
        </TestWrapper>
      );

      // All components should be rendered
      expect(getByTestId("webview")).toBeTruthy();
      expect(getByTestId("capture-button")).toBeTruthy();
      expect(getByTestId("grid-overlay")).toBeTruthy();
      expect(getByTestId("top-status-bar")).toBeTruthy();
    });

    it("should handle component state synchronization", async () => {
      await testHelper.setupTestServer();

      const { getByTestId } = render(
        <TestWrapper>
          <MockCameraScreen />
        </TestWrapper>
      );

      // Wait for connection
      await waitFor(() => {
        expect(mockWebSocketConstructor).toHaveBeenCalled();
      });

      // All components should be in sync
      expect(getByTestId("webview")).toBeTruthy();
      expect(getByTestId("capture-button")).toBeTruthy();
    });
  });
});
