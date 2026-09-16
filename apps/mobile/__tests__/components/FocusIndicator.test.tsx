import { StyleSheet } from "react-native";
import { render } from "@testing-library/react-native";
import { FocusIndicator } from "../../components/FocusIndicator";

describe("FocusIndicator", () => {
  it("should render correctly with given coordinates", async () => {
    const { getByTestId } = await render(<FocusIndicator x={100} y={200} />);

    const indicator = getByTestId("focus-indicator");
    expect(indicator).toBeTruthy();
  });

  it("should render at correct position", async () => {
    const x = 150;
    const y = 250;
    const { getByTestId } = await render(<FocusIndicator x={x} y={y} />);

    const indicator = getByTestId("focus-indicator");
    expect(indicator).toBeTruthy();
  });

  it("should handle zero coordinates", async () => {
    const { getByTestId } = await render(<FocusIndicator x={0} y={0} />);

    const indicator = getByTestId("focus-indicator");
    expect(indicator).toBeTruthy();
  });

  it("should handle negative coordinates", async () => {
    const { getByTestId } = await render(<FocusIndicator x={-50} y={-100} />);

    const indicator = getByTestId("focus-indicator");
    expect(indicator).toBeTruthy();
  });

  it("should handle large coordinates", async () => {
    const { getByTestId } = await render(<FocusIndicator x={1000} y={2000} />);

    const indicator = getByTestId("focus-indicator");
    expect(indicator).toBeTruthy();
  });

  it("should handle decimal coordinates", async () => {
    const { getByTestId } = await render(<FocusIndicator x={123.45} y={678.9} />);

    const indicator = getByTestId("focus-indicator");
    expect(indicator).toBeTruthy();
  });

  it("should render centered mode", async () => {
    const { getByTestId } = await render(
      <FocusIndicator x={0} y={0} centered />
    );
    expect(getByTestId("focus-indicator")).toBeTruthy();
  });

  it("offsets the box so x/y is the center", async () => {
    const { getByTestId } = await render(<FocusIndicator x={100} y={200} />);
    const indicator = getByTestId("focus-indicator");
    const flat = StyleSheet.flatten(indicator.props.style);
    expect(flat.left).toBe(75);
    expect(flat.top).toBe(175);
  });
});
