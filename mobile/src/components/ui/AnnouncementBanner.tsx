import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { AnnouncementItem } from '../../types';
import { useApp } from '../../context/app-context';
import { Spacing } from '../../constants/theme';
import { AppIcon } from './AppIcon';

export interface AnnouncementBannerProps {
  announcement: AnnouncementItem;
  onPressAction?: () => void;
}

export function AnnouncementBanner({ announcement, onPressAction }: AnnouncementBannerProps) {
  const { lang, colors } = useApp();

  return (
    <View style={styles.container}>
      <View style={styles.contentRow}>
        <View style={styles.badgeRow}>
          {announcement.badgeText && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{announcement.badgeText}</Text>
            </View>
          )}
          {announcement.isMock && (
            <View style={styles.mockTag}>
              <Text style={styles.mockTagText}>
                {lang === 'te' ? 'నమూనా సమాచారం' : 'Sample preview'}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.title}>{announcement.title}</Text>
        {announcement.description && (
          <Text style={styles.description}>{announcement.description}</Text>
        )}
      </View>

      {announcement.buttonText && onPressAction && (
        <Pressable
          onPress={onPressAction}
          style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.85 }]}
          hitSlop={8}
        >
          <Text style={styles.actionButtonText}>{announcement.buttonText}</Text>
          <AppIcon
            name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow-right' }}
            size={13}
            color="#0F4C4C"
          />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0E5C5C',
    borderRadius: 14,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  contentRow: {
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  badge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  badgeText: {
    color: '#381C03',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  mockTag: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  mockTagText: {
    color: '#D1FAE5',
    fontSize: 9,
    fontWeight: '500',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  description: {
    color: '#CCFBF1',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  actionButton: {
    marginTop: Spacing.two,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  actionButtonText: {
    color: '#0F4C4C',
    fontSize: 12,
    fontWeight: '700',
  },
});
