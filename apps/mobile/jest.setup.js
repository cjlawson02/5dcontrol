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
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: "light",
    Medium: "medium",
    Heavy: "heavy",
  },
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
}));

// Mock expo-glass-effect (iOS liquid glass; View fallback in unit tests)
jest.mock("expo-glass-effect", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    GlassView: ({ children, ...props }) =>
      React.createElement(View, { testID: "glass-view", ...props }, children),
    GlassContainer: ({ children, ...props }) =>
      React.createElement(
        View,
        { testID: "glass-container", ...props },
        children
      ),
    isLiquidGlassAvailable: () => false,
    isGlassEffectAPIAvailable: () => false,
  };
});

// Mock expo-file-system (new File / Directory / Paths API)
jest.mock("expo-file-system", () => {
  const store = new Map();

  class MockFile {
    uri;
    name;
    constructor(...parts) {
      const segments = parts.map((p) =>
        typeof p === "string" ? p.replace(/\/$/, "") : p.uri?.replace(/\/$/, "")
      );
      this.uri = segments.join("/") + (segments.at(-1)?.includes(".") ? "" : "");
      // Normalize: last segment is name when it's a file path
      const last = String(segments[segments.length - 1] ?? "");
      this.name = last.includes("/") ? last.split("/").pop() : last;
      if (!this.uri.startsWith("file://")) {
        this.uri = `file://${this.uri.replace(/^\/+/, "/")}`;
      }
    }
    get exists() {
      return store.has(this.uri);
    }
    static async downloadFileAsync(url, destination) {
      const dest =
        destination instanceof MockFile
          ? destination
          : new MockFile(destination.uri, `download-${Date.now()}.jpg`);
      store.set(dest.uri, { url, bytes: new Uint8Array([0xff, 0xd8, 0xff]) });
      return dest;
    }
  }

  class MockDirectory {
    uri;
    name;
    constructor(...parts) {
      const segments = parts.map((p) =>
        typeof p === "string" ? p.replace(/\/$/, "") : p.uri?.replace(/\/$/, "")
      );
      this.uri = segments.join("/");
      this.name = String(segments[segments.length - 1] ?? "");
      if (!this.uri.startsWith("file://")) {
        this.uri = `file://${this.uri.replace(/^\/+/, "/")}`;
      }
    }
    get exists() {
      return store.has(`${this.uri}/.dir`);
    }
    create() {
      store.set(`${this.uri}/.dir`, true);
    }
    list() {
      const prefix = `${this.uri}/`;
      const files = [];
      for (const key of store.keys()) {
        if (key.startsWith(prefix) && key.endsWith(".jpg")) {
          const name = key.slice(prefix.length);
          if (!name.includes("/")) {
            files.push(new MockFile(this.uri, name));
          }
        }
      }
      return files;
    }
  }

  const Paths = {
    document: new MockDirectory("file:///document"),
    cache: new MockDirectory("file:///cache"),
  };

  // Reset helper for tests
  global.__resetExpoFsStore = () => store.clear();
  global.__expoFsStore = store;

  return { File: MockFile, Directory: MockDirectory, Paths };
});

// Mock expo-image cache seeding APIs
jest.mock("expo-image", () => {
  const React = require("react");
  const { Image: RNImage } = require("react-native");
  const cache = new Map();

  const ExpoImage = React.forwardRef((props, ref) =>
    React.createElement(RNImage, { ...props, ref, testID: props.testID ?? "expo-image" })
  );
  ExpoImage.writeToCacheAsync = jest.fn(async (source, cacheKey) => {
    cache.set(cacheKey, source);
  });
  ExpoImage.readFromCacheAsync = jest.fn(async (cacheKey) =>
    cache.has(cacheKey) ? { cacheKey } : null
  );
  ExpoImage.displayName = "ExpoImage";

  global.__resetExpoImageCache = () => {
    cache.clear();
    ExpoImage.writeToCacheAsync.mockClear();
    ExpoImage.readFromCacheAsync.mockClear();
  };
  global.__expoImageCache = cache;

  return { Image: ExpoImage };
});

