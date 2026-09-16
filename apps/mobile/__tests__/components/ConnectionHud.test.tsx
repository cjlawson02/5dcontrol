import { fireEvent, render } from "@testing-library/react-native";
import { ConnectionHud } from "../../components/ConnectionHud";

describe("ConnectionHud", () => {
  it("opens reconnect and disconnect actions", async () => {
    const onReconnect = jest.fn();
    const onDisconnect = jest.fn();
    const { getByTestId, queryByTestId } = await render(
      <ConnectionHud
        cameraStatus="connected"
        serverStatus="connected"
        onReconnect={onReconnect}
        onDisconnect={onDisconnect}
      />
    );

    expect(queryByTestId("connection-hud-menu")).toBeNull();
    await fireEvent.press(getByTestId("connection-hud-toggle"));
    expect(getByTestId("connection-hud-menu")).toBeTruthy();

    await fireEvent.press(getByTestId("connection-hud-reconnect"));
    expect(onReconnect).toHaveBeenCalled();
  });

  it("disconnects from the menu", async () => {
    const onDisconnect = jest.fn();
    const { getByTestId } = await render(
      <ConnectionHud
        cameraStatus="connected"
        serverStatus="connected"
        onReconnect={jest.fn()}
        onDisconnect={onDisconnect}
      />
    );

    await fireEvent.press(getByTestId("connection-hud-toggle"));
    await fireEvent.press(getByTestId("connection-hud-disconnect"));
    expect(onDisconnect).toHaveBeenCalled();
  });
});
