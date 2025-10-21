import { Text } from "@rneui/themed";
import { ReactNode } from "react";
import { StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";
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
 * Shared page layout component with consistent header and structure
 */
export function PageLayout({
  title,
  onBack,
  children,
  transparent = false,
  scale = 1,
  containerStyle,
}: PageLayoutProps) {
  const headerStyles = createHeaderStyles({ transparent, scale });

  return (
    <SafeAreaView style={[styles.container, containerStyle]}>
      <View style={headerStyles.header}>
        <TouchableOpacity onPress={onBack} style={headerStyles.backButton}>
          <Text style={headerStyles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={headerStyles.title}>{title}</Text>
        <View style={headerStyles.placeholder} />
      </View>
      {children}
    </SafeAreaView>
  );
}

/**
 * Creates header styles with optional transparency and scaling
 */
function createHeaderStyles(options?: {
  transparent?: boolean;
  scale?: number;
}) {
  const { transparent = false, scale = 1 } = options || {};

  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Math.round(scale * 20),
      paddingVertical: Math.round(scale * 10),
      borderBottomWidth: transparent ? 0 : 1,
      borderBottomColor: transparent
        ? "transparent"
        : "rgba(255, 255, 255, 0.1)",
      backgroundColor: transparent ? "transparent" : undefined,
    },
    title: {
      color: "#fff",
      fontSize: Math.round(scale * 18),
      fontWeight: "bold" as const,
    },
    backButton: {
      padding: Math.round(scale * 8),
    },
    backButtonText: {
      color: "#fff",
      fontSize: Math.round(scale * 16),
      fontWeight: "600" as const,
    },
    placeholder: {
      width: Math.round(scale * 60),
    },
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
});
