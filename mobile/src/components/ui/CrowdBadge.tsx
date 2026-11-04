import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CrowdStatus, CROWD_META } from '../../constants/categories';
import { useApp } from '../../context/app-context';

export interface CrowdBadgeProps {
  status?: CrowdStatus | null;
  compact?: boolean;
  isOffline?: boolean;
}

export function CrowdBadge({ status, compact = false, isOffline = false }: CrowdBadgeProps) {
  const { lang, colors } = useApp();

  if (!status || !CROWD_META[status]) {
    return (
      <View
        style={[
          styles.badgeContainer,
          {
            backgroundColor: colors.secondary,
            borderColor: colors.border,
          },
          compact && styles.compactContainer,
        ]}
      >
        <View style={[styles.dot, { backgroundColor: colors.textMuted }]} />
        <Text
          style={[
            styles.badgeText,
            { color: colors.textSecondary },
            compact && styles.compactText,
          ]}
        >
          {lang === 'te' ? 'స్థితి నివేదించబడలేదు' : 'Status not yet reported'}
        </Text>
      </View>
    );
  }

  const meta = CROWD_META[status];

  return (
    <View
      style={[
        styles.badgeContainer,
        {
          backgroundColor: isOffline ? (meta.dotColor + '18') : meta.bgColor,
          borderColor: isOffline ? '#D97706' : meta.dotColor + '55',
          borderStyle: isOffline ? 'dashed' : 'solid',
        },
        compact && styles.compactContainer,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: isOffline ? '#D97706' : meta.dotColor }]} />
      <Text
        style={[
          styles.badgeText,
          { color: isOffline ? '#D97706' : meta.color },
          compact && styles.compactText,
        ]}
      >
        {isOffline
          ? (lang === 'te' ? `[నిల్వ] ${meta.teLabel}` : `[Cached] ${meta.label}`)
          : (lang === 'te' ? meta.teLabel : meta.label)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
    alignSelf: 'flex-start',
  },
  compactContainer: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  compactText: {
    fontSize: 10,
    fontWeight: '500',
  },
});
