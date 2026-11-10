import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Platform,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useApp } from '@/context/app-context';
import { Spacing, BottomTabInset, Shadows } from '@/constants/theme';
import { CATEGORY_META, ListingCategory } from '@/constants/categories';
import { getListings } from '@/services/api';
import { ListingItem } from '@/types';

import { SearchBar } from '@/components/ui/SearchBar';
import { ListingCard } from '@/components/ui/ListingCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { AppIcon } from '@/components/ui/AppIcon';
import { ConnectionBanner } from '@/components/ui/ConnectionBanner';
import { useDebounce } from '@/hooks/use-debounce';
import {
  FilterSortModal,
  FilterState,
  INITIAL_FILTERS,
  countActiveFilters,
  AVAILABLE_TOWNS,
  SORT_OPTIONS,
} from '@/components/ui/FilterSortModal';

export default function CategoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { lang, toggleLang, colors, isDark, t } = useApp();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  // Normalize id to known category
  const rawId = Array.isArray(id) ? id[0] : id;
  const categoryId = (rawId || '').toUpperCase() as ListingCategory;
  const categoryMeta = CATEGORY_META[categoryId];

  // In-category filters state
  const [filters, setFilters] = useState<FilterState>({
    ...INITIAL_FILTERS,
    category: categoryId,
  });

  useEffect(() => {
    if (categoryId && CATEGORY_META[categoryId]) {
      setFilters((prev) => ({
        ...prev,
        category: categoryId,
      }));
    }
  }, [categoryId]);

  // Debounced search query
  const debouncedSearch = useDebounce(search, 300);

  const activeFilterCount = useMemo(() => {
    // Exclude fixed category from active count
    let count = 0;
    if (filters.town && filters.town !== 'ALL') count++;
    if (filters.verifiedOnly) count++;
    if (filters.accessibility) count++;
    if (filters.crowdStatus && filters.crowdStatus !== 'ALL') count++;
    if (filters.foodType && filters.foodType !== 'ALL') count++;
    if (filters.transportType && filters.transportType !== 'ALL') count++;
    if (filters.sortBy !== 'createdAt' || filters.sortOrder !== 'desc') count++;
    return count;
  }, [filters]);

  const categoryTitle = categoryMeta
    ? lang === 'te'
      ? categoryMeta.teLabel
      : categoryMeta.label
    : (rawId || 'Category');

  const categoryDesc = categoryMeta
    ? lang === 'te'
      ? categoryMeta.teDescription
      : categoryMeta.description
    : '';

  const { town, accessibility, crowdStatus, foodType, transportType, sortBy, sortOrder, verifiedOnly } = filters;

  const loadData = useCallback(async () => {
    if (!categoryId || !CATEGORY_META[categoryId]) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await getListings({
        category: categoryId,
        q: debouncedSearch.trim() || undefined,
        town: town || undefined,
        accessibility: accessibility ? true : undefined,
        crowdStatus: crowdStatus && crowdStatus !== 'ALL' ? crowdStatus : undefined,
        foodType: foodType && foodType !== 'ALL' ? foodType : undefined,
        transportType: transportType && transportType !== 'ALL' ? transportType : undefined,
        sortBy,
        sortOrder,
        verifiedOnly,
      });
      setListings(res.data);
      setIsLive(res.isLive);
      if (res.error && !res.isLive) {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load category listings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    categoryId,
    debouncedSearch,
    town,
    accessibility,
    crowdStatus,
    foodType,
    transportType,
    sortBy,
    sortOrder,
    verifiedOnly,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/explore');
    }
  }, [router]);

  // Handle Android hardware back: return to previous screen or explore
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const onBackPress = () => {
      handleBack();
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [handleBack]);

  // Safe fallback if invalid category param
  if (!categoryMeta) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
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
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
            hitSlop={8}
          >
            <AppIcon
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow-left' }}
              size={18}
              color={colors.text}
            />
            <Text style={[styles.backText, { color: colors.text }]}>
              {lang === 'te' ? 'వెనుకకు' : 'Back'}
            </Text>
          </Pressable>
        </View>

        <EmptyState
          title={lang === 'te' ? 'విభాగం కనుగొనబడలేదు' : 'Category Not Found'}
          message={
            lang === 'te'
              ? 'కోరిన విభాగం అందుబాటులో లేదు. దయచేసి ఎక్స్‌ప్లోర్ పేజీకి తిరిగి వెళ్లండి.'
              : 'The requested category does not exist. Please return to Explore.'
          }
          actionLabel={lang === 'te' ? 'ఎక్స్‌ప్లోర్‌కు వెళ్లండి' : 'Go to Explore'}
          onAction={() => router.replace('/explore')}
        />
      </View>
    );
  }

  const iconBg = isDark ? categoryMeta.darkBg : categoryMeta.lightBg;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top Header Bar with Back Button, Category Title, and Language Switch */}
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
        <View style={styles.topNavRow}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <AppIcon
              name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow-left' }}
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.backText, { color: colors.primary }]}>
              {lang === 'te' ? 'వెనుకకు' : 'Back'}
            </Text>
          </Pressable>

          <View style={styles.headerTitleCenter}>
            <Text style={[styles.headerTitleText, { color: colors.text }]} numberOfLines={1}>
              {categoryTitle}
            </Text>
          </View>

          {/* Language Toggle Pill */}
          <Pressable
            onPress={toggleLang}
            style={({ pressed }) => [
              styles.langPill,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.border,
              },
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={6}
          >
            <AppIcon
              name={{ ios: 'globe', android: 'language', web: 'globe' }}
              size={13}
              color={colors.primary}
            />
            <Text style={[styles.langPillText, { color: colors.primary }]}>
              {lang === 'en' ? 'తెలుగు' : 'English'}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
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
        {/* Category Hero Banner */}
        <View
          style={[
            styles.categoryHeroCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            Shadows.card,
          ]}
        >
          <View style={styles.heroHeaderRow}>
            <View style={[styles.categoryIconCircle, { backgroundColor: iconBg }]}>
              <AppIcon name={categoryMeta.symbol} size={28} color={categoryMeta.color} />
            </View>
            <View style={styles.heroTextCol}>
              <Text style={[styles.categoryHeroTitle, { color: colors.text }]}>
                {categoryTitle}
              </Text>
              <View style={[styles.countBadge, { backgroundColor: colors.secondary }]}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: listings.length > 0 ? colors.success : colors.textMuted },
                  ]}
                />
                <Text style={[styles.countBadgeText, { color: colors.primary }]}>
                  {loading
                    ? (lang === 'te' ? 'లోడ్ అవుతోంది...' : 'Loading listings...')
                    : listings.length === 1
                    ? (lang === 'te' ? '1 ధృవీకరించబడిన సేవ' : '1 Verified Service')
                    : (lang === 'te'
                        ? `${listings.length} ధృవీకరించబడిన సేవలు`
                        : `${listings.length} Verified Services`)}
                </Text>
              </View>
            </View>
          </View>

          {Boolean(categoryDesc) && (
            <Text style={[styles.categoryHeroDesc, { color: colors.textSecondary }]}>
              {categoryDesc}
            </Text>
          )}
        </View>

        {/* In-Category Search Bar with Filter Trigger */}
        <View style={styles.searchSection}>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder={
              lang === 'te'
                ? `${categoryTitle}లో శోధించండి...`
                : `Search in ${categoryTitle}...`
            }
            onFilterPress={() => setFilterModalVisible(true)}
            activeFilterCount={activeFilterCount}
          />
        </View>

        {/* Offline / Fallback Banner if backend connection failed */}
        {!isLive && (
          <View style={[styles.fallbackBanner, { backgroundColor: colors.secondary }]}>
            <AppIcon
              name={{ ios: 'wifi.slash', android: 'cloud_off', web: 'wifi-slash' }}
              size={14}
              color={colors.primary}
            />
            <Text style={[styles.fallbackBannerText, { color: colors.textSecondary }]}>
              {lang === 'te'
                ? 'స్థానిక ప్రామాణిక సమాచారం ప్రదర్శించబడుతోంది'
                : 'Displaying verified offline database snapshot'}
            </Text>
          </View>
        )}

        {/* Error State with Retry Button */}
        {error && listings.length === 0 && (
          <View
            style={[
              styles.errorCard,
              { backgroundColor: isDark ? '#3E1F24' : '#FEE2E2', borderColor: '#FCA5A5' },
            ]}
          >
            <AppIcon
              name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'exclamation-triangle' }}
              size={20}
              color="#DC2626"
            />
            <Text style={[styles.errorTitle, { color: isDark ? '#FECACA' : '#991B1B' }]}>
              {lang === 'te' ? 'లోడ్ చేయడంలో లోపం సంభవించింది' : 'Failed to Load Listings'}
            </Text>
            <Text style={[styles.errorMessage, { color: isDark ? '#FCA5A5' : '#B91C1C' }]}>
              {error}
            </Text>
            <Pressable
              onPress={loadData}
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              hitSlop={6}
            >
              <Text style={styles.retryButtonText}>{t('retry')}</Text>
            </Pressable>
          </View>
        )}

        {/* Listings Content / Loading / Empty */}
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loaderText, { color: colors.textSecondary }]}>
              {t('loading')}
            </Text>
          </View>
        ) : error && listings.length === 0 ? (
          <EmptyState
            title={lang === 'te' ? 'జాబితాలు లోడ్ కాలేదు' : 'Unable to Load Listings'}
            message={error}
            actionLabel={lang === 'te' ? 'మళ్లీ ప్రయత్నించండి' : 'Retry'}
            onAction={loadData}
          />
        ) : listings.length === 0 ? (
          <EmptyState
            title={
              search.trim()
                ? t('noResults')
                : (lang === 'te'
                    ? `${categoryTitle}లో ఇంకా జాబితాలు లేవు`
                    : `No ${categoryTitle} Available`)
            }
            message={
              search.trim()
                ? t('noResultsDesc')
                : (lang === 'te'
                    ? 'ఈ విభాగానికి కొత్త జాబితాలు త్వరలో జోడించబడతాయి. దయచేసి వేచి ఉండండి.'
                    : 'Listings for this category are being updated for Pushkaralu 2027.')
            }
            actionLabel={search.trim() ? (lang === 'te' ? 'శోధన తొలగించు' : 'Clear Search') : undefined}
            onAction={search.trim() ? () => setSearch('') : undefined}
          />
        ) : (
          <View style={styles.listingsList}>
            {listings.map((item) => (
              <ListingCard key={item.id} listing={item} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* In-Category Filter & Sort Modal */}
      <FilterSortModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={filters}
        onApply={(newFilters) => {
          setFilters({
            ...newFilters,
            category: categoryId,
          });
        }}
        onReset={() => {
          setFilters({
            ...INITIAL_FILTERS,
            category: categoryId,
          });
        }}
        hideCategoryFilter={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBar: {
    borderBottomWidth: 1,
    paddingBottom: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 72,
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitleCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  langPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  categoryHeroCard: {
    padding: Spacing.four,
    borderRadius: 16,
    borderWidth: 1,
    gap: Spacing.three,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  categoryIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextCol: {
    flex: 1,
    gap: 4,
  },
  categoryHeroTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  categoryHeroDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  searchSection: {
    marginBottom: Spacing.one,
  },
  fallbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 10,
  },
  fallbackBannerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  errorCard: {
    padding: Spacing.four,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.two,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  errorMessage: {
    fontSize: 13,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  loaderContainer: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  loaderText: {
    fontSize: 13,
  },
  listingsList: {
    gap: Spacing.two,
  },
});