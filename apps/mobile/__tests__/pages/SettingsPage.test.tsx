import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import SettingsPage from "../../app/settings";

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

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue("none"),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
}));

const mockSettingsContext = {
  state: { gridType: "none" as string | undefined },
  setGridType: jest.fn(),
};

jest.mock("../../contexts/SettingsContext", () => ({
  ...jest.requireActual("../../contexts/SettingsContext"),
  useSettings: () => mockSettingsContext,
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

describe("SettingsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsContext.state.gridType = "none";
  });

  it("should render correctly", () => {
    const { getByText, getByTestId } = render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );

    expect(getByText("Settings")).toBeTruthy();
    expect(getByText("← Back")).toBeTruthy();
    expect(getByText("Grid Overlay")).toBeTruthy();
    expect(getByText("Type")).toBeTruthy();
    expect(getByTestId("grid-type-picker")).toBeTruthy();
    expect(getByTestId("grid-type-selected-label").props.children).toBe(
      "No Grid"
    );
  });

  it("should display the current grid type", () => {
    mockSettingsContext.state.gridType = "rule-of-thirds";

    const { getByTestId } = render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );

    expect(getByTestId("grid-type-selected-label").props.children).toBe(
      "Rule of Thirds"
    );
  });

  it("should call setGridType when a grid option is selected", async () => {
    const { getByTestId } = render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );

    fireEvent.press(getByTestId("grid-type-option-rule-of-thirds"));

    await waitFor(() => {
      expect(mockSettingsContext.setGridType).toHaveBeenCalledWith(
        "rule-of-thirds"
      );
    });
  });

  it("should handle all grid types", () => {
    const expectedNames = {
      none: "No Grid",
      "rule-of-thirds": "Rule of Thirds",
      "golden-ratio": "Golden Ratio",
    } as const;

    (Object.keys(expectedNames) as (keyof typeof expectedNames)[]).forEach(
      (gridType) => {
        mockSettingsContext.state.gridType = gridType;

        const { getByTestId, unmount } = render(
          <TestWrapper>
            <SettingsPage />
          </TestWrapper>
        );

        expect(getByTestId("grid-type-selected-label").props.children).toBe(
          expectedNames[gridType]
        );
        unmount();
      }
    );
  });

  it("should select each grid option", async () => {
    const { getByTestId } = render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );

    const options = [
      { testID: "grid-type-option-none", value: "none" },
      {
        testID: "grid-type-option-rule-of-thirds",
        value: "rule-of-thirds",
      },
      { testID: "grid-type-option-golden-ratio", value: "golden-ratio" },
    ];

    for (const option of options) {
      fireEvent.press(getByTestId(option.testID));
      await waitFor(() => {
        expect(mockSettingsContext.setGridType).toHaveBeenCalledWith(
          option.value
        );
      });
    }
  });

  it("should navigate back when back is pressed", () => {
    const { getByText } = render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );

    fireEvent.press(getByText("← Back"));
    expect(router.back).toHaveBeenCalled();
  });

  it("should handle missing grid type gracefully", () => {
    mockSettingsContext.state.gridType = undefined;

    const { getByText, getByTestId } = render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );

    expect(getByText("Settings")).toBeTruthy();
    expect(getByTestId("grid-type-selected-label").props.children).toBe(
      "No Grid"
    );
  });
});
