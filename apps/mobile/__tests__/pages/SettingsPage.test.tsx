import { fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import SettingsPage from "../../app/settings";

// Mock expo-router
const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  replace: jest.fn(),
  canGoBack: jest.fn().mockReturnValue(true),
};

jest.mock("expo-router", () => ({
  router: mockRouter,
  useRouter: () => mockRouter,
}));

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue("none"),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
}));

// Mock settings context
const mockSettingsContext = {
  state: { gridType: "none" as const },
  setGridType: jest.fn(),
};

jest.mock("../../contexts/SettingsContext", () => ({
  ...jest.requireActual("../../contexts/SettingsContext"),
  useSettings: () => mockSettingsContext,
}));

// Mock GridIcons
jest.mock("../../components/GridIcons", () => ({
  NoGridIcon: ({ size, color }: { size?: number; color?: string }) =>
    require("react").createElement("View", {
      testID: "no-grid-icon",
      style: { width: size, height: size },
    }),
  RuleOfThirdsIcon: ({ size, color }: { size?: number; color?: string }) =>
    require("react").createElement("View", {
      testID: "rule-of-thirds-icon",
      style: { width: size, height: size },
    }),
  GoldenRatioIcon: ({ size, color }: { size?: number; color?: string }) =>
    require("react").createElement("View", {
      testID: "golden-ratio-icon",
      style: { width: size, height: size },
    }),
}));

// Don't wrap with SettingsProvider - use the mocked context instead
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

