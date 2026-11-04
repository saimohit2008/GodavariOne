import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useApp } from '../../context/app-context';
import { Spacing } from '../../constants/theme';

export interface EmptyStateProps {
  title: string;
  message: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  message,
  icon,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { colors } = useApp();

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
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>
        {message}
      </Text>

      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: colors.primary },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.two,
    gap: Spacing.one,
  },
  iconContainer: {
    marginBottom: Spacing.two,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  button: {
    marginTop: Spacing.two,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
