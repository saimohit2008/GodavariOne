import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useApp } from '@/context/app-context';
import { Spacing, BottomTabInset, Shadows } from '@/constants/theme';
import { EmptyState } from '@/components/ui/EmptyState';
import { AppIcon } from '@/components/ui/AppIcon';
import { getNotifications, markNotificationsRead } from '@/services/api';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang, colors, isDark, t, user } = useApp();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await getNotifications();
      if (res.data) {
        setNotifications(res.data.items || []);
        setUnreadCount(res.data.unread || 0);
      }
    } catch {
      // safe fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await markNotificationsRead({ all: true });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // safe fallback
    }
  };

  const handleNotificationPress = async (item: any) => {
    if (!item.read) {
      try {
        await markNotificationsRead({ id: item.id });
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // safe fallback
      }
    }
    if (item.link) {
      router.push(item.link);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header Bar */}
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: Math.max(insets.top, 12),
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: colors.secondary },
              pressed && { opacity: 0.7 },
            ]}
          >
            <AppIcon
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow-left' }}
              size={18}
              color={colors.text}
            />
          </Pressable>

          <View style={styles.titleCol}>
            <Text style={[styles.screenTitle, { color: colors.text }]}>
              {t('notifications')}
            </Text>
            {unreadCount > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.unreadBadgeText}>
                  {unreadCount} {lang === 'te' ? 'కొత్తవి' : 'New'}
                </Text>
              </View>
            )}
          </View>

          {unreadCount > 0 && (
            <Pressable
              onPress={handleMarkAllRead}
              accessibilityRole="button"
              accessibilityLabel="Mark all notifications as read"
              style={({ pressed }) => [
                styles.markAllBtn,
                { backgroundColor: colors.secondary },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.markAllText, { color: colors.primary }]}>
                {t('markAllRead')}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + BottomTabInset + 20 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loaderText, { color: colors.textSecondary }]}>
              {t('loading')}
            </Text>
          </View>
        ) : notifications.length === 0 ? (
          <EmptyState
            title={t('noNotifications')}
            message={
              lang === 'te'
                ? 'మీ ఖాతాకు సంబంధించిన ముఖ్యమైన హెచ్చరికలు మరియు సమాచారం ఇక్కడ కనిపిస్తాయి.'
                : 'Priority pass alerts, crowd notices, and live festival updates will appear here.'
            }
            icon={
              <AppIcon
                name={{ ios: 'bell.slash', android: 'notifications_off', web: 'bell-slash' }}
                size={48}
                color={colors.textMuted}
              />
            }
          />
        ) : (
          notifications.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => handleNotificationPress(item)}
              style={({ pressed }) => [
                styles.notifCard,
                {
                  backgroundColor: item.read ? colors.card : isDark ? '#1E293B' : '#F0FDF4',
                  borderColor: item.read ? colors.border : colors.primary,
                },
                Shadows.card,
                pressed && { opacity: 0.88 },
              ]}
            >
              <View style={styles.notifRow}>
                <View
                  style={[
                    styles.notifIconCircle,
                    {
                      backgroundColor: item.read ? colors.secondary : colors.primaryLight,
                    },
                  ]}
                >
                  <AppIcon
                    name={{
                      ios: item.type === 'ALERT' ? 'exclamationmark.triangle.fill' : 'bell.fill',
                      android: item.type === 'ALERT' ? 'warning' : 'notifications',
                      web: item.type === 'ALERT' ? 'exclamation-triangle' : 'bell',
                    }}
                    size={16}
                    color={item.type === 'ALERT' ? '#DC2626' : colors.primary}
                  />
                </View>

                <View style={styles.notifTextCol}>
                  <View style={styles.notifTitleRow}>
                    <Text style={[styles.notifTitle, { color: colors.text }]}>
                      {item.title}
                    </Text>
                    {!item.read && <View style={[styles.dotUnread, { backgroundColor: colors.primary }]} />}
                  </View>

                  <Text style={[styles.notifMessage, { color: colors.textSecondary }]}>
                    {item.message}
                  </Text>

                  {item.createdAt && (
                    <Text style={[styles.notifTime, { color: colors.textMuted }]}>
                      {new Date(item.createdAt).toLocaleDateString(lang === 'te' ? 'te-IN' : 'en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                  )}
                </View>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBar: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  unreadBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  markAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  markAllText: {
    fontSize: 11,
    fontWeight: '700',
  },
  scrollContent: {
    padding: Spacing.four,
    gap: 12,
  },
  loaderBox: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 10,
  },
  loaderText: {
    fontSize: 13,
  },
  notifCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.three,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  notifIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTextCol: {
    flex: 1,
    gap: 4,
  },
  notifTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  dotUnread: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  notifMessage: {
    fontSize: 12,
    lineHeight: 17,
  },
  notifTime: {
    fontSize: 10,
    marginTop: 2,
  },
});

