import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import {
  ViewfinderGlass,
  ViewfinderGlassContainer,
  canUseGlassEffect,
} from "../../components/ViewfinderGlass";

jest.mock("expo-glass-effect", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    GlassView: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(View, { testID: "glass-view", ...props }, children),
    GlassContainer: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(
        View,
        { testID: "glass-container", ...props },
        children
      ),
    isLiquidGlassAvailable: jest.fn(() => false),
    isGlassEffectAPIAvailable: jest.fn(() => false),
  };
});

describe("ViewfinderGlass", () => {
  it("reports glass unavailable when APIs return false", () => {
    expect(canUseGlassEffect()).toBe(false);
  });

  it("falls back to View and renders children", () => {
    const { getByText, queryByTestId } = render(
      <ViewfinderGlass fallbackStyle={{ backgroundColor: "red" }}>
        <Text>HUD</Text>
      </ViewfinderGlass>
    );

    expect(getByText("HUD")).toBeTruthy();
    expect(queryByTestId("glass-view")).toBeNull();
  });

  it("falls back GlassContainer to View", () => {
    const { getByText, queryByTestId } = render(
      <ViewfinderGlassContainer>
        <Text>Nav</Text>
      </ViewfinderGlassContainer>
    );

    expect(getByText("Nav")).toBeTruthy();
    expect(queryByTestId("glass-container")).toBeNull();
  });
});
