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
import { Spacing, BottomTabInset } from '@/constants/theme';
import { getListings, getListingById } from '@/services/api';
import { ListingItem } from '@/types';
import { getFavorites, setItem, waitForStorageInit } from '@/lib/storage';
import { ListingCard } from '@/components/ui/ListingCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { AppIcon } from '@/components/ui/AppIcon';

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang, colors, isDark, t } = useApp();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [listings, setListings] = useState<ListingItem[]>([]);

  const loadFavorites = useCallback(async () => {
    try {
      await waitForStorageInit();
      const ids = getFavorites();
      setFavoriteIds(ids);

      if (ids.length === 0) {
        setListings([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Fetch all published listings
      const res = await getListings({ limit: 100 });
      const matched = res.data.filter((item) => ids.includes(item.id));

      // If any ID wasn't in list (e.g. newly created or specialized), attempt individual fetch
      const missingIds = ids.filter((id) => !matched.some((m) => m.id === id));
      if (missingIds.length > 0) {
        const extraPromises = missingIds.map((id) => getListingById(id));
        const extraResults = await Promise.all(extraPromises);
        extraResults.forEach((r) => {
          if (r.data) matched.push(r.data);
        });
      }

      // Order listings in the same order as saved favorite IDs
      matched.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
      setListings(matched);
    } catch {
      // Safe fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFavorites();
  }, [loadFavorites]);

  const handleClearAll = () => {
    setItem('godavari_one_favorites_v1', JSON.stringify([]));
    setFavoriteIds([]);
    setListings([]);
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/profile');
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
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
        <View style={styles.headerTopRow}>
          <Pressable
            onPress={handleBack}
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

          <View style={styles.headerTitleCol}>
            <View style={styles.titleWithBadge}>
              <Text style={[styles.screenTitle, { color: colors.text }]}>{t('favorites')}</Text>
              {listings.length > 0 && (
                <View style={[styles.countBadge, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.countText, { color: colors.primary }]}>
                    {listings.length}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
              {t('favoritesDesc')}
            </Text>
          </View>

          {listings.length > 0 && (
            <Pressable
              onPress={handleClearAll}
              accessibilityRole="button"
              accessibilityLabel="Clear all favorites"
              style={({ pressed }) => [
                styles.clearButton,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={[styles.clearButtonText, { color: colors.danger || '#DC2626' }]}>
                {t('clearFavorites')}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.contentScroll,
          { paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loaderText, { color: colors.textSecondary }]}>
              {t('loading')}
            </Text>
          </View>
        ) : listings.length === 0 ? (
          <EmptyState
            title={t('noFavoritesTitle')}
            message={t('noFavoritesMessage')}
            icon={
              <AppIcon
                name={{ ios: 'heart', android: 'favorite_border', web: 'heart' }}
                size={44}
                color={colors.textMuted}
              />
            }
            actionLabel={t('exploreDirectory')}
            onAction={() => router.push('/explore')}
          />
        ) : (
          listings.map((item) => (
            <ListingCard
              key={item.id}
              listing={item}
              onPress={() =>
                router.push({
                  pathname: '/listing/[id]',
                  params: { id: item.id },
                } as any)
              }
            />
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
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCol: {
    flex: 1,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
  },
  screenSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  clearButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  contentScroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  loaderContainer: {
    paddingVertical: 50,
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 13,
  },
});
