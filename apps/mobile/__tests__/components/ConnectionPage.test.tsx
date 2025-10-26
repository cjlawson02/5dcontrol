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
    const { getByText, getByDisplayValue } = render(<ConnectionPage />);

    expect(getByText("5DControl")).toBeTruthy();
    expect(getByText("Server Connection")).toBeTruthy();
    expect(getByText("Server IP Address")).toBeTruthy();
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

  it("should call setIp when IP changes and connect button is pressed", async () => {
    const { getByText, getByDisplayValue } = render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    const connectButton = getByText("Connect");

    fireEvent.changeText(input, "192.168.1.200");
    fireEvent.press(connectButton);

    await waitFor(() => {
      expect(mockWebSocketContext.setIp).toHaveBeenCalledWith("192.168.1.200");
    });
  });

  it("should call reconnect when IP is the same and connect button is pressed", async () => {
    const { getByText } = render(<ConnectionPage />);

    const connectButton = getByText("Connect");

    // Don't change the IP
    fireEvent.press(connectButton);

    await waitFor(() => {
      expect(mockWebSocketContext.reconnect).toHaveBeenCalled();
    });
  });

  it("should trim whitespace from IP input", async () => {
    const { getByText, getByDisplayValue } = render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    const connectButton = getByText("Connect");

    fireEvent.changeText(input, "  192.168.1.200  ");
    fireEvent.press(connectButton);

    await waitFor(() => {
      expect(mockWebSocketContext.setIp).toHaveBeenCalledWith("192.168.1.200");
    });
  });

  it("should handle empty IP input", async () => {
    const { getByText, getByDisplayValue } = render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    const connectButton = getByText("Connect");

    fireEvent.changeText(input, "");
    fireEvent.press(connectButton);

    await waitFor(() => {
      expect(mockWebSocketContext.setIp).toHaveBeenCalledWith("");
    });
  });

  it("should disable input when status is loading", () => {
    mockWebSocketContext.status = "loading";

    const { getByDisplayValue } = render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    expect(input.props.editable).toBe(false);
  });

  it("should enable input when status is not loading", () => {
    mockWebSocketContext.status = "disconnected";

    const { getByDisplayValue } = render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    expect(input.props.editable).toBe(true);
  });

  it("should handle keyboard dismiss when touching outside", () => {
    const { getByTestId } = render(<ConnectionPage />);

    const container = getByTestId("connection-container"); // TouchableWithoutFeedback
    fireEvent.press(container);

    // Should not throw error
    expect(() => fireEvent.press(container)).not.toThrow();
  });

  it("should handle different IP formats", async () => {
    const testIPs = ["10.0.0.1", "172.16.0.1", "localhost", "example.com"];

    for (const ip of testIPs) {
      const { getByText, getByDisplayValue } = render(<ConnectionPage />);

      const input = getByDisplayValue("192.168.1.1");
      const connectButton = getByText("Connect");

      fireEvent.changeText(input, ip);
      fireEvent.press(connectButton);

      await waitFor(() => {
        expect(mockWebSocketContext.setIp).toHaveBeenCalledWith(ip);
      });

      jest.clearAllMocks();
    }
  });

  it("should handle very long IP input", async () => {
    const longIP = "192.168.1.1".repeat(10);
    const { getByText, getByDisplayValue } = render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    const connectButton = getByText("Connect");

    fireEvent.changeText(input, longIP);
    fireEvent.press(connectButton);

    await waitFor(() => {
      expect(mockWebSocketContext.setIp).toHaveBeenCalledWith(longIP);
    });
  });

  it("should handle special characters in IP input", async () => {
    const specialIP = "192.168.1.1:8080";
    const { getByText, getByDisplayValue } = render(<ConnectionPage />);

    const input = getByDisplayValue("192.168.1.1");
    const connectButton = getByText("Connect");

    fireEvent.changeText(input, specialIP);
    fireEvent.press(connectButton);

    await waitFor(() => {
      expect(mockWebSocketContext.setIp).toHaveBeenCalledWith(specialIP);
    });
  });
});
