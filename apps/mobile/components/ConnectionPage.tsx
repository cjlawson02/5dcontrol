import { Button, Card, Input } from "@rneui/themed";
import React, { useEffect, useState } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { logger } from "../utils/logger";
import { useWebSocketContext } from "./WebSocketContext";

const ConnectionPage: React.FC = () => {
  const { status, ip, connect } = useWebSocketContext();
  const [ipField, setIpField] = useState<string>(ip ?? "");

  logger.debug(
    `ConnectionPage: Render - status: ${status}, ip: ${ip}, ipField: ${ipField}`
  );

  useEffect(() => {
    if (ip) {
      logger.debug(`ConnectionPage: IP changed, updating field to: ${ip}`);
      setIpField(ip);
    }
  }, [ip]);

  const handleIpChange = (text: string) => {
    setIpField(text);
  };

  const handleSubmit = async () => {
    const newIp = ipField.trim();
    logger.info(`ConnectionPage: Connect button clicked with IP: ${newIp}`);
    if (!newIp) {
      return;
    }
    await connect(newIp);
  };

  return (
    <Pressable
      onPress={Keyboard.dismiss}
      accessible={false}
      testID="connection-container"
      style={{ flex: 1 }}
    >
      <SafeAreaView style={styles.container}>
        <Text style={styles.logo}>5DControl</Text>
        <View style={styles.content}>
          <Card>
            <Card.Title>Server Connection</Card.Title>
            <Card.Divider />
            <Input
              label="Server IP Address"
              containerStyle={{ paddingHorizontal: 0 }}
              inputStyle={styles.input}
              value={ipField}
              onChangeText={handleIpChange}
              editable={!(status === "loading")}
              placeholder="Enter server IP"
              keyboardType="numeric"
              autoCapitalize="none"
            />
            <Button title="Connect" onPress={handleSubmit} />
          </Card>
        </View>
      </SafeAreaView>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
    backgroundColor: "#181A20",
    paddingTop: 0,
    paddingHorizontal: 0,
  },
  logo: {
    textAlign: "center",
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginTop: 24,
    letterSpacing: 2,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  label: {
    marginBottom: 8,
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  input: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
    color: "#fff",
    backgroundColor: "#222",
  },
});

export default ConnectionPage;
