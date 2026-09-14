// Using built-in Jest matchers from @testing-library/react-native v12.4+
// jest-expo preset handles Flow syntax automatically

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock expo-haptics
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: "light",
    Medium: "medium",
    Heavy: "heavy",
  },
}));

// Mock expo-screen-orientation
jest.mock("expo-screen-orientation", () => ({
  lockAsync: jest.fn(),
  OrientationLock: {
    LANDSCAPE: "landscape",
  },
}));

// Mock react-native-webview
jest.mock("react-native-webview", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ onMessage, source, ...props }) => {
      const MockWebView = View;
      return require("react").createElement(MockWebView, {
        ...props,
        testID: "webview",
      });
    },
  };
});

// Mock flatbuffers
jest.mock("flatbuffers", () => ({
  Builder: jest.fn().mockImplementation(() => ({
    startObject: jest.fn(),
    endObject: jest.fn(() => 0),
    addFieldInt8: jest.fn(),
    addFieldInt16: jest.fn(),
    addFieldInt32: jest.fn(),
    addFieldInt64: jest.fn(),
    addFieldOffset: jest.fn(),
    addOffset: jest.fn(),
    createString: jest.fn(() => 0),
    asUint8Array: jest.fn(() => new Uint8Array([1, 2, 3, 4])),
    finish: jest.fn(),
  })),
  ByteBuffer: jest.fn().mockImplementation(() => ({
    position: jest.fn(() => 0),
    readInt32: jest.fn(() => 0),
    setPosition: jest.fn(),
  })),
}));

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  close: jest.fn(),
  send: jest.fn(),
  onopen: null,
  onclose: null,
  onerror: null,
  onmessage: null,
}));

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalConsoleLog = console.log;

// Set up console mocks immediately
console.error = (...args) => {
  if (
    typeof args[0] === "string" &&
    args[0].includes("Warning: ReactDOM.render is no longer supported")
  ) {
    return;
  }
  originalConsoleError.call(console, ...args);
};

console.warn = (...args) => {
  if (
    typeof args[0] === "string" &&
    args[0].includes("componentWillReceiveProps")
  ) {
    return;
  }
  originalConsoleWarn.call(console, ...args);
};

console.log = (...args) => {
  if (
    typeof args[0] === "string" &&
    (args[0].includes("[WebSocket]") || args[0].includes("[ConnectionPage]"))
  ) {
    return;
  }
  originalConsoleLog.call(console, ...args);
};
