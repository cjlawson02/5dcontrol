import { Button, Text } from "@rneui/themed";
import { Link, Stack } from "expo-router";
import { StyleSheet, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View style={styles.container}>
        <Text h4 style={styles.title}>
          This screen does not exist.
        </Text>
        <Link href="/" asChild>
          <Button type="clear" title="Go to home screen!" />
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    marginBottom: 20,
    textAlign: "center",
  },
});
