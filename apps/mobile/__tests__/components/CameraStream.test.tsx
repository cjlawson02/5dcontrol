import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';
import { CameraStream } from '../../components/CameraStream';

// Mock react-native-webview
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ onMessage, source, ...props }) => {
      const MockWebView = View;
      return (
        <MockWebView 
          {...props} 
          testID="webview"
          onMessage={onMessage}
          source={source}
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

    expect(getByTestId('webview')).toBeTruthy();
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
});
