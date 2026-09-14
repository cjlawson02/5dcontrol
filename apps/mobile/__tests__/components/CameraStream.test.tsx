import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { CameraStream } from '../../components/CameraStream';

jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    __esModule: true,
    default: {
      View,
      createAnimatedComponent: (Component: React.ComponentType) => Component,
    },
    useSharedValue: (initial: unknown) => ({ value: initial }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (value: unknown) => value,
    View,
  };
});

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    GestureHandlerRootView: View,
    GestureDetector: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, { testID: 'gesture-detector' }, children),
    Gesture: {
      Pinch: () => ({
        onStart: function (this: unknown) {
          return this;
        },
        onUpdate: function (this: unknown) {
          return this;
        },
        onEnd: function (this: unknown) {
          return this;
        },
      }),
      Pan: () => ({
        onStart: function (this: unknown) {
          return this;
        },
        onUpdate: function (this: unknown) {
          return this;
        },
        onEnd: function (this: unknown) {
          return this;
        },
      }),
      Simultaneous: (...gestures: unknown[]) => gestures,
    },
  };
});

// Mock react-native-webview
jest.mock('react-native-webview', () => {
  return {
    __esModule: true,
    default: (props: any) => {
      const { View } = require('react-native');
      const MockWebView = View;
      return (
        <MockWebView
          {...props}
          testID="webview"
        />
      );
    },
  };
});

describe('CameraStream', () => {
  const mockOnFrame = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render correctly with given URL', () => {
    const url = 'http://192.168.1.1:8080/live.mjpeg';
    const { getByTestId } = render(<CameraStream url={url} onFrame={mockOnFrame} />);

    expect(getByTestId('camera-stream')).toBeTruthy();
    expect(getByTestId('webview')).toBeTruthy();
    expect(getByTestId('camera-stream-gestures')).toBeTruthy();
  });

  it('should call onFrame when frame message is received', () => {
    const url = 'http://192.168.1.1:8080/live.mjpeg';
    const { getByTestId } = render(<CameraStream url={url} onFrame={mockOnFrame} />);

    const webView = getByTestId('webview');

    // Simulate receiving a "frame" message
    fireEvent(webView, 'onMessage', {
      nativeEvent: { data: 'frame' }
    });

    expect(mockOnFrame).toHaveBeenCalledTimes(1);
  });

  it('should not call onFrame for non-frame messages', () => {
    const url = 'http://192.168.1.1:8080/live.mjpeg';
    const { getByTestId } = render(<CameraStream url={url} onFrame={mockOnFrame} />);

    const webView = getByTestId('webview');

    // Simulate receiving a non-frame message
    fireEvent(webView, 'onMessage', {
      nativeEvent: { data: 'other-message' }
    });

    expect(mockOnFrame).not.toHaveBeenCalled();
  });

  it('should call onFrame multiple times for multiple frame messages', () => {
    const url = 'http://192.168.1.1:8080/live.mjpeg';
    const { getByTestId } = render(<CameraStream url={url} onFrame={mockOnFrame} />);

    const webView = getByTestId('webview');

    // Simulate receiving multiple frame messages
    fireEvent(webView, 'onMessage', { nativeEvent: { data: 'frame' } });
    fireEvent(webView, 'onMessage', { nativeEvent: { data: 'frame' } });
    fireEvent(webView, 'onMessage', { nativeEvent: { data: 'frame' } });

    expect(mockOnFrame).toHaveBeenCalledTimes(3);
  });

  it('should handle different URL formats', () => {
    const urls = [
      'http://192.168.1.1:8080/live.mjpeg',
      'https://example.com/stream.mjpeg',
      'http://localhost:8080/live.mjpeg',
      'http://10.0.0.1:8080/live.mjpeg',
    ];

    urls.forEach((url) => {
      const { getByTestId } = render(<CameraStream url={url} onFrame={mockOnFrame} />);
      expect(getByTestId('webview')).toBeTruthy();
    });
  });

  it('should handle empty URL', () => {
    const { getByTestId } = render(<CameraStream url="" onFrame={mockOnFrame} />);
    expect(getByTestId('webview')).toBeTruthy();
  });

  it('should handle undefined onFrame callback', () => {
    const url = 'http://192.168.1.1:8080/live.mjpeg';
    const { getByTestId } = render(<CameraStream url={url} onFrame={undefined as any} />);

    const webView = getByTestId('webview');

    // Should not throw error when onFrame is undefined
    expect(() => {
      fireEvent(webView, 'onMessage', {
        nativeEvent: { data: 'frame' }
      });
    }).not.toThrow();
  });

  it('should handle mixed message types', () => {
    const url = 'http://192.168.1.1:8080/live.mjpeg';
    const { getByTestId } = render(<CameraStream url={url} onFrame={mockOnFrame} />);

    const webView = getByTestId('webview');

    // Mix of frame and non-frame messages
    fireEvent(webView, 'onMessage', { nativeEvent: { data: 'other' } });
    fireEvent(webView, 'onMessage', { nativeEvent: { data: 'frame' } });
    fireEvent(webView, 'onMessage', { nativeEvent: { data: 'another' } });
    fireEvent(webView, 'onMessage', { nativeEvent: { data: 'frame' } });

    expect(mockOnFrame).toHaveBeenCalledTimes(2);
  });

  it('should handle special characters in URL', () => {
    const url = 'http://192.168.1.1:8080/live.mjpeg?param=value&other=test';
    const { getByTestId } = render(<CameraStream url={url} onFrame={mockOnFrame} />);

    expect(getByTestId('webview')).toBeTruthy();
  });

  it('should handle very long URLs', () => {
    const longUrl = 'http://192.168.1.1:8080/live.mjpeg?' + 'a'.repeat(1000);
    const { getByTestId } = render(<CameraStream url={longUrl} onFrame={mockOnFrame} />);

    expect(getByTestId('webview')).toBeTruthy();
  });

  it('should keep WebView HTML free of touch handlers', () => {
    const url = 'http://192.168.1.1:8080/live.mjpeg';
    const { getByTestId } = render(<CameraStream url={url} onFrame={mockOnFrame} />);

    const webView = getByTestId('webview');
    const html = webView.props.source?.html ?? '';

    expect(html).toContain(url);
    expect(html).toContain("postMessage('frame')");
    expect(html).not.toContain('touchstart');
    expect(html).not.toContain('touchmove');
    expect(html).not.toContain('touchend');
    expect(html).toContain('object-fit: contain');
  });
});
