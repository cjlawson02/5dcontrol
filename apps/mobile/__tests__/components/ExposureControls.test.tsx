import { SettingField } from "@5dcontrol/proto";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { ExposureControls } from "../../components/ExposureControls";

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium" },
}));

describe("ExposureControls", () => {
  const current = {
    shutterSpeed: "1/125",
    aperture: "f/5.6",
    iso: "400",
    exposureCompensation: "0",
  };
  const available = {
    shutterSpeeds: ["1/60", "1/125", "1/250"],
    apertures: ["f/2.8", "f/5.6", "f/8"],
    isos: ["100", "400", "800"],
    exposureCompensations: ["-1", "0", "+1"],
  };

  it("renders the ISO / Tv / Av readout pill", () => {
    render(
      <ExposureControls
        current={current}
        available={available}
        onSet={jest.fn()}
      />
    );

    expect(screen.getByTestId("exposure-controls")).toBeTruthy();
    expect(screen.getByTestId("exposure-iso-chip")).toBeTruthy();
    expect(screen.getByTestId("exposure-shutter-chip")).toBeTruthy();
    expect(screen.getByTestId("exposure-aperture-chip")).toBeTruthy();
    expect(screen.queryByTestId("exposure-rail")).toBeNull();
  });

  it("arms a segment, sets a value from the rail, and closes on scrim tap", () => {
    const onSet = jest.fn();
    render(
      <ExposureControls
        current={current}
        available={available}
        onSet={onSet}
      />
    );

    fireEvent.press(screen.getByTestId("exposure-iso-chip"));
    expect(screen.getByTestId("exposure-rail")).toBeTruthy();

    fireEvent.press(screen.getByTestId("exposure-rail-option-800"));
    expect(onSet).toHaveBeenCalledWith(SettingField.ISO, "800");

    fireEvent.press(screen.getByTestId("exposure-scrim"));
    expect(screen.queryByTestId("exposure-rail")).toBeNull();
  });

  it("collapses the rail when the armed segment is tapped again", () => {
    render(
      <ExposureControls
        current={current}
        available={available}
        onSet={jest.fn()}
      />
    );

    fireEvent.press(screen.getByTestId("exposure-shutter-chip"));
    expect(screen.getByTestId("exposure-rail")).toBeTruthy();

    fireEvent.press(screen.getByTestId("exposure-shutter-chip"));
    expect(screen.queryByTestId("exposure-rail")).toBeNull();
  });

  it("renders nothing without current settings", () => {
    const { toJSON } = render(
      <ExposureControls current={null} available={available} onSet={jest.fn()} />
    );
    expect(toJSON()).toBeNull();
  });
});
