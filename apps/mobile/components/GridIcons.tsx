import React from 'react';
import { View } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';

interface GridIconProps {
  size?: number;
  color?: string;
}

export const NoGridIcon: React.FC<GridIconProps> = ({ size = 20, color = "#666" }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" fill="none" />
      <Line x1="8" y1="8" x2="16" y2="16" stroke={color} strokeWidth="2" />
      <Line x1="16" y1="8" x2="8" y2="16" stroke={color} strokeWidth="2" />
    </Svg>
  </View>
);

export const RuleOfThirdsIcon: React.FC<GridIconProps> = ({ size = 20, color = "#666" }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Vertical lines */}
      <Line x1="8" y1="2" x2="8" y2="22" stroke={color} strokeWidth="1.5" />
      <Line x1="16" y1="2" x2="16" y2="22" stroke={color} strokeWidth="1.5" />
      {/* Horizontal lines */}
      <Line x1="2" y1="8" x2="22" y2="8" stroke={color} strokeWidth="1.5" />
      <Line x1="2" y1="16" x2="22" y2="16" stroke={color} strokeWidth="1.5" />
    </Svg>
  </View>
);

export const GoldenRatioIcon: React.FC<GridIconProps> = ({ size = 20, color = "#666" }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* Golden ratio vertical lines (61.8% and 38.2%) */}
      <Line x1="14.8" y1="2" x2="14.8" y2="22" stroke={color} strokeWidth="1.5" />
      <Line x1="9.2" y1="2" x2="9.2" y2="22" stroke={color} strokeWidth="1.5" />
      {/* Golden ratio horizontal lines */}
      <Line x1="2" y1="14.8" x2="22" y2="14.8" stroke={color} strokeWidth="1.5" />
      <Line x1="2" y1="9.2" x2="22" y2="9.2" stroke={color} strokeWidth="1.5" />
    </Svg>
  </View>
);