// Mock expo-screen-orientation
jest.mock("expo-screen-orientation", () => ({
  lockAsync: jest.fn(),
  OrientationLock: {
    LANDSCAPE: "landscape",
  },
}));

// Mock @expo/ui with RN stand-ins for unit tests
jest.mock("@expo/ui", () => {
  const React = require("react");
  const { Pressable, Text, TextInput, View } = require("react-native");

  function useNativeState(initialValue) {
    const [val, setVal] = React.useState(initialValue);
    const valRef = React.useRef(val);
    valRef.current = val;
    const stateRef = React.useRef(null);
    if (stateRef.current === null) {
      stateRef.current = {
        get value() {
          return valRef.current;
        },
        set value(v) {
          valRef.current = v;
          setVal(v);
        },
      };
    }
    return stateRef.current;
  }

  const Host = ({ children, ...props }) =>
    React.createElement(View, { testID: "expo-ui-host", ...props }, children);

  const Column = ({ children, ...props }) =>
    React.createElement(View, { testID: "expo-ui-column", ...props }, children);

  const FieldGroup = ({ children, ...props }) =>
    React.createElement(
      View,
      { testID: "expo-ui-field-group", ...props },
      children
    );
  FieldGroup.Section = ({ title, children, ...props }) =>
    React.createElement(
      View,
      { testID: "expo-ui-field-section", ...props },
      title ? React.createElement(Text, null, title) : null,
      children
    );

  const Row = ({ children, ...props }) =>
    React.createElement(View, { testID: "expo-ui-row", ...props }, children);

  const Spacer = ({
    flexible,
    size,
  }: { flexible?: boolean; size?: number } = {}) =>
    React.createElement(View, {
      testID: "expo-ui-spacer",
      style: flexible
        ? { flex: 1 }
        : size != null
          ? { width: size, height: size }
          : undefined,
    });

  const BottomSheet = ({
    children,
    isPresented,
    onDismiss,
    testID,
  }: {
    children?: React.ReactNode;
    isPresented: boolean;
    onDismiss: () => void;
    testID?: string;
    snapPoints?: unknown;
    contentPadding?: unknown;
    containerColor?: string;
    showDragIndicator?: boolean;
  }) =>
    isPresented
      ? React.createElement(
          View,
          { testID: testID ?? "expo-ui-bottom-sheet" },
          children,
          React.createElement(
            Pressable,
            {
              testID: "expo-ui-bottom-sheet-dismiss",
              onPress: onDismiss,
              accessibilityRole: "button",
            },
            React.createElement(Text, null, "Dismiss")
          )
        )
      : null;

  const ExpoText = ({ children, ...props }) =>
    React.createElement(Text, props, children);

  const ExpoTextInput = ({
    value,
    onChangeText,
    testID,
    editable = true,
    ...props
  }) =>
    React.createElement(TextInput, {
      testID: testID ?? "expo-ui-text-input",
      value: value?.value ?? "",
      editable,
      onChangeText: (text) => {
        if (value) value.value = text;
        onChangeText?.(text);
      },
      ...props,
    });

  const Button = ({ label, onPress, children, ...props }) =>
    React.createElement(
      Pressable,
      {
        accessibilityRole: "button",
        onPress,
        ...props,
      },
      React.createElement(Text, null, label ?? children)
    );

  const PickerItem = () => null;

  const Picker = ({ children, selectedValue, onValueChange, testID }) => {
    const items = React.Children.toArray(children)
      .filter((child) => React.isValidElement(child))
      .map((child) => child.props);
    const id = testID ?? "expo-ui-picker";
    // Settings page still looks up the legacy selected-label id.
    const selectedLabelId =
      id === "grid-type-picker"
        ? "grid-type-selected-label"
        : `${id}-selected`;

    return React.createElement(
      View,
      { testID: id },
      React.createElement(
        Text,
        { testID: selectedLabelId },
        items.find((item) => item.value === selectedValue)?.label ??
          String(selectedValue)
      ),
      items.map((item) =>
        React.createElement(
          Pressable,
          {
            key: String(item.value),
            testID:
              id === "grid-type-picker"
                ? `grid-type-option-${item.value}`
                : `${id}-option-${item.value}`,
            onPress: () => onValueChange?.(item.value),
            accessibilityRole: "button",
          },
          React.createElement(Text, null, item.label)
        )
      )
    );
  };
  Picker.Item = PickerItem;

  const Slider = ({
    value,
    onValueChange,
    min = 0,
    max = 1,
    step = 1,
    disabled,
    testID,
  }) =>
    React.createElement(Pressable, {
      testID: testID ?? "expo-ui-slider",
      accessibilityRole: "adjustable",
      disabled,
      // Tests jump to max by pressing — maps to the last stepped value.
      onPress: () => {
        if (disabled) return;
        onValueChange?.(max);
      },
      // Allow tests / callers to fire a specific value.
      onValueChange,
      value,
      min,
      max,
      step,
    });

  return {
    Host,
    Column,
    FieldGroup,
    Row,
    Spacer,
    Text: ExpoText,
    TextInput: ExpoTextInput,
    Button,
    Picker,
    Slider,
    BottomSheet,
    useNativeState,
  };
});

