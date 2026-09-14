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
  status: "disconnected",
  cameraStatus: "disconnected",
  ip: "192.168.1.1",
  setIp: jest.fn(),
  reconnect: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  sendCommand: jest.fn(),
};

jest.mock("../../components/WebSocketContext", () => ({
  ...jest.requireActual("../../components/WebSocketContext"),
  useWebSocketContext: () => mockWebSocketContext,
}));

describe("ConnectionPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up AsyncStorage mock to return the expected IP
    mockAsyncStorage.getItem.mockResolvedValue("192.168.1.1");
    // Reset the mock context to default values
    mockWebSocketContext.ip = "192.168.1.1";
    mockWebSocketContext.status = "disconnected";
  });

  it("should render correctly", () => {
    const { getByText, getByPlaceholderText, getByDisplayValue } = render(
      <ConnectionPage />
    );

    expect(getByText("Server Connection")).toBeTruthy();
    expect(getByPlaceholderText("Server IP Address")).toBeTruthy();
    expect(getByDisplayValue("192.168.1.1")).toBeTruthy();
    expect(getByText("Connect")).toBeTruthy();
  });

  it("should display current IP in input field", () => {
    const { getByDisplayValue } = render(<ConnectionPage />);

    expect(getByDisplayValue("192.168.1.1")).toBeTruthy();
  });

  it("should update input field when IP changes", () => {
    const { rerender, getByDisplayValue } = render(<ConnectionPage />);

    expect(getByDisplayValue("192.168.1.1")).toBeTruthy();

    // Simulate IP change
    mockWebSocketContext.ip = "192.168.1.100";
    rerender(<ConnectionPage />);

    expect(getByDisplayValue("192.168.1.100")).toBeTruthy();
  });

  it("should handle input text changes", () => {
    const { getByDisplayValue } = render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    fireEvent.changeText(input, "192.168.1.200");

    expect(getByDisplayValue("192.168.1.200")).toBeTruthy();
  });

  it("should call connect when connect button is pressed with a new IP", async () => {
    const { getByText, getByDisplayValue } = render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    const connectButton = getByText("Connect");

    fireEvent.changeText(input, "192.168.1.200");
    fireEvent.press(connectButton);

    await waitFor(() => {
      expect(mockWebSocketContext.connect).toHaveBeenCalledWith("192.168.1.200");
    });
  });

  it("should call connect when IP is the same and connect button is pressed", async () => {
    const { getByText } = render(<ConnectionPage />);

    const connectButton = getByText("Connect");

    fireEvent.press(connectButton);

    await waitFor(() => {
      expect(mockWebSocketContext.connect).toHaveBeenCalledWith("192.168.1.1");
    });
  });

  it("should trim whitespace from IP input", async () => {
    const { getByText, getByDisplayValue } = render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    const connectButton = getByText("Connect");

    fireEvent.changeText(input, "  192.168.1.200  ");
    fireEvent.press(connectButton);

    await waitFor(() => {
      expect(mockWebSocketContext.connect).toHaveBeenCalledWith("192.168.1.200");
    });
  });

  it("should not connect when IP input is empty", async () => {
    const { getByText, getByDisplayValue } = render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    const connectButton = getByText("Connect");

    fireEvent.changeText(input, "");
    fireEvent.press(connectButton);

    await waitFor(() => {
      expect(mockWebSocketContext.connect).not.toHaveBeenCalled();
    });
  });

  it("should disable input when status is loading", () => {
    mockWebSocketContext.status = "loading";

    const { getByDisplayValue, getByText } = render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    expect(input.props.editable).toBe(false);
    expect(getByText("Connecting…")).toBeTruthy();
  });

  it("should enable input when status is not loading", () => {
    mockWebSocketContext.status = "disconnected";

    const { getByDisplayValue } = render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    expect(input.props.editable).toBe(true);
  });

  it("should handle keyboard dismiss when touching outside", () => {
    const { getByTestId } = render(<ConnectionPage />);

    const container = getByTestId("connection-container");
    fireEvent.press(container);

    // Should not throw error
    expect(() => fireEvent.press(container)).not.toThrow();
  });

  it("should handle different IP formats", async () => {
    const testIPs = ["10.0.0.1", "172.16.0.1", "8.8.8.8"];

    for (const ip of testIPs) {
      const { getByText, getByDisplayValue, unmount } = render(
        <ConnectionPage />
      );

      const input = getByDisplayValue("192.168.1.1");
      const connectButton = getByText("Connect");

      fireEvent.changeText(input, ip);
      fireEvent.press(connectButton);

      await waitFor(() => {
        expect(mockWebSocketContext.connect).toHaveBeenCalledWith(ip);
      });

      unmount();
      jest.clearAllMocks();
      mockWebSocketContext.connect.mockResolvedValue(undefined);
      mockWebSocketContext.ip = "192.168.1.1";
    }
  });

  it("should clamp long input to four octets", async () => {
    const { getByText, getByDisplayValue } = render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    const connectButton = getByText("Connect");

    fireEvent.changeText(input, "192.168.1.100.50");
    fireEvent.press(connectButton);

    await waitFor(() => {
      expect(mockWebSocketContext.connect).toHaveBeenCalledWith("192.168.1.100");
    });
  });

  it("should strip non-IP characters", async () => {
    const { getByText, getByDisplayValue } = render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    const connectButton = getByText("Connect");

    fireEvent.changeText(input, "192.168.1.1:8080");
    fireEvent.press(connectButton);

    await waitFor(() => {
      expect(mockWebSocketContext.connect).toHaveBeenCalledWith("192.168.1.180");
    });
  });
});
