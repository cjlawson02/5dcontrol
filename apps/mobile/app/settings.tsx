import { FieldGroup, Host, Picker, Row, Spacer, Text } from "@expo/ui";
import { router } from "expo-router";
import { PageLayout } from "../components/PageLayout";
import { GridType, useSettings } from "../contexts/SettingsContext";
import { logger } from "../utils/logger";

const GRID_TYPES: readonly { id: GridType; name: string }[] = [
  { id: "none", name: "No Grid" },
  { id: "rule-of-thirds", name: "Rule of Thirds" },
  { id: "golden-ratio", name: "Golden Ratio" },
] as const;

export default function SettingsPage() {
  const { state, setGridType } = useSettings();

  const handleGridSelect = (value: string) => {
    logger.info("Settings: Selecting grid type:", value);
    setGridType(value as GridType);
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <PageLayout title="Settings" onBack={handleBack}>
      <Host colorScheme="dark" style={{ flex: 1 }}>
        <FieldGroup style={{ backgroundColor: "#000000" }}>
          <FieldGroup.Section title="Grid Overlay">
            <Row alignment="center" spacing={12}>
              <Text textStyle={{ color: "#FFFFFF" }}>Type</Text>
              <Spacer flexible />
              <Picker
                testID="grid-type-picker"
                selectedValue={state.gridType ?? "none"}
                onValueChange={handleGridSelect}
              >
                {GRID_TYPES.map((grid) => (
                  <Picker.Item
                    key={grid.id}
                    label={grid.name}
                    value={grid.id}
                  />
                ))}
              </Picker>
            </Row>
          </FieldGroup.Section>
        </FieldGroup>
      </Host>
    </PageLayout>
  );
}
