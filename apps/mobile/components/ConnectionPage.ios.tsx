import {
  Button,
  Form,
  Host,
  Section,
  Text,
  TextField,
  useNativeState,
} from "@expo/ui/swift-ui";
import {
  autocorrectionDisabled,
  buttonStyle,
  controlSize,
  disabled,
  keyboardType,
  listStyle,
  onSubmit,
  scrollContentBackground,
  submitLabel,
} from "@expo/ui/swift-ui/modifiers";
import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useMdnsBrowse } from "../hooks/useMdnsBrowse";
import { formatIpv4Typing } from "../utils/formatIpv4";
import { logger } from "../utils/logger";
import { readNativeState, writeNativeState } from "../utils/nativeState";
import { useWebSocketContext } from "./WebSocketContext";

/**
 * Native iOS connection screen using SwiftUI Form / Section / TextField.
 * Nearby `_5dcontrol._tcp` hosts are listed when Bonjour browse is available.
 */
const ConnectionPage: React.FC = () => {
  const { status, ip, connect } = useWebSocketContext();
  const { servers, supported, scanning, error, rescan } = useMdnsBrowse();
  const ipField = useNativeState(ip ?? "");
  const previousIp = useRef(readNativeState(ipField));
  const isLoading = status === "loading";

  logger.debug(
    `ConnectionPage: Render - status: ${status}, ip: ${ip}, ipField: ${readNativeState(ipField)}`
  );

  useEffect(() => {
    if (ip != null && ip !== readNativeState(ipField)) {
      logger.debug(`ConnectionPage: IP changed, updating field to: ${ip}`);
      writeNativeState(ipField, ip);
      previousIp.current = ip;
    }
  }, [ip, ipField]);

  const handleIpChange = (text: string) => {
    const formatted = formatIpv4Typing(text, previousIp.current);
    previousIp.current = formatted;
    writeNativeState(ipField, formatted);
  };

  const handleSubmit = async () => {
    const newIp = readNativeState(ipField).trim().replace(/\.$/, "");
    logger.info(`ConnectionPage: Connect button clicked with IP: ${newIp}`);
    if (!newIp || isLoading) {
      return;
    }
    await connect(newIp);
  };

  const nearbyFooter = (() => {
    if (!supported) {
      return "This build cannot browse the local network (use a dev client). Enter the server IP below.";
    }
    if (error) {
      return error;
    }
    if (scanning && servers.length === 0) {
      return "Looking for 5DControl on this Wi‑Fi… Allow Local Network access if iOS asks.";
    }
    if (servers.length === 0) {
      return "No servers found. Check Local Network permission in Settings, join the same LAN, or enter an IP below.";
    }
    return "Tap a server to connect. WebSocket :8888 and HTTP :8080 come from the advertisement TXT.";
  })();

  return (
    <View style={styles.container} testID="connection-container">
      <Host
        style={styles.host}
        colorScheme="dark"
        useViewportSizeMeasurement
      >
        <Form
          modifiers={[
            listStyle("insetGrouped"),
            scrollContentBackground("hidden"),
          ]}
        >
          <Section title="Nearby servers" footer={<Text>{nearbyFooter}</Text>}>
            {servers.map((server) => (
              <Button
                key={server.id}
                label={`${server.name} (${server.host})`}
                onPress={() => {
                  if (isLoading) {
                    return;
                  }
                  logger.info(
                    `ConnectionPage: Connecting to discovered ${server.host}`
                  );
                  void connect(server.host, server.ports);
                }}
                modifiers={[
                  buttonStyle("bordered"),
                  controlSize("regular"),
                  disabled(isLoading),
                ]}
              />
            ))}
            <Button
              label={scanning ? "Scanning…" : "Scan again"}
              onPress={rescan}
              modifiers={[
                buttonStyle("bordered"),
                controlSize("regular"),
                disabled(!supported || isLoading || scanning),
              ]}
            />
          </Section>

          <Section
            title="Server Connection"
            footer={
              <Text>
                Manual IP fallback — periods are inserted automatically after
                each 3-digit octet.
              </Text>
            }
          >
            <TextField
              text={ipField}
              placeholder="Server IP Address"
              onTextChange={handleIpChange}
              modifiers={[
                keyboardType("decimal-pad"),
                autocorrectionDisabled(true),
                submitLabel("go"),
                onSubmit(handleSubmit),
                disabled(isLoading),
              ]}
            />
          </Section>

          <Section>
            <Button
              label={isLoading ? "Connecting…" : "Connect"}
              onPress={handleSubmit}
              modifiers={[
                buttonStyle("borderedProminent"),
                controlSize("regular"),
                disabled(isLoading),
              ]}
            />
          </Section>
        </Form>
      </Host>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  host: {
    flex: 1,
  },
});

export default ConnectionPage;
