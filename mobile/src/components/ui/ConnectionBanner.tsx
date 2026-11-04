import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useApp } from '../../context/app-context';
import { Spacing } from '../../constants/theme';
import { AppIcon } from './AppIcon';

export interface ConnectionBannerProps {
  isLive: boolean;
  apiUrl?: string;
  connectionError?: string | null;
  onRetry?: () => void;
}

export function ConnectionBanner({
  isLive,
  apiUrl,
  connectionError,
  onRetry,
}: ConnectionBannerProps) {
  const { lang, colors, isDark } = useApp();

  if (isLive) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
            borderColor: isDark ? 'rgba(16, 185, 129, 0.28)' : '#A7F3D0',
          },
        ]}
      >
        <View style={styles.contentRow}>
          <View style={styles.liveDot} />
          <Text
            style={[
              styles.text,
              { color: isDark ? '#6EE7B7' : '#047857' },
            ]}
          >
            {lang === 'te'
              ? 'లైవ్ బ్యాకెండ్‌కి కనెక్ట్ చేయబడింది'
              : 'Connected to live Godavari One backend'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.14)' : '#FFFBEB',
          borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : '#FDE68A',
        },
      ]}
    >
      <View style={styles.contentRow}>
        <AppIcon
          name={{ ios: 'wifi.exclamationmark', android: 'wifi_off', web: 'wifi-off' }}
          size={14}
          color={isDark ? '#FBBF24' : '#B45309'}
        />
        <View style={styles.textCol}>
          <Text
            style={[
              styles.warningTitle,
              { color: isDark ? '#FBBF24' : '#B45309' },
            ]}
          >
            {lang === 'te'
              ? 'లైవ్ సర్వర్ అందుబాటులో లేదు — స్థానిక డేటాబేస్ స్నాప్‌షాట్ చూపబడుతోంది'
              : 'Backend unreachable — displaying verified database snapshot (9 listings)'}
          </Text>
          {connectionError ? (
            <Text
              style={[
                styles.warningSubtitle,
                { color: isDark ? '#D97706' : '#92400E' },
              ]}
              numberOfLines={1}
            >
              {connectionError}
            </Text>
          ) : null}
        </View>
      </View>

      {onRetry && (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => [
            styles.retryButton,
            {
              backgroundColor: isDark ? '#78350F' : '#FEF3C7',
              borderColor: isDark ? '#B45309' : '#F59E0B',
            },
            pressed && { opacity: 0.7 },
          ]}
          hitSlop={6}
        >
          <Text
            style={[
              styles.retryText,
              { color: isDark ? '#FDE68A' : '#92400E' },
            ]}
          >
            {lang === 'te' ? 'రీట్రై' : 'Retry'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: Spacing.three,
    gap: 8,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
  textCol: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  warningSubtitle: {
    fontSize: 9.5,
    marginTop: 1,
  },
  retryButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  retryText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
