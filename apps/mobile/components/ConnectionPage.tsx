import { Button, Card, Input } from "@rneui/themed";
import React, { useEffect, useState } from "react";
import {
  Keyboard,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useWebSocketContext } from "./WebSocketContext";

const ConnectionPage: React.FC = () => {
  const { status, ip, setIp } = useWebSocketContext();
  const [ipField, setIpField] = useState<string>(ip ?? "");

  useEffect(() => {
    if (ip) {
      setIpField(ip);
    }
  }, [ip]);

  const handleIpChange = async (text: string) => {
    setIpField(text);
  };

  const handleSubmit = async () => {
    setIp(ipField.trim());
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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
    </TouchableWithoutFeedback>
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