// Mock @expo/ui/swift-ui for iOS ConnectionPage / native Form screens
jest.mock("@expo/ui/swift-ui", () => {
  const React = require("react");
  const { Pressable, Text, TextInput, View } = require("react-native");

  function useNativeState(initialValue) {
    const [val, setVal] = React.useState(initialValue);
    const valRef = React.useRef(val);
    valRef.current = val;
    const stateRef = React.useRef(null);
    if (stateRef.current === null) {
      stateRef.current = {
        get value() {
          return valRef.current;
        },
        set value(v) {
          valRef.current = v;
          setVal(v);
        },
      };
    }
    return stateRef.current;
  }

  const Host = ({ children, ...props }) =>
    React.createElement(View, { testID: "expo-ui-host", ...props }, children);

  const Form = ({ children, ...props }) =>
    React.createElement(View, { testID: "expo-ui-form", ...props }, children);

  const Section = ({ title, footer, children, ...props }) =>
    React.createElement(
      View,
      { testID: "expo-ui-section", ...props },
      title ? React.createElement(Text, null, title) : null,
      children,
      footer
    );

  const ExpoText = ({ children, ...props }) =>
    React.createElement(Text, props, children);

  const TextField = ({ text, placeholder, onTextChange, modifiers, ...props }) => {
    const isDisabled = (modifiers ?? []).some(
      (mod) =>
        (mod?.functionName === "disabled" || mod?.name === "disabled") &&
        mod?.arg !== false
    );
    return React.createElement(TextInput, {
      testID: "server-ip-input",
      placeholder,
      value: text?.value ?? "",
      editable: !isDisabled,
      onChangeText: (value) => {
        if (onTextChange) {
          onTextChange(value);
        } else if (text) {
          text.value = value;
        }
      },
      ...props,
    });
  };

  const Button = ({ label, onPress, modifiers, ...props }) =>
    React.createElement(
      Pressable,
      {
        accessibilityRole: "button",
        onPress,
        disabled: (modifiers ?? []).some(
          (mod) =>
            (mod?.functionName === "disabled" || mod?.name === "disabled") &&
            mod?.arg !== false
        ),
        ...props,
      },
      React.createElement(Text, null, label)
    );

  return {
    Host,
    Form,
    Section,
    Text: ExpoText,
    TextField,
    Button,
    useNativeState,
  };
});

jest.mock("@expo/ui/swift-ui/modifiers", () => {
  const mod = (name) => (arg) => ({ name, functionName: name, arg });
  return {
    listStyle: mod("listStyle"),
    scrollContentBackground: mod("scrollContentBackground"),
    keyboardType: mod("keyboardType"),
    autocorrectionDisabled: mod("autocorrectionDisabled"),
    submitLabel: mod("submitLabel"),
    onSubmit: mod("onSubmit"),
    buttonStyle: mod("buttonStyle"),
    controlSize: mod("controlSize"),
    disabled: mod("disabled"),
  };
});

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
