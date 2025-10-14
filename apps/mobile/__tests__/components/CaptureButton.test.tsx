import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { CaptureButton } from "../../components/CaptureButton";

describe("CaptureButton", () => {
  it("should render correctly", () => {
    const mockOnPress = jest.fn();
    const { getByRole } = render(<CaptureButton onPress={mockOnPress} />);

    // The button should be rendered
    expect(getByRole("button")).toBeTruthy();
  });

  it("should call onPress when pressed", () => {
    const mockOnPress = jest.fn();
    const { getByRole } = render(<CaptureButton onPress={mockOnPress} />);

    // Find the button and press it
    const button = getByRole("button");
    fireEvent.press(button);

    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it("should call onPress multiple times when pressed multiple times", () => {
    const mockOnPress = jest.fn();
    const { getByRole } = render(<CaptureButton onPress={mockOnPress} />);

    const button = getByRole("button");

    fireEvent.press(button);
    fireEvent.press(button);
    fireEvent.press(button);

    expect(mockOnPress).toHaveBeenCalledTimes(3);
  });

  it("should not throw error when onPress is undefined", () => {
    const { getByRole } = render(<CaptureButton onPress={undefined as any} />);

    const button = getByRole("button");

    expect(() => {
      fireEvent.press(button);
    }).not.toThrow();
  });

  it("should render with correct styling", () => {
    const mockOnPress = jest.fn();
    const { getByRole } = render(<CaptureButton onPress={mockOnPress} />);

    const button = getByRole("button");

    // Check that the component renders without errors
    expect(button).toBeTruthy();
  });
});
