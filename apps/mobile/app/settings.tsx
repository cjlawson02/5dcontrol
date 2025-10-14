import { router } from "expo-router";
import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  GoldenRatioIcon,
  NoGridIcon,
  RuleOfThirdsIcon,
} from "../components/GridIcons";
import { GridType, useSettings } from "../contexts/SettingsContext";

interface GridTypeOption {
  readonly id: GridType;
  readonly name: string;
  readonly icon: React.ComponentType<{ size?: number; color?: string }>;
}

const GRID_TYPES: readonly GridTypeOption[] = [
  { id: "none", name: "No Grid", icon: NoGridIcon },
  { id: "rule-of-thirds", name: "Rule of Thirds", icon: RuleOfThirdsIcon },
  { id: "golden-ratio", name: "Golden Ratio", icon: GoldenRatioIcon },
] as const;

export default function SettingsPage() {
  const { state, setGridType } = useSettings();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleGridSelect = (gridId: GridType) => {
    console.log("Settings: Selecting grid type:", gridId);
    setGridType(gridId);
    setIsDropdownOpen(false);
  };

  const handleBack = () => {
    router.back();
  };

  const selectedGrid = GRID_TYPES.find((grid) => grid.id === state.gridType);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Grid Overlay</Text>

          <TouchableWithoutFeedback onPress={() => setIsDropdownOpen(false)}>
            <View>
              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setIsDropdownOpen(!isDropdownOpen)}
                activeOpacity={0.7}
              >
                <View style={styles.dropdownButtonContent}>
                  {selectedGrid && <selectedGrid.icon size={20} color="#fff" />}
                  <Text style={styles.dropdownButtonText}>
                    {selectedGrid?.name}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.dropdownArrow,
                    isDropdownOpen && styles.dropdownArrowOpen,
                  ]}
                >
                  ▼
                </Text>
              </TouchableOpacity>

              {isDropdownOpen && (
                <View style={styles.dropdownContainer}>
                  {GRID_TYPES.map((grid) => (
                    <TouchableOpacity
                      key={grid.id}
                      style={[
                        styles.dropdownItem,
                        state.gridType === grid.id &&
                          styles.dropdownItemSelected,
                      ]}
                      onPress={() => handleGridSelect(grid.id)}
                      activeOpacity={0.7}
                    >
                      <grid.icon
                        size={20}
                        color={state.gridType === grid.id ? "#007AFF" : "#666"}
                      />
                      <Text
                        style={[
                          styles.dropdownItemText,
                          state.gridType === grid.id &&
                            styles.dropdownItemTextSelected,
                        ]}
                      >
                        {grid.name}
                      </Text>
                      {state.gridType === grid.id && (
                        <Text style={styles.dropdownItemCheck}>✓</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  placeholder: {
    width: 60, // Same width as back button for centering
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  dropdownButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#333",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    alignSelf: "flex-start",
    minWidth: 200,
    maxWidth: 250,
  },
  dropdownButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  dropdownButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
  },
  dropdownArrow: {
    color: "#666",
    fontSize: 12,
    transform: [{ rotate: "0deg" }],
  },
  dropdownArrowOpen: {
    transform: [{ rotate: "180deg" }],
  },
  dropdownContainer: {
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333",
    marginTop: 4,
    alignSelf: "flex-start",
    minWidth: 200,
    maxWidth: 250,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  dropdownItemSelected: {
    backgroundColor: "#2a2a2a",
  },
  dropdownItemText: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 10,
  },
  dropdownItemTextSelected: {
    color: "#007AFF",
    fontWeight: "600",
  },
  dropdownItemCheck: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});