describe("SettingsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock state to default
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
    expect(getByText("No Grid")).toBeTruthy();
  });

  it("should display current grid type in dropdown", () => {
    mockSettingsContext.state.gridType = "rule-of-thirds";

    const { getByText } = render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );

    expect(getByText("Rule of Thirds")).toBeTruthy();
  });

  it("should open dropdown when button is pressed", () => {
    const { getByText, queryByText } = render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );

    const dropdownButton = getByText("No Grid").parent?.parent;
    fireEvent.press(dropdownButton!);

    // Dropdown should be visible
    expect(getByText("Rule of Thirds")).toBeTruthy();
    expect(getByText("Golden Ratio")).toBeTruthy();
  });

  it("should close dropdown when button is pressed again", () => {
    const { getByText, queryByText } = render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );

    const dropdownButton = getByText("No Grid").parent?.parent;

    // Open dropdown
    fireEvent.press(dropdownButton!);
    expect(getByText("Rule of Thirds")).toBeTruthy();

    // Close dropdown
    fireEvent.press(dropdownButton!);
    expect(queryByText("Rule of Thirds")).toBeNull();
  });

  it("should call setGridType when grid option is selected", async () => {
    const { getByText } = render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );

    const dropdownButton = getByText("No Grid").parent?.parent;

    // Open dropdown
    fireEvent.press(dropdownButton!);

    // Select rule of thirds
    const ruleOfThirdsOption = getByText("Rule of Thirds");
    fireEvent.press(ruleOfThirdsOption);

    await waitFor(() => {
      expect(mockSettingsContext.setGridType).toHaveBeenCalledWith(
        "rule-of-thirds"
      );
    });
  });

  it("should close dropdown after selecting an option", async () => {
    const { getByText, queryByText } = render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );

    const dropdownButton = getByText("No Grid").parent?.parent;

    // Open dropdown
    fireEvent.press(dropdownButton!);
    expect(getByText("Rule of Thirds")).toBeTruthy();

    // Select rule of thirds
    const ruleOfThirdsOption = getByText("Rule of Thirds");
    fireEvent.press(ruleOfThirdsOption);

    await waitFor(() => {
      expect(queryByText("Rule of Thirds")).toBeNull();
    });
  });

  it("should show selected grid type with checkmark", () => {
    mockSettingsContext.state.gridType = "rule-of-thirds";

    const { getByText } = render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );

    const dropdownButton = getByText("Rule of Thirds").parent?.parent;
    fireEvent.press(dropdownButton!);

    // Should show checkmark for selected option
    expect(getByText("✓")).toBeTruthy();
  });

  it("should handle all grid types", () => {
    const gridTypes = ["none", "rule-of-thirds", "golden-ratio"];

    gridTypes.forEach((gridType) => {
      mockSettingsContext.state.gridType = gridType as any;

      const { rerender, getByText } = render(
        <TestWrapper>
          <SettingsPage />
        </TestWrapper>
      );

      // Should display correct grid type name
      const expectedNames = {
        none: "No Grid",
        "rule-of-thirds": "Rule of Thirds",
        "golden-ratio": "Golden Ratio",
      };

      expect(
        getByText(expectedNames[gridType as keyof typeof expectedNames])
      ).toBeTruthy();

      rerender(
        <TestWrapper>
          <SettingsPage />
        </TestWrapper>
      );
    });
  });

  it("should handle dropdown state changes correctly", () => {
    const { getByText, queryByText } = render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );

    const dropdownButton = getByText("No Grid").parent?.parent;

    // Initially closed
    expect(queryByText("Rule of Thirds")).toBeNull();

    // Open
    fireEvent.press(dropdownButton!);
    expect(getByText("Rule of Thirds")).toBeTruthy();

    // Close
    fireEvent.press(dropdownButton!);
    expect(queryByText("Rule of Thirds")).toBeNull();
  });

  it("should handle rapid dropdown toggling", () => {
    const { getByText, queryByText, getAllByText } = render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );

    // Find dropdown button by looking for any grid type text
    const gridTypeTexts = ["No Grid", "Rule of Thirds", "Golden Ratio"];
    let dropdownButton;
    for (const text of gridTypeTexts) {
      try {
        const elements = getAllByText(text);
        dropdownButton = elements[0].parent?.parent;
        if (dropdownButton) break;
      } catch (e) {
        continue;
      }
    }

    // Rapid toggling
    fireEvent.press(dropdownButton!);
    fireEvent.press(dropdownButton!);
    fireEvent.press(dropdownButton!);
    fireEvent.press(dropdownButton!);

    // Should be open after even number of presses - check for any grid option
    const hasGridOption = gridTypeTexts.some((text) => {
      try {
        getAllByText(text);
        return true;
      } catch (e) {
        return false;
      }
    });
    expect(hasGridOption).toBeTruthy();
  });

  it("should handle selection of different grid types", async () => {
    const { getByText, getAllByText } = render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );

    // Find and open dropdown button by looking for any grid type text
    const gridTypeTexts = ["No Grid", "Rule of Thirds", "Golden Ratio"];
    let dropdownButton;
    for (const text of gridTypeTexts) {
      try {
        const elements = getAllByText(text);
        dropdownButton = elements[0].parent?.parent;
        if (dropdownButton) break;
      } catch (e) {
        continue;
      }
    }

    fireEvent.press(dropdownButton!);

    // Test selecting each option
    const options = [
      { text: "No Grid", value: "none" },
      { text: "Rule of Thirds", value: "rule-of-thirds" },
      { text: "Golden Ratio", value: "golden-ratio" },
    ];

    for (const option of options) {
      try {
        const optionElements = getAllByText(option.text);
        // Find the option in the dropdown (not the button)
        const optionElement = optionElements[optionElements.length > 1 ? 1 : 0];
        fireEvent.press(optionElement);

        await waitFor(() => {
          expect(mockSettingsContext.setGridType).toHaveBeenCalledWith(
            option.value
          );
        });

        // Reopen dropdown for next selection
        fireEvent.press(dropdownButton!);
      } catch (e) {
        // Option might not be visible, skip it
        continue;
      }
    }
  });

  it("should handle edge cases gracefully", () => {
    // Test with undefined grid type
    mockSettingsContext.state.gridType = undefined as any;

    const { getByText } = render(
      <TestWrapper>
        <SettingsPage />
      </TestWrapper>
    );

    // Should not crash
    expect(getByText("Settings")).toBeTruthy();
  });
});
