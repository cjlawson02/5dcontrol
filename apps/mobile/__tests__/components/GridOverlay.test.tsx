import { render } from "@testing-library/react-native";
import { GridOverlay } from "../../components/GridOverlay";
import { GridType } from "../../contexts/SettingsContext";

describe("GridOverlay", () => {
  it("should render nothing when visible is false", async () => {
    const { queryByTestId } = await render(
      <GridOverlay type="rule-of-thirds" visible={false} />
    );

    expect(queryByTestId("webview")).toBeNull();
  });

  it("should render nothing when type is none", async () => {
    const { queryByTestId } = await render(
      <GridOverlay type="none" visible={true} />
    );

    expect(queryByTestId("webview")).toBeNull();
  });

  it("should render nothing when type is none and visible is false", async () => {
    const { queryByTestId } = await render(
      <GridOverlay type="none" visible={false} />
    );

    expect(queryByTestId("webview")).toBeNull();
  });

  it("should render rule-of-thirds grid when visible and type is rule-of-thirds", async () => {
    const { getByTestId } = await render(
      <GridOverlay type="rule-of-thirds" visible={true} />
    );

    expect(getByTestId("grid-overlay")).toBeTruthy();
  });

  it("should render golden-ratio grid when visible and type is golden-ratio", async () => {
    const { getByTestId } = await render(
      <GridOverlay type="golden-ratio" visible={true} />
    );

    expect(getByTestId("grid-overlay")).toBeTruthy();
  });

  it("should handle all valid grid types", async () => {
    const validTypes: GridType[] = ["none", "rule-of-thirds", "golden-ratio"];

    for (const type of validTypes) {
      const { getByTestId, queryByTestId } = await render(
        <GridOverlay type={type} visible={true} />
      );

      if (type === "none") {
        expect(queryByTestId("webview")).toBeNull();
      } else {
        expect(getByTestId("grid-overlay")).toBeTruthy();
      }
    }
  });

  it("should handle visibility changes", async () => {
    const { rerender, getByTestId, queryByTestId } = await render(
      <GridOverlay type="rule-of-thirds" visible={false} />
    );

    expect(queryByTestId("webview")).toBeNull();

    await rerender(<GridOverlay type="rule-of-thirds" visible={true} />);
    expect(getByTestId("grid-overlay")).toBeTruthy();

    await rerender(<GridOverlay type="rule-of-thirds" visible={false} />);
    expect(queryByTestId("webview")).toBeNull();
  });

  it("should handle type changes", async () => {
    const { rerender, getByTestId, queryByTestId } = await render(
      <GridOverlay type="rule-of-thirds" visible={true} />
    );

    expect(getByTestId("grid-overlay")).toBeTruthy();

    await rerender(<GridOverlay type="golden-ratio" visible={true} />);
    expect(getByTestId("grid-overlay")).toBeTruthy();

    await rerender(<GridOverlay type="none" visible={true} />);
    expect(queryByTestId("grid-overlay")).toBeNull();
  });

  it("should handle both type and visibility changes", async () => {
    const { rerender, getByTestId, queryByTestId } = await render(
      <GridOverlay type="none" visible={false} />
    );

    expect(queryByTestId("webview")).toBeNull();

    await rerender(<GridOverlay type="rule-of-thirds" visible={true} />);
    expect(getByTestId("grid-overlay")).toBeTruthy();

    await rerender(<GridOverlay type="golden-ratio" visible={false} />);
    expect(queryByTestId("webview")).toBeNull();

    await rerender(<GridOverlay type="golden-ratio" visible={true} />);
    expect(getByTestId("grid-overlay")).toBeTruthy();
  });
});
