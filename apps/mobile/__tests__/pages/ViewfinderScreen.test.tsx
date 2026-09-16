import { ControlType } from "@5dcontrol/proto";
import { act, fireEvent, render } from "@testing-library/react-native";
import HomeScreen from "../../app/(tabs)/index";

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
}));

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: {
      View,
      createAnimatedComponent: (Component: React.ComponentType) => Component,
    },
    useSharedValue: (initial: unknown) => ({ value: initial }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (value: unknown) => value,
    withSequence: (...args: unknown[]) => args[0],
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    View,
  };
});

const mockSendCommand = jest.fn();
const mockReconnect = jest.fn();
const mockDisconnect = jest.fn();

jest.mock("../../components/WebSocketContext", () => ({
  useWebSocketContext: () => ({
    cameraStatus: "connected",
    status: "connected",
    ip: "192.168.1.50",
    httpPort: 8080,
    wsPort: 8888,
    batteryLevel: 80,
    lastImageReady: null,
    currentSettings: {
      shutterSpeed: "1/125",
      aperture: "f/5.6",
      iso: "400",
      exposureCompensation: "0",
    },
    availableSettings: {
      shutterSpeeds: ["1/125"],
      apertures: ["f/5.6"],
      isos: ["400"],
      exposureCompensations: ["0"],
    },
    sendCommand: mockSendCommand,
    setCameraSetting: jest.fn(),
    reconnect: mockReconnect,
    disconnect: mockDisconnect,
  }),
}));

jest.mock("../../contexts/SettingsContext", () => ({
  useSettings: () => ({ state: { gridType: "none" } }),
}));

jest.mock("../../components/CameraStream", () => {
  const React = require("react");
  const { Pressable } = require("react-native");
  return {
    CameraStream: ({
      onTap,
    }: {
      onTap?: (x: number, y: number, w: number, h: number) => void;
    }) =>
      React.createElement(Pressable, {
        testID: "camera-stream",
        onPress: () => onTap?.(40, 80, 200, 400),
      }),
  };
});

jest.mock("../../components/ExposureControls", () => ({
  ExposureControls: () => null,
}));

jest.mock("../../components/GridOverlay", () => ({
  GridOverlay: () => null,
}));

jest.mock("../../utils/galleryCache", () => ({
  downloadCaptureStill: jest.fn(),
  mediaUrlForIp: jest.fn(),
}));

describe("Viewfinder tap-to-focus", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockSendCommand.mockClear();
    mockReconnect.mockClear();
    mockDisconnect.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("places the focus reticle and sends FOCUS with normalized coords", () => {
    const { getByTestId } = render(<HomeScreen />);

    fireEvent.press(getByTestId("camera-stream"));

    expect(getByTestId("focus-indicator")).toBeTruthy();
    expect(mockSendCommand).toHaveBeenCalledWith(ControlType.FOCUS, {
      x: 0.2,
      y: 0.2,
    });

    act(() => {
      jest.advanceTimersByTime(800);
    });
  });

  it("reconnects and disconnects from the connection HUD", () => {
    const { getByTestId } = render(<HomeScreen />);

    fireEvent.press(getByTestId("connection-hud-toggle"));
    fireEvent.press(getByTestId("connection-hud-reconnect"));
    expect(mockReconnect).toHaveBeenCalled();

    fireEvent.press(getByTestId("connection-hud-toggle"));
    fireEvent.press(getByTestId("connection-hud-disconnect"));
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
