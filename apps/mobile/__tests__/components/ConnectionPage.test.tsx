import { fireEvent, render, waitFor } from "@testing-library/react-native";
import ConnectionPage from "../../components/ConnectionPage";

// Mock AsyncStorage
const mockAsyncStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

jest.mock("@react-native-async-storage/async-storage", () => mockAsyncStorage);

// Mock the WebSocket context
const mockWebSocketContext = {
  lastImageReady: null,
  clearLastImageReady: jest.fn(),
  status: "disconnected",
  cameraStatus: "disconnected",
  ip: "192.168.1.1",
  wsPort: 8888,
  httpPort: 8080,
  setIp: jest.fn(),
  reconnect: jest.fn(),
  disconnect: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  sendCommand: jest.fn(),
};

const mockMdnsBrowse = {
  servers: [] as {
    id: string;
    name: string;
    host: string;
    ports: { wsPort: number; httpPort: number };
  }[],
  supported: true,
  scanning: false,
  error: null as string | null,
  rescan: jest.fn(),
};

jest.mock("../../components/WebSocketContext", () => ({
  ...jest.requireActual("../../components/WebSocketContext"),
  useWebSocketContext: () => mockWebSocketContext,
}));

jest.mock("../../hooks/useMdnsBrowse", () => ({
  useMdnsBrowse: () => mockMdnsBrowse,
}));

