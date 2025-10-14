import { render, waitFor } from "@testing-library/react-native";
import React from "react";
import { CameraStream } from "../../components/CameraStream";
import { IntegrationTestHelper } from "./IntegrationTestUtils.util";

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
      // Store the onMessage handler for testing
      mockWebView.onMessage = onMessage;
      mockWebView.source = source;
      return React.createElement(View, { testID: "webview", ...props });
    }),
  };
});

describe("MJPEG Streaming Integration Tests", () => {
  let testHelper: IntegrationTestHelper;

  beforeEach(() => {
    jest.clearAllMocks();
    testHelper = new IntegrationTestHelper();
  });

  afterEach(async () => {
    await testHelper.teardownTestServer();
  });

  describe("MJPEG Stream Connection", () => {
    it("should connect to MJPEG stream and receive frames", async () => {
      await testHelper.setupTestServer();

      const onFrame = jest.fn();
      const mjpegUrl = testHelper.getMjpegUrl();

      render(<CameraStream url={mjpegUrl} onFrame={onFrame} />);

      // Wait for frames to be received
      await waitFor(
        () => {
          expect(testHelper.getTestServer()?.getFrameCount()).toBeGreaterThan(
            0
          );
        },
        { timeout: 5000 }
      );

      // Verify WebView was rendered with correct URL
      expect(mockWebView.source.html).toContain(mjpegUrl);
    });

    it("should handle MJPEG stream errors gracefully", async () => {
      const onFrame = jest.fn();
      const invalidUrl = "http://localhost:9999/invalid";

      render(<CameraStream url={invalidUrl} onFrame={onFrame} />);

      // Should not crash and should render WebView
      expect(mockWebView.source.html).toContain(invalidUrl);
    });

    it("should update stream URL when prop changes", async () => {
      await testHelper.setupTestServer();

      const onFrame = jest.fn();
      const initialUrl = testHelper.getMjpegUrl();
      const newUrl = "http://localhost:8082/live.mjpeg";

      const { rerender } = render(
        <CameraStream url={initialUrl} onFrame={onFrame} />
      );

      expect(mockWebView.source.html).toContain(initialUrl);

      // Change URL
      rerender(<CameraStream url={newUrl} onFrame={onFrame} />);

      expect(mockWebView.source.html).toContain(newUrl);
    });
  });

  describe("Frame Processing", () => {
    it("should call onFrame callback when frames are received", async () => {
      await testHelper.setupTestServer();

      const onFrame = jest.fn();
      const mjpegUrl = testHelper.getMjpegUrl();

      render(<CameraStream url={mjpegUrl} onFrame={onFrame} />);

      // Wait for frames to be received
      await waitFor(
        () => {
          expect(testHelper.getTestServer()?.getFrameCount()).toBeGreaterThan(
            0
          );
        },
        { timeout: 5000 }
      );

      // Simulate frame message from WebView
      if (mockWebView.onMessage) {
        mockWebView.onMessage({ nativeEvent: { data: "frame" } });
      }

      expect(onFrame).toHaveBeenCalled();
    });

    it("should handle multiple frame messages", async () => {
      await testHelper.setupTestServer();

      const onFrame = jest.fn();
      const mjpegUrl = testHelper.getMjpegUrl();

      render(<CameraStream url={mjpegUrl} onFrame={onFrame} />);

      // Wait for frames to be received
      await waitFor(
        () => {
          expect(testHelper.getTestServer()?.getFrameCount()).toBeGreaterThan(
            0
          );
        },
        { timeout: 5000 }
      );

      // Simulate multiple frame messages
      if (mockWebView.onMessage) {
        mockWebView.onMessage({ nativeEvent: { data: "frame" } });
        mockWebView.onMessage({ nativeEvent: { data: "frame" } });
        mockWebView.onMessage({ nativeEvent: { data: "frame" } });
      }

      expect(onFrame).toHaveBeenCalledTimes(3);
    });

    it("should ignore non-frame messages", async () => {
      await testHelper.setupTestServer();

      const onFrame = jest.fn();
      const mjpegUrl = testHelper.getMjpegUrl();

      render(<CameraStream url={mjpegUrl} onFrame={onFrame} />);

      // Wait for frames to be received
      await waitFor(
        () => {
          expect(testHelper.getTestServer()?.getFrameCount()).toBeGreaterThan(
            0
          );
        },
        { timeout: 5000 }
      );

      // Simulate non-frame messages
      if (mockWebView.onMessage) {
        mockWebView.onMessage({ nativeEvent: { data: "other" } });
        mockWebView.onMessage({ nativeEvent: { data: "error" } });
        mockWebView.onMessage({ nativeEvent: { data: "frame" } });
      }

      expect(onFrame).toHaveBeenCalledTimes(1);
    });
  });

  describe("WebView HTML Content", () => {
    it("should generate correct HTML with MJPEG URL", async () => {
      const onFrame = jest.fn();
      const mjpegUrl = "http://localhost:8080/live.mjpeg";

      render(<CameraStream url={mjpegUrl} onFrame={onFrame} />);

      const html = mockWebView.source.html;

      // Check for key HTML elements
      expect(html).toContain("<html>");
      expect(html).toContain("<head>");
      expect(html).toContain("<body>");
      expect(html).toContain('<div id="container">');
      expect(html).toContain('<img id="view"');
      expect(html).toContain(`src="${mjpegUrl}"`);

      // Check for viewport meta tag
      expect(html).toContain("viewport");
      expect(html).toContain("user-scalable=yes");
      expect(html).toContain("maximum-scale=5.0");

      // Check for touch handling
      expect(html).toContain("touchstart");
      expect(html).toContain("touchmove");
      expect(html).toContain("touchend");

      // Check for zoom constraints
      expect(html).toContain("Math.max(1.0, Math.min(5.0, newScale))");
    });

    it("should include proper CSS styles", async () => {
      const onFrame = jest.fn();
      const mjpegUrl = "http://localhost:8080/live.mjpeg";

      render(<CameraStream url={mjpegUrl} onFrame={onFrame} />);

      const html = mockWebView.source.html;

      // Check for CSS styles
      expect(html).toContain("position: fixed");
      expect(html).toContain("overflow: hidden");
      expect(html).toContain("background: black");
      expect(html).toContain("object-fit: contain");
      expect(html).toContain("transform-origin: center center");
      expect(html).toContain("touch-action: none");
    });

    it("should include JavaScript for touch handling", async () => {
      const onFrame = jest.fn();
      const mjpegUrl = "http://localhost:8080/live.mjpeg";

      render(<CameraStream url={mjpegUrl} onFrame={onFrame} />);

      const html = mockWebView.source.html;

      // Check for JavaScript functions
      expect(html).toContain("getDistance");
      expect(html).toContain("getCenter");
      expect(html).toContain("constrainTranslate");
      expect(html).toContain("updateTransform");
      expect(html).toContain("ReactNativeWebView.postMessage");
    });
  });

  describe("Stream Performance", () => {
    it("should handle high frame rate streams", async () => {
      await testHelper.setupTestServer();

      const onFrame = jest.fn();
      const mjpegUrl = testHelper.getMjpegUrl();

      render(<CameraStream url={mjpegUrl} onFrame={onFrame} />);

      // Wait for multiple frames
      await waitFor(
        () => {
          expect(testHelper.getTestServer()?.getFrameCount()).toBeGreaterThan(
            10
          );
        },
        { timeout: 5000 }
      );

      // Should handle the stream without errors
      expect(mockWebView.source.html).toContain(mjpegUrl);
    });

    it("should handle stream interruptions", async () => {
      await testHelper.setupTestServer();

      const onFrame = jest.fn();
      const mjpegUrl = testHelper.getMjpegUrl();

      render(<CameraStream url={mjpegUrl} onFrame={onFrame} />);

      // Wait for initial frames
      await waitFor(
        () => {
          expect(testHelper.getTestServer()?.getFrameCount()).toBeGreaterThan(
            0
          );
        },
        { timeout: 5000 }
      );

      // Stop the test server
      await testHelper.teardownTestServer();

      // Component should still be rendered (graceful degradation)
      expect(mockWebView.source.html).toContain(mjpegUrl);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid MJPEG URLs", async () => {
      const onFrame = jest.fn();
      const invalidUrl = "not-a-valid-url";

      render(<CameraStream url={invalidUrl} onFrame={onFrame} />);

      // Should still render WebView with the URL
      expect(mockWebView.source.html).toContain(invalidUrl);
    });

    it("should handle empty URL", async () => {
      const onFrame = jest.fn();
      const emptyUrl = "";

      render(<CameraStream url={emptyUrl} onFrame={onFrame} />);

      // Should still render WebView
      expect(mockWebView.source.html).toContain('src=""');
    });

    it("should handle missing onFrame callback", async () => {
      // This should not crash
      expect(() => {
        render(
          <CameraStream
            url="http://localhost:8080/live.mjpeg"
            onFrame={undefined as any}
          />
        );
      }).not.toThrow();
    });
  });

  describe("Real Server Integration", () => {
    it("should connect to real MJPEG server", async () => {
      await testHelper.setupTestServer();

      const onFrame = jest.fn();
      const mjpegUrl = testHelper.getMjpegUrl();

      render(<CameraStream url={mjpegUrl} onFrame={onFrame} />);

      // Wait for server to start sending frames
      await waitFor(
        () => {
          expect(testHelper.getTestServer()?.getFrameCount()).toBeGreaterThan(
            0
          );
        },
        { timeout: 5000 }
      );

      // Verify the stream is working
      expect(testHelper.getTestServer()?.getFrameCount()).toBeGreaterThan(0);
    });

    it("should handle server restart", async () => {
      await testHelper.setupTestServer();

      const onFrame = jest.fn();
      const mjpegUrl = testHelper.getMjpegUrl();

      render(<CameraStream url={mjpegUrl} onFrame={onFrame} />);

      // Wait for initial frames
      await waitFor(
        () => {
          expect(testHelper.getTestServer()?.getFrameCount()).toBeGreaterThan(
            0
          );
        },
        { timeout: 5000 }
      );

      const initialFrameCount =
        testHelper.getTestServer()?.getFrameCount() || 0;

      // Restart server
      await testHelper.teardownTestServer();
      await testHelper.setupTestServer();

      // Wait for new frames
      await waitFor(
        () => {
          expect(testHelper.getTestServer()?.getFrameCount()).toBeGreaterThan(
            initialFrameCount
          );
        },
        { timeout: 5000 }
      );

      // Should continue working
      expect(testHelper.getTestServer()?.getFrameCount()).toBeGreaterThan(
        initialFrameCount
      );
    });
  });
});
