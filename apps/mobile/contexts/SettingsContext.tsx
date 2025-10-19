import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useReducer,
} from "react";
import { logger } from "../utils/logger";

export type GridType = "none" | "rule-of-thirds" | "golden-ratio";

interface SettingsState {
  gridType: GridType;
}

type SettingsAction =
  | { type: "SET_GRID_TYPE"; payload: GridType }
  | { type: "LOAD_SETTINGS"; payload: Partial<SettingsState> };

interface SettingsContextType {
  state: SettingsState;
  setGridType: (gridType: GridType) => void;
  dispatch?: (action: SettingsAction) => void;
  loadSettings?: () => Promise<void>;
}

const initialState: SettingsState = {
  gridType: "none",
};

const settingsReducer = (
  state: SettingsState,
  action: SettingsAction
): SettingsState => {
  switch (action.type) {
    case "SET_GRID_TYPE":
      return { ...state, gridType: action.payload };
    case "LOAD_SETTINGS":
      return { ...state, ...action.payload };
    default:
      return state;
  }
};

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(settingsReducer, initialState);

  const setGridType = async (gridType: GridType) => {
    // Update local state immediately for instant UI feedback
    dispatch({ type: "SET_GRID_TYPE", payload: gridType });

    try {
      // Persist to storage
      await AsyncStorage.setItem("gridType", gridType);
    } catch (error) {
      logger.error("Settings: Error saving grid type:", error);
    }
  };

  const loadSettings = async () => {
    try {
      const savedGridType = await AsyncStorage.getItem("gridType");
      const gridType = (savedGridType as GridType) || "none";

      dispatch({
        type: "LOAD_SETTINGS",
        payload: { gridType },
      });
    } catch (error) {
      logger.error("Settings: Error loading settings:", error);
    }
  };

  // Load settings on mount
  useEffect(() => {
    // Skip loading settings in test environment to allow mocking
    if (process.env.NODE_ENV !== "test") {
      loadSettings();
    }
  }, []);

  const value: SettingsContextType = {
    state,
    setGridType,
    dispatch,
    loadSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
