import { Button, Column, Host, Text } from "@expo/ui";
import { router, Stack } from "expo-router";
import { StyleSheet } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <Host colorScheme="dark" style={styles.host}>
        <Column spacing={20} alignment="center" style={{ padding: 20 }}>
          <Text
            textStyle={{
              color: "#FFFFFF",
              fontSize: 20,
              fontWeight: "600",
              textAlign: "center",
            }}
          >
            This screen does not exist.
          </Text>
          <Button
            label="Go to home screen!"
            variant="text"
            onPress={() => router.replace("/")}
          />
        </Column>
      </Host>
    </>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
