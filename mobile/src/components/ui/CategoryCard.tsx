import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { CategoryMetaItem } from '../../constants/categories';
import { useApp } from '../../context/app-context';
import { AppIcon } from './AppIcon';

export interface CategoryCardProps {
  category: CategoryMetaItem;
  isSelected?: boolean;
  onPress: () => void;
  variant?: 'grid' | 'chip';
}

export function CategoryCard({
  category,
  isSelected = false,
  onPress,
  variant = 'grid',
}: CategoryCardProps) {
  const { lang, colors, isDark } = useApp();

  const label = lang === 'te' ? category.teLabel : category.label;
  const iconBg = isDark ? category.darkBg : category.lightBg;

  if (variant === 'chip') {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.chipContainer,
          {
            backgroundColor: isSelected ? colors.primary : colors.card,
            borderColor: isSelected ? colors.primary : colors.border,
          },
          pressed && { opacity: 0.8 },
        ]}
      >
        <AppIcon
          name={category.symbol}
          size={14}
          color={isSelected ? '#FFFFFF' : category.color}
        />
        <Text
          style={[
            styles.chipText,
            { color: isSelected ? '#FFFFFF' : colors.text },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.gridContainer,
        {
          backgroundColor: colors.card,
          borderColor: isSelected ? colors.primary : colors.border,
        },
        isSelected && styles.selectedBorder,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <AppIcon name={category.symbol} size={22} color={category.color} />
      </View>

      <Text
        style={[
          styles.gridLabel,
          { color: isSelected ? colors.primary : colors.text },
        ]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  selectedBorder: {
    borderWidth: 2,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
  },
  chipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.98 }],
  },
});
