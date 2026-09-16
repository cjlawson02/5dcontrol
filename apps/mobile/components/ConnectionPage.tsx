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
import { useMdnsBrowse } from "../hooks/useMdnsBrowse";
import { formatIpv4Typing } from "../utils/formatIpv4";
import { logger } from "../utils/logger";
import { readNativeState, writeNativeState } from "../utils/nativeState";
import { useWebSocketContext } from "./WebSocketContext";

/** Android / web connection screen using Expo UI universal Form-style layout. */
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

  const nearbyHint = (() => {
    if (!supported) {
      return "Local network browse is iOS-only in this build. Enter the server IP below.";
    }
    if (error) {
      return error;
    }
    if (scanning && servers.length === 0) {
      return "Looking for 5DControl on this Wi‑Fi…";
    }
    if (servers.length === 0) {
      return "No servers found. Enter an IP below.";
    }
    return "Tap a discovered server, or enter an IP.";
  })();

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
              <FieldGroup.Section title="Nearby servers">
                <Text textStyle={{ color: "#8E8E93", fontSize: 13 }}>
                  {nearbyHint}
                </Text>
                {servers.map((server) => (
                  <Button
                    key={server.id}
                    label={`${server.name} (${server.host})`}
                    onPress={() => {
                      if (isLoading) {
                        return;
                      }
                      void connect(server.host, server.ports);
                    }}
                    disabled={isLoading}
                    variant="outlined"
                  />
                ))}
                <Button
                  label={scanning ? "Scanning…" : "Scan again"}
                  onPress={rescan}
                  disabled={!supported || isLoading || scanning}
                  variant="outlined"
                />
              </FieldGroup.Section>
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
