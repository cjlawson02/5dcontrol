import { render } from "@testing-library/react-native";
import React from "react";
import { TopStatusBar } from "../../components/TopStatusBar";

describe("TopStatusBar", () => {
  it("should render correctly with default battery level", () => {
    const { getByText } = render(<TopStatusBar fps={15} />);

    expect(getByText("🔋 82%")).toBeTruthy();
    expect(getByText("📶📶▫️")).toBeTruthy();
  });

  it("should render correctly with custom battery level", () => {
    const { getByText } = render(<TopStatusBar fps={25} batteryLevel={95} />);

    expect(getByText("🔋 95%")).toBeTruthy();
    expect(getByText("📶📶📶")).toBeTruthy();
  });

  it("should display correct signal bars for high FPS", () => {
    const { getByText } = render(<TopStatusBar fps={25} />);

    expect(getByText("📶📶📶")).toBeTruthy();
  });

  it("should display correct signal bars for medium FPS", () => {
    const { getByText } = render(<TopStatusBar fps={15} />);

    expect(getByText("📶📶▫️")).toBeTruthy();
  });

  it("should display correct signal bars for low FPS", () => {
    const { getByText } = render(<TopStatusBar fps={8} />);

    expect(getByText("📶▫️▫️")).toBeTruthy();
  });

  it("should display correct signal bars for very low FPS", () => {
    const { getByText } = render(<TopStatusBar fps={3} />);

    expect(getByText("▫️▫️▫️")).toBeTruthy();
  });

  it("should display correct signal bars for zero FPS", () => {
    const { getByText } = render(<TopStatusBar fps={0} />);

    expect(getByText("▫️▫️▫️")).toBeTruthy();
  });

  it("should display correct signal bars for negative FPS", () => {
    const { getByText } = render(<TopStatusBar fps={-5} />);

    expect(getByText("▫️▫️▫️")).toBeTruthy();
  });

  it("should handle edge case FPS values", () => {
    const testCases = [
      { fps: 20, expected: "📶📶📶" },
      { fps: 19, expected: "📶📶▫️" },
      { fps: 10, expected: "📶📶▫️" },
      { fps: 9, expected: "📶▫️▫️" },
      { fps: 5, expected: "📶▫️▫️" },
      { fps: 4, expected: "▫️▫️▫️" },
    ];

    testCases.forEach(({ fps, expected }) => {
      const { getByText } = render(<TopStatusBar fps={fps} />);
      expect(getByText(expected)).toBeTruthy();
    });
  });

  it("should handle decimal FPS values", () => {
    const { getByText } = render(<TopStatusBar fps={15.7} />);

    expect(getByText("📶📶▫️")).toBeTruthy();
  });

  it("should handle very high FPS values", () => {
    const { getByText } = render(<TopStatusBar fps={100} />);

    expect(getByText("📶📶📶")).toBeTruthy();
  });

  it("should handle battery level edge cases", () => {
    const testCases = [0, 1, 50, 99, 100, 101, -5];

    testCases.forEach((batteryLevel) => {
      const { getByText } = render(
        <TopStatusBar fps={15} batteryLevel={batteryLevel} />
      );
      expect(getByText(`🔋 ${batteryLevel}%`)).toBeTruthy();
    });
  });
});
