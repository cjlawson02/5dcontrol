import { render } from "@testing-library/react-native";
import React from "react";
import { GridOverlay } from "../../components/GridOverlay";
import { GridType } from "../../contexts/SettingsContext";

describe("GridOverlay", () => {
  it("should render nothing when visible is false", () => {
    const { queryByTestId } = render(
      <GridOverlay type="rule-of-thirds" visible={false} />
    );

    expect(queryByTestId("webview")).toBeNull();
  });

  it("should render nothing when type is none", () => {
    const { queryByTestId } = render(
      <GridOverlay type="none" visible={true} />
    );

    expect(queryByTestId("webview")).toBeNull();
  });

  it("should render nothing when type is none and visible is false", () => {
    const { queryByTestId } = render(
      <GridOverlay type="none" visible={false} />
    );

    expect(queryByTestId("webview")).toBeNull();
  });

  it("should render rule-of-thirds grid when visible and type is rule-of-thirds", () => {
    const { getByTestId } = render(
      <GridOverlay type="rule-of-thirds" visible={true} />
    );

    expect(getByTestId("grid-overlay")).toBeTruthy();
  });

  it("should render golden-ratio grid when visible and type is golden-ratio", () => {
    const { getByTestId } = render(
      <GridOverlay type="golden-ratio" visible={true} />
    );

    expect(getByTestId("grid-overlay")).toBeTruthy();
  });

  it("should handle all valid grid types", () => {
    const validTypes: GridType[] = ["none", "rule-of-thirds", "golden-ratio"];

    validTypes.forEach((type) => {
      const { getByTestId, queryByTestId } = render(
        <GridOverlay type={type} visible={true} />
      );

      if (type === "none") {
        expect(queryByTestId("webview")).toBeNull();
      } else {
        expect(getByTestId("grid-overlay")).toBeTruthy();
      }
    });
  });

  it("should handle visibility changes", () => {
    const { rerender, getByTestId, queryByTestId } = render(
      <GridOverlay type="rule-of-thirds" visible={false} />
    );

    expect(queryByTestId("webview")).toBeNull();

    rerender(<GridOverlay type="rule-of-thirds" visible={true} />);
    expect(getByTestId("grid-overlay")).toBeTruthy();

    rerender(<GridOverlay type="rule-of-thirds" visible={false} />);
    expect(queryByTestId("webview")).toBeNull();
  });

  it("should handle type changes", () => {
    const { rerender, getByTestId, queryByTestId } = render(
      <GridOverlay type="rule-of-thirds" visible={true} />
    );

    expect(getByTestId("grid-overlay")).toBeTruthy();

    rerender(<GridOverlay type="golden-ratio" visible={true} />);
    expect(getByTestId("grid-overlay")).toBeTruthy();

    rerender(<GridOverlay type="none" visible={true} />);
    expect(queryByTestId("grid-overlay")).toBeNull();
  });

  it("should handle both type and visibility changes", () => {
    const { rerender, getByTestId, queryByTestId } = render(
      <GridOverlay type="none" visible={false} />
    );

    expect(queryByTestId("webview")).toBeNull();

    rerender(<GridOverlay type="rule-of-thirds" visible={true} />);
    expect(getByTestId("grid-overlay")).toBeTruthy();

    rerender(<GridOverlay type="golden-ratio" visible={false} />);
    expect(queryByTestId("webview")).toBeNull();

    rerender(<GridOverlay type="golden-ratio" visible={true} />);
    expect(getByTestId("grid-overlay")).toBeTruthy();
  });
});
