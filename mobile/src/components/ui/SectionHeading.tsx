import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useApp } from '../../context/app-context';
import { Spacing } from '../../constants/theme';

export interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

export function SectionHeading({
  title,
  subtitle,
  actionLabel,
  onAction,
  icon,
}: SectionHeadingProps) {
  const { colors } = useApp();

  return (
    <View style={styles.container}>
      <View style={styles.textColumn}>
        <View style={styles.titleRow}>
          {icon && <View style={styles.iconWrapper}>{icon}</View>}
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        </View>
        {subtitle && (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>

      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: colors.secondary },
            pressed && { opacity: 0.7 },
          ]}
          hitSlop={8}
        >
          <Text style={[styles.actionText, { color: colors.primary }]}>{actionLabel} →</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.two,
    gap: Spacing.two,
  },
  textColumn: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'center',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
