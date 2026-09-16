import { render } from "@testing-library/react-native";
import {
  GoldenRatioIcon,
  NoGridIcon,
  RuleOfThirdsIcon,
} from "../../components/GridIcons";

// Mock react-native-svg
jest.mock("react-native-svg", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    __esModule: true,
    default: ({ children, ...props }: any) =>
      React.createElement(View, { ...props, testID: "svg" }, children),
    Line: ({ ...props }: any) =>
      React.createElement(View, { ...props, testID: "line" }),
    Circle: ({ ...props }: any) =>
      React.createElement(View, { ...props, testID: "circle" }),
  };
});

describe("GridIcons", () => {
  describe("NoGridIcon", () => {
    it("should render correctly with default props", async () => {
      const { getByTestId, getAllByTestId } = await render(<NoGridIcon />);

      expect(getByTestId("svg")).toBeTruthy();
      expect(getByTestId("circle")).toBeTruthy();
      expect(getAllByTestId("line")).toHaveLength(2);
    });

    it("should render with custom size", async () => {
      const { getByTestId } = await render(<NoGridIcon size={30} />);

      const svg = getByTestId("svg");
      expect(svg.props.width).toBe(30);
      expect(svg.props.height).toBe(30);
    });

    it("should render with custom color", async () => {
      const { getByTestId } = await render(<NoGridIcon color="#ff0000" />);

      const circle = getByTestId("circle");
      expect(circle.props.stroke).toBe("#ff0000");
    });

    it("should render with custom size and color", async () => {
      const { getByTestId } = await render(<NoGridIcon size={40} color="#00ff00" />);

      const svg = getByTestId("svg");
      const circle = getByTestId("circle");

      expect(svg.props.width).toBe(40);
      expect(svg.props.height).toBe(40);
      expect(circle.props.stroke).toBe("#00ff00");
    });

    it("should render multiple lines for the X pattern", async () => {
      const { getAllByTestId } = await render(<NoGridIcon />);

      const lines = getAllByTestId("line");
      expect(lines).toHaveLength(2);
    });
  });

  describe("RuleOfThirdsIcon", () => {
    it("should render correctly with default props", async () => {
      const { getByTestId, getAllByTestId } = await render(<RuleOfThirdsIcon />);

      expect(getByTestId("svg")).toBeTruthy();
      expect(getAllByTestId("line")).toHaveLength(4);
    });

    it("should render with custom size", async () => {
      const { getByTestId } = await render(<RuleOfThirdsIcon size={30} />);

      const svg = getByTestId("svg");
      expect(svg.props.width).toBe(30);
      expect(svg.props.height).toBe(30);
    });

    it("should render with custom color", async () => {
      const { getAllByTestId } = await render(<RuleOfThirdsIcon color="#ff0000" />);

      const lines = getAllByTestId("line");
      lines.forEach((line) => {
        expect(line.props.stroke).toBe("#ff0000");
      });
    });

    it("should render with custom size and color", async () => {
      const { getByTestId, getAllByTestId } = await render(
        <RuleOfThirdsIcon size={40} color="#00ff00" />
      );

      const svg = getByTestId("svg");
      const lines = getAllByTestId("line");

      expect(svg.props.width).toBe(40);
      expect(svg.props.height).toBe(40);
      lines.forEach((line) => {
        expect(line.props.stroke).toBe("#00ff00");
      });
    });

    it("should render exactly 4 lines for rule of thirds grid", async () => {
      const { getAllByTestId } = await render(<RuleOfThirdsIcon />);

      const lines = getAllByTestId("line");
      expect(lines).toHaveLength(4);
    });
  });

  describe("GoldenRatioIcon", () => {
    it("should render correctly with default props", async () => {
      const { getByTestId, getAllByTestId } = await render(<GoldenRatioIcon />);

      expect(getByTestId("svg")).toBeTruthy();
      expect(getAllByTestId("line")).toHaveLength(4);
    });

    it("should render with custom size", async () => {
      const { getByTestId } = await render(<GoldenRatioIcon size={30} />);

      const svg = getByTestId("svg");
      expect(svg.props.width).toBe(30);
      expect(svg.props.height).toBe(30);
    });

    it("should render with custom color", async () => {
      const { getAllByTestId } = await render(<GoldenRatioIcon color="#ff0000" />);

      const lines = getAllByTestId("line");
      lines.forEach((line) => {
        expect(line.props.stroke).toBe("#ff0000");
      });
    });

    it("should render with custom size and color", async () => {
      const { getByTestId, getAllByTestId } = await render(
        <GoldenRatioIcon size={40} color="#00ff00" />
      );

      const svg = getByTestId("svg");
      const lines = getAllByTestId("line");

      expect(svg.props.width).toBe(40);
      expect(svg.props.height).toBe(40);
      lines.forEach((line) => {
        expect(line.props.stroke).toBe("#00ff00");
      });
    });

    it("should render exactly 4 lines for golden ratio grid", async () => {
      const { getAllByTestId } = await render(<GoldenRatioIcon />);

      const lines = getAllByTestId("line");
      expect(lines).toHaveLength(4);
    });
  });

  describe("All Icons", () => {
    it("should handle zero size gracefully", async () => {
      const { getByTestId } = await render(<NoGridIcon size={0} />);

      const svg = getByTestId("svg");
      expect(svg.props.width).toBe(0);
      expect(svg.props.height).toBe(0);
    });

    it("should handle very large size", async () => {
      const { getByTestId } = await render(<RuleOfThirdsIcon size={1000} />);

      const svg = getByTestId("svg");
      expect(svg.props.width).toBe(1000);
      expect(svg.props.height).toBe(1000);
    });

    it("should handle undefined color", async () => {
      const { getByTestId } = await render(
        <GoldenRatioIcon color={undefined as any} />
      );

      // Should not crash
      expect(getByTestId("svg")).toBeTruthy();
    });

    it("should handle empty string color", async () => {
      const { getByTestId } = await render(<NoGridIcon color="" />);

      // Should not crash
      expect(getByTestId("svg")).toBeTruthy();
    });

    it("should handle special characters in color", async () => {
      const specialColors = [
        "#fff",
        "#000",
        "#123456",
        "red",
        "blue",
        "transparent",
      ];

      for (const color of specialColors) {
        const { getByTestId } = await render(<RuleOfThirdsIcon color={color} />);
        expect(getByTestId("svg")).toBeTruthy();
      }
    });
  });
});
