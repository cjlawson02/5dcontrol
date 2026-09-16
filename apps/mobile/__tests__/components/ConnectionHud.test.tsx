import { fireEvent, render } from "@testing-library/react-native";
import { ConnectionHud } from "../../components/ConnectionHud";

describe("ConnectionHud", () => {
  it("opens reconnect and disconnect actions", () => {
    const onReconnect = jest.fn();
    const onDisconnect = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <ConnectionHud
        cameraStatus="connected"
        serverStatus="connected"
        onReconnect={onReconnect}
        onDisconnect={onDisconnect}
      />
    );

    expect(queryByTestId("connection-hud-menu")).toBeNull();
    fireEvent.press(getByTestId("connection-hud-toggle"));
    expect(getByTestId("connection-hud-menu")).toBeTruthy();

    fireEvent.press(getByTestId("connection-hud-reconnect"));
    expect(onReconnect).toHaveBeenCalled();
  });

  it("disconnects from the menu", () => {
    const onDisconnect = jest.fn();
    const { getByTestId } = render(
      <ConnectionHud
        cameraStatus="connected"
        serverStatus="connected"
        onReconnect={jest.fn()}
        onDisconnect={onDisconnect}
      />
    );

    fireEvent.press(getByTestId("connection-hud-toggle"));
    fireEvent.press(getByTestId("connection-hud-disconnect"));
    expect(onDisconnect).toHaveBeenCalled();
  });
});
