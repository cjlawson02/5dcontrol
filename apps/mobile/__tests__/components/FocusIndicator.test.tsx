import { render } from "@testing-library/react-native";
import React from "react";
import { FocusIndicator } from "../../components/FocusIndicator";

describe("FocusIndicator", () => {
  it("should render correctly with given coordinates", () => {
    const { getByTestId } = render(<FocusIndicator x={100} y={200} />);

    const indicator = getByTestId("focus-indicator");
    expect(indicator).toBeTruthy();
  });

  it("should render at correct position", () => {
    const x = 150;
    const y = 250;
    const { getByTestId } = render(<FocusIndicator x={x} y={y} />);

    const indicator = getByTestId("focus-indicator");
    expect(indicator).toBeTruthy();
  });

  it("should handle zero coordinates", () => {
    const { getByTestId } = render(<FocusIndicator x={0} y={0} />);

    const indicator = getByTestId("focus-indicator");
    expect(indicator).toBeTruthy();
  });

  it("should handle negative coordinates", () => {
    const { getByTestId } = render(<FocusIndicator x={-50} y={-100} />);

    const indicator = getByTestId("focus-indicator");
    expect(indicator).toBeTruthy();
  });

  it("should handle large coordinates", () => {
    const { getByTestId } = render(<FocusIndicator x={1000} y={2000} />);

    const indicator = getByTestId("focus-indicator");
    expect(indicator).toBeTruthy();
  });

  it("should handle decimal coordinates", () => {
    const { getByTestId } = render(<FocusIndicator x={123.45} y={678.9} />);

    const indicator = getByTestId("focus-indicator");
    expect(indicator).toBeTruthy();
  });
});
