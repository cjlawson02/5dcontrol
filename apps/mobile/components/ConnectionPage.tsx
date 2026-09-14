import {
  Button,
  FieldGroup,
  Host,
  Text,
  TextInput,
  useNativeState,
} from "@expo/ui";
import React, { useEffect, useRef } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatIpv4Typing } from "../utils/formatIpv4";
import { logger } from "../utils/logger";
import { useWebSocketContext } from "./WebSocketContext";

/** Android / web connection screen using Expo UI universal Form-style layout. */
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
    <Pressable
      onPress={Keyboard.dismiss}
      accessible={false}
      testID="connection-container"
      style={styles.flex}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Host colorScheme="dark" style={styles.host}>
            <FieldGroup style={{ backgroundColor: "#000000" }}>
              <FieldGroup.Section title="Server Connection">
                <Text textStyle={{ color: "#8E8E93", fontSize: 13 }}>
                  Server IP Address
                </Text>
                <TextInput
                  testID="server-ip-input"
                  value={ipField}
                  editable={!isLoading}
                  placeholder="192.168.1.100"
                  keyboardType="decimal-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onChangeText={handleIpChange}
                  onSubmitEditing={handleSubmit}
                  style={{ width: "100%", height: 44 }}
                />
                <Button
                  label={isLoading ? "Connecting…" : "Connect"}
                  onPress={handleSubmit}
                  disabled={isLoading}
                  variant="filled"
                />
              </FieldGroup.Section>
            </FieldGroup>
          </Host>
        </View>
      </SafeAreaView>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: "#000000" },
  content: { flex: 1 },
  host: { flex: 1 },
});

export default ConnectionPage;