describe("ConnectionPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up AsyncStorage mock to return the expected IP
    mockAsyncStorage.getItem.mockResolvedValue("192.168.1.1");
    // Reset the mock context to default values
    mockWebSocketContext.ip = "192.168.1.1";
    mockWebSocketContext.status = "disconnected";
    mockMdnsBrowse.servers = [];
    mockMdnsBrowse.supported = true;
    mockMdnsBrowse.scanning = false;
    mockMdnsBrowse.error = null;
  });

  it("should render correctly", async () => {
    const { getByText, getByPlaceholderText, getByDisplayValue } = await render(
      <ConnectionPage />
    );

    expect(getByText("Server Connection")).toBeTruthy();
    expect(getByPlaceholderText("Server IP Address")).toBeTruthy();
    expect(getByDisplayValue("192.168.1.1")).toBeTruthy();
    expect(getByText("Connect")).toBeTruthy();
  });

  it("should display current IP in input field", async () => {
    const { getByDisplayValue } = await render(<ConnectionPage />);

    expect(getByDisplayValue("192.168.1.1")).toBeTruthy();
  });

  it("should update input field when IP changes", async () => {
    const { rerender, getByDisplayValue } = await render(<ConnectionPage />);

    expect(getByDisplayValue("192.168.1.1")).toBeTruthy();

    // Simulate IP change
    mockWebSocketContext.ip = "192.168.1.100";
    await rerender(<ConnectionPage />);

    expect(getByDisplayValue("192.168.1.100")).toBeTruthy();
  });

  it("should handle input text changes", async () => {
    const { getByDisplayValue } = await render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    await fireEvent.changeText(input, "192.168.1.200");

    expect(getByDisplayValue("192.168.1.200")).toBeTruthy();
  });

  it("should call connect when connect button is pressed with a new IP", async () => {
    const { getByText, getByDisplayValue } = await render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    const connectButton = getByText("Connect");

    await fireEvent.changeText(input, "192.168.1.200");
    await fireEvent.press(connectButton);

    await waitFor(() => {
      expect(mockWebSocketContext.connect).toHaveBeenCalledWith("192.168.1.200");
    });
  });

  it("should call connect when IP is the same and connect button is pressed", async () => {
    const { getByText } = await render(<ConnectionPage />);

    const connectButton = getByText("Connect");

    await fireEvent.press(connectButton);

    await waitFor(() => {
      expect(mockWebSocketContext.connect).toHaveBeenCalledWith("192.168.1.1");
    });
  });

  it("should trim whitespace from IP input", async () => {
    const { getByText, getByDisplayValue } = await render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    const connectButton = getByText("Connect");

    await fireEvent.changeText(input, "  192.168.1.200  ");
    await fireEvent.press(connectButton);

    await waitFor(() => {
      expect(mockWebSocketContext.connect).toHaveBeenCalledWith("192.168.1.200");
    });
  });

  it("should not connect when IP input is empty", async () => {
    const { getByText, getByDisplayValue } = await render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    const connectButton = getByText("Connect");

    await fireEvent.changeText(input, "");
    await fireEvent.press(connectButton);

    await waitFor(() => {
      expect(mockWebSocketContext.connect).not.toHaveBeenCalled();
    });
  });

  it("should disable input when status is loading", async () => {
    mockWebSocketContext.status = "loading";

    const { getByDisplayValue, getByText } = await render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    expect(input.props.editable).toBe(false);
    expect(getByText("Connecting…")).toBeTruthy();
  });

  it("should enable input when status is not loading", async () => {
    mockWebSocketContext.status = "disconnected";

    const { getByDisplayValue } = await render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    expect(input.props.editable).toBe(true);
  });

  it("should handle keyboard dismiss when touching outside", async () => {
    const { getByTestId } = await render(<ConnectionPage />);

    const container = getByTestId("connection-container");
    await fireEvent.press(container);

    // Should not throw error
    await expect(fireEvent.press(container)).resolves.toBeUndefined();
  });

  it("should handle different IP formats", async () => {
    const testIPs = ["10.0.0.1", "172.16.0.1", "8.8.8.8"];

    for (const ip of testIPs) {
      const { getByText, getByDisplayValue, unmount } = await render(
        <ConnectionPage />
      );

      const input = getByDisplayValue("192.168.1.1");
      const connectButton = getByText("Connect");

      await fireEvent.changeText(input, ip);
      await fireEvent.press(connectButton);

      await waitFor(() => {
        expect(mockWebSocketContext.connect).toHaveBeenCalledWith(ip);
      });

      await unmount();
      jest.clearAllMocks();
      mockWebSocketContext.connect.mockResolvedValue(undefined);
      mockWebSocketContext.ip = "192.168.1.1";
    }
  });

  it("should clamp long input to four octets", async () => {
    const { getByText, getByDisplayValue } = await render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    const connectButton = getByText("Connect");

    await fireEvent.changeText(input, "192.168.1.100.50");
    await fireEvent.press(connectButton);

    await waitFor(() => {
      expect(mockWebSocketContext.connect).toHaveBeenCalledWith("192.168.1.100");
    });
  });

  it("should strip non-IP characters", async () => {
    const { getByText, getByDisplayValue } = await render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    const connectButton = getByText("Connect");

    await fireEvent.changeText(input, "192.168.1.1:8080");
    await fireEvent.press(connectButton);

    await waitFor(() => {
      expect(mockWebSocketContext.connect).toHaveBeenCalledWith("192.168.1.180");
    });
  });

  it("lists a discovered host and connects with TXT ports", async () => {
    mockMdnsBrowse.servers = [
      {
        id: "5DControl@192.168.1.50:8080:8888",
        name: "5DControl",
        host: "192.168.1.50",
        ports: { httpPort: 8080, wsPort: 8888 },
      },
    ];

    const { getByText } = await render(<ConnectionPage />);

    expect(getByText("Nearby servers")).toBeTruthy();
    await fireEvent.press(getByText("5DControl (192.168.1.50)"));

    await waitFor(() => {
      expect(mockWebSocketContext.connect).toHaveBeenCalledWith(
        "192.168.1.50",
        { httpPort: 8080, wsPort: 8888 }
      );
    });
  });

  it("explains missing browse when the native module is unavailable", async () => {
    mockMdnsBrowse.supported = false;
    const { getByText } = await render(<ConnectionPage />);
    expect(getByText(/dev client/i)).toBeTruthy();
    expect(getByText("Connect")).toBeTruthy();
  });

  it("explains empty browse results", async () => {
    mockMdnsBrowse.supported = true;
    mockMdnsBrowse.scanning = false;
    mockMdnsBrowse.servers = [];
    const { getByText } = await render(<ConnectionPage />);
    expect(getByText(/No servers found/i)).toBeTruthy();
  });
});
