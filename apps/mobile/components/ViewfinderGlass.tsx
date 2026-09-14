import {
  GlassContainer,
  GlassView,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from "expo-glass-effect";
import type { ReactNode } from "react";
import { View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";

export function canUseGlassEffect(): boolean {
  try {
    return isLiquidGlassAvailable() && isGlassEffectAPIAvailable();
  } catch {
    return false;
  }
}

type ViewfinderGlassProps = ViewProps & {
  children?: ReactNode;
  isInteractive?: boolean;
  /** Applied only when liquid glass is unavailable (View fallback). */
  fallbackStyle?: StyleProp<ViewStyle>;
};

/**
 * Glass chrome for the viewfinder HUD. Uses GlassView on supported iOS;
 * falls back to View with optional fallbackStyle elsewhere.
 * Never drive visibility via opacity on this node or its parents.
 */
export function ViewfinderGlass({
  style,
  fallbackStyle,
  isInteractive,
  children,
  ...rest
}: ViewfinderGlassProps) {
  if (canUseGlassEffect()) {
    return (
      <GlassView
        style={style}
        glassEffectStyle="regular"
        colorScheme="dark"
        isInteractive={isInteractive}
        {...rest}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View style={[style, fallbackStyle]} {...rest}>
      {children}
    </View>
  );
}

type ViewfinderGlassContainerProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  spacing?: number;
};

export function ViewfinderGlassContainer({
  children,
  style,
  spacing = 12,
}: ViewfinderGlassContainerProps) {
  if (canUseGlassEffect()) {
    return (
      <GlassContainer spacing={spacing} style={style}>
        {children}
      </GlassContainer>
    );
  }

  return <View style={style}>{children}</View>;
}
