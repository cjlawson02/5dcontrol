import { Button, Host, Row, Spacer, Text } from "@expo/ui";
import { ReactNode } from "react";
import { StyleSheet, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface PageLayoutProps {
  title: string;
  onBack: () => void;
  children: ReactNode;
  transparent?: boolean;
  scale?: number;
  containerStyle?: ViewStyle;
}

/**
 * Shared page chrome (back + title) using Expo UI universal primitives.
 */
export function PageLayout({
  title,
  onBack,
  children,
  transparent = false,
  scale = 1,
  containerStyle,
}: PageLayoutProps) {
  const padH = Math.round(scale * 20);
  const padV = Math.round(scale * 10);
  const titleSize = Math.round(scale * 18);
  const balanceWidth = Math.round(scale * 72);

  return (
    <SafeAreaView style={[styles.container, containerStyle]}>
      <Host
        colorScheme="dark"
        matchContents={{ vertical: true }}
        style={{
          width: "100%",
          borderBottomWidth: transparent ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: transparent
            ? "transparent"
            : "rgba(255, 255, 255, 0.1)",
        }}
      >
        <Row
          alignment="center"
          spacing={8}
          style={{
            paddingHorizontal: padH,
            paddingVertical: padV,
            backgroundColor: transparent ? "transparent" : undefined,
          }}
        >
          <Button
            testID="page-back"
            label="← Back"
            variant="text"
            onPress={onBack}
          />
          <Spacer flexible />
          <Text
            textStyle={{
              color: "#FFFFFF",
              fontSize: titleSize,
              fontWeight: "700",
            }}
          >
            {title}
          </Text>
          <Spacer flexible />
          <Spacer size={balanceWidth} />
        </Row>
      </Host>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
});
