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
import { formatIpv4Typing } from "../utils/formatIpv4";
import { logger } from "../utils/logger";
import { useWebSocketContext } from "./WebSocketContext";

/**
 * Native iOS connection screen using SwiftUI Form / Section / TextField.
 */
const ConnectionPage: React.FC = () => {
  const { status, ip, connect } = useWebSocketContext();
  const ipField = useNativeState(ip ?? "");
  const previousIp = useRef(ipField.value);
  const isLoading = status === "loading";

  logger.debug(
    `ConnectionPage: Render - status: ${status}, ip: ${ip}, ipField: ${ipField.value}`
  );

  useEffect(() => {
    if (ip != null && ip !== ipField.value) {
      logger.debug(`ConnectionPage: IP changed, updating field to: ${ip}`);
      ipField.value = ip;
      previousIp.current = ip;
    }
  }, [ip, ipField]);

  const handleIpChange = (text: string) => {
    const formatted = formatIpv4Typing(text, previousIp.current);
    previousIp.current = formatted;
    ipField.value = formatted;
  };

  const handleSubmit = async () => {
    const newIp = ipField.value.trim().replace(/\.$/, "");
    logger.info(`ConnectionPage: Connect button clicked with IP: ${newIp}`);
    if (!newIp || isLoading) {
      return;
    }
    await connect(newIp);
  };

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
          <Section
            title="Server Connection"
            footer={
              <Text>
                Number pad input — periods are inserted automatically after each
                3-digit octet.
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
