import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import GalleryScreen from "../../app/gallery";
import * as galleryCache from "../../utils/galleryCache";

jest.mock("expo-router", () => {
  const mockRouter = {
    push: jest.fn(),
    back: jest.fn(),
    replace: jest.fn(),
    canGoBack: jest.fn().mockReturnValue(true),
  };
  return {
    router: mockRouter,
    useRouter: () => mockRouter,
  };
});

const mockWebSocket = {
  ip: "192.168.1.1",
  status: "connected" as const,
  cameraStatus: "connected" as const,
  batteryLevel: 80,
  setIp: jest.fn(),
  reconnect: jest.fn(),
  connect: jest.fn(),
  sendCommand: jest.fn(),
};

jest.mock("../../components/WebSocketContext", () => ({
  useWebSocketContext: () => mockWebSocket,
}));

jest.mock("../../utils/galleryCache", () => {
  const actual = jest.requireActual("../../utils/galleryCache");
  return {
    ...actual,
    listGalleryImages: jest.fn(() => []),
    seedAllGalleryCaches: jest.fn(async () => undefined),
    downloadLatestSnapshot: jest.fn(),
  };
});

describe("GalleryScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__resetExpoFsStore?.();
    (global as any).__resetExpoImageCache?.();
    mockWebSocket.ip = "192.168.1.1";
    (galleryCache.listGalleryImages as jest.Mock).mockReturnValue([]);
    (galleryCache.seedAllGalleryCaches as jest.Mock).mockResolvedValue(
      undefined
    );
  });

  it("renders empty state and fetch control", async () => {
    const { getByText, getByTestId } = render(<GalleryScreen />);

    await waitFor(() => {
      expect(getByText("Gallery")).toBeTruthy();
      expect(getByTestId("gallery-empty")).toBeTruthy();
      expect(getByTestId("gallery-fetch-latest")).toBeTruthy();
    });
  });

  it("navigates back", async () => {
    const { getByText } = render(<GalleryScreen />);
    await waitFor(() => expect(getByText("← Back")).toBeTruthy());
    fireEvent.press(getByText("← Back"));
    expect(router.back).toHaveBeenCalled();
  });

  it("fetches the latest snapshot and refreshes the list", async () => {
    const downloaded = {
      id: "capture-1",
      filename: "capture-1.jpg",
      uri: "file:///document/gallery-captures/capture-1.jpg",
      cacheKey: "gallery:capture-1.jpg",
      createdAt: 1,
    };
    (galleryCache.downloadLatestSnapshot as jest.Mock).mockResolvedValue(
      downloaded
    );
    (galleryCache.listGalleryImages as jest.Mock)
      .mockReturnValueOnce([])
      .mockReturnValueOnce([downloaded]);

    const { getByTestId, queryByTestId } = render(<GalleryScreen />);

    await waitFor(() => expect(getByTestId("gallery-empty")).toBeTruthy());

    fireEvent.press(getByTestId("gallery-fetch-latest"));

    await waitFor(() => {
      expect(galleryCache.downloadLatestSnapshot).toHaveBeenCalledWith(
        "192.168.1.1"
      );
      expect(getByTestId("gallery-list")).toBeTruthy();
      expect(queryByTestId("gallery-empty")).toBeNull();
      expect(getByTestId("gallery-item-capture-1")).toBeTruthy();
    });
  });

  it("shows an error when download fails", async () => {
    (galleryCache.downloadLatestSnapshot as jest.Mock).mockRejectedValue(
      new Error("offline")
    );

    const { getByTestId } = render(<GalleryScreen />);
    await waitFor(() => expect(getByTestId("gallery-fetch-latest")).toBeTruthy());

    fireEvent.press(getByTestId("gallery-fetch-latest"));

    await waitFor(() => {
      expect(getByTestId("gallery-error")).toBeTruthy();
    });
  });
});
