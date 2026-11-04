import React from 'react';
import { StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';

export interface AppIconProps {
  name: {
    ios: string;
    android: string;
    web?: string;
  };
  size?: number;
  color?: string;
}

export function AppIcon({ name, size = 20, color = '#168A8A' }: AppIconProps) {
  return (
    <SymbolView
      name={{
        ios: name.ios as any,
        android: name.android as any,
        web: (name.web || name.android) as any,
      }}
      size={size}
      tintColor={color}
      style={{ width: size, height: size }}
    />
  );
}

const styles = StyleSheet.create({});
