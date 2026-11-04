import React from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { useApp } from '../../context/app-context';
import { Spacing } from '../../constants/theme';
import { AppIcon } from './AppIcon';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  onFilterPress?: () => void;
  activeFilterCount?: number;
}

export function SearchBar({
  value,
  onChangeText,
  onSubmit,
  placeholder,
  autoFocus = false,
  onFilterPress,
  activeFilterCount = 0,
}: SearchBarProps) {
  const { lang, colors } = useApp();

  const searchPlaceholder =
    placeholder ||
    (lang === 'te'
      ? 'రెస్టారెంట్‌లు, హోటళ్లు, ఘాట్‌లు, ఆసుపత్రులు శోధించండి...'
      : 'Search restaurants, hotels, ghats, hospitals...');

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.iconWrapper}>
        <AppIcon
          name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
          size={18}
          color={colors.textSecondary}
        />
      </View>

      <TextInput
        style={[styles.input, { color: colors.text }]}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={searchPlaceholder}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        autoFocus={autoFocus}
        autoCorrect={false}
        autoComplete="off"
      />

      {value.length > 0 && (
        <Pressable
          onPress={() => onChangeText('')}
          style={({ pressed }) => [styles.clearButton, pressed && { opacity: 0.6 }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear Search"
        >
          <AppIcon
            name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'times-circle' }}
            size={16}
            color={colors.textMuted}
          />
        </Pressable>
      )}

      {onFilterPress && (
        <View style={styles.filterGroup}>
          <View style={[styles.filterDivider, { backgroundColor: colors.border }]} />
          <Pressable
            onPress={onFilterPress}
            style={({ pressed }) => [
              styles.filterButton,
              activeFilterCount > 0 && { backgroundColor: colors.secondary },
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Filter (${activeFilterCount} active)`}
          >
            <AppIcon
              name={{ ios: 'line.3.horizontal.decrease.circle', android: 'filter_list', web: 'filter' }}
              size={18}
              color={activeFilterCount > 0 ? colors.primary : colors.textSecondary}
            />
            {activeFilterCount > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: Spacing.four,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  iconWrapper: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
  },
  inputPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  placeholderText: {
    fontSize: 14,
  },
  clearButton: {
    padding: 4,
    marginLeft: 6,
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
  },
  filterDivider: {
    width: 1,
    height: 20,
    marginRight: 8,
  },
  filterButton: {
    padding: 6,
    borderRadius: 8,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
});
