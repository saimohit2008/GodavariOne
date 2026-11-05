import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useApp } from '@/context/app-context';
import { Spacing, BottomTabInset, Shadows } from '@/constants/theme';
import { CATEGORY_META, ListingCategory } from '@/constants/categories';
import { getListings, GetListingsParams } from '@/services/api';
import { ListingItem } from '@/types';
import { useDebounce } from '@/hooks/use-debounce';
import { getRecentSearches, addRecentSearch, clearRecentSearches } from '@/lib/storage';

import { SearchBar } from '@/components/ui/SearchBar';
import { CategoryCard } from '@/components/ui/CategoryCard';
import { FeaturedListingCard } from '@/components/ui/FeaturedListingCard';
import { GhatStatusCard } from '@/components/ui/GhatStatusCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { AppIcon } from '@/components/ui/AppIcon';
import {
  FilterSortModal,
  FilterState,
  INITIAL_FILTERS,
  countActiveFilters,
  AVAILABLE_TOWNS,
  SORT_OPTIONS,
} from '@/components/ui/FilterSortModal';

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    lang,
    colors,
    isDark,
    t,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
  } = useApp();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<ListingItem[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Advanced Filter & Sort State
  const [filters, setFilters] = useState<FilterState>({
    ...INITIAL_FILTERS,
    category: selectedCategory,
  });

  // Debounced search query (300ms)
  const debouncedQuery = useDebounce(searchQuery, 300);

  // Sync selectedCategory from global context if changed externally
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      category: selectedCategory,
    }));
  }, [selectedCategory]);

  // Load client-side recent searches safely on mount
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // Save to recent searches when user enters a meaningful query
  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      const updated = addRecentSearch(debouncedQuery);
      setRecentSearches(updated);
    }
  }, [debouncedQuery]);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  const { category, town, accessibility, crowdStatus, foodType, transportType, sortBy, sortOrder, verifiedOnly } = filters;

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const apiParams: GetListingsParams = {
        category: category || undefined,
        q: debouncedQuery.trim() || undefined,
        town: town || undefined,
        accessibility: accessibility ? true : undefined,
        crowdStatus: crowdStatus && crowdStatus !== 'ALL' ? crowdStatus : undefined,
        foodType: foodType && foodType !== 'ALL' ? foodType : undefined,
        transportType: transportType && transportType !== 'ALL' ? transportType : undefined,
        sortBy,
        sortOrder,
        verifiedOnly,
      };

      const res = await getListings(apiParams);
      setItems(res.data);
      setIsLive(res.isLive);
    } catch {
      // safe fallback in api client
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [
    category,
    town,
    accessibility,
    crowdStatus,
    foodType,
    transportType,
    sortBy,
    sortOrder,
    verifiedOnly,
    debouncedQuery,
  ]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadListings();
  }, [loadListings]);

  const categories = useMemo(() => Object.values(CATEGORY_META), []);

  const activeCategoryMeta = filters.category
    ? CATEGORY_META[filters.category as ListingCategory]
    : null;

  const handleClearHistory = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  const handleResetAllFilters = () => {
    setFilters(INITIAL_FILTERS);
    setSelectedCategory(null);
    setSearchQuery('');
  };

  const handleRemoveCategory = () => {
    setFilters((prev) => ({ ...prev, category: null }));
    setSelectedCategory(null);
  };

  const handleRemoveTown = () => {
    setFilters((prev) => ({ ...prev, town: null }));
  };

  const handleRemoveVerified = () => {
    setFilters((prev) => ({ ...prev, verifiedOnly: false }));
  };

  const handleRemoveAccessibility = () => {
    setFilters((prev) => ({ ...prev, accessibility: false }));
  };

  const handleRemoveSort = () => {
    setFilters((prev) => ({ ...prev, sortBy: 'createdAt', sortOrder: 'desc' }));
  };

  const activeTownLabel = useMemo(() => {
    if (!filters.town) return null;
    const found = AVAILABLE_TOWNS.find((t) => t.id === filters.town);
    return found ? (lang === 'te' ? found.teLabel : found.label) : filters.town;
  }, [filters.town, lang]);

  const activeSortLabel = useMemo(() => {
    if (filters.sortBy === 'createdAt' && filters.sortOrder === 'desc') return null;
    const found = SORT_OPTIONS.find(
      (s) => s.sortBy === filters.sortBy && s.sortOrder === filters.sortOrder
    );
    return found ? (lang === 'te' ? found.teLabel : found.label) : null;
  }, [filters.sortBy, filters.sortOrder, lang]);

  const isBrowsingAll =
    !debouncedQuery &&
    !filters.category &&
    !filters.town &&
    !filters.verifiedOnly &&
    !filters.accessibility &&
    !filters.foodType &&
    !filters.crowdStatus &&
    filters.sortBy === 'createdAt';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top Header */}
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
        <View style={styles.titleRow}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>{t('explore')}</Text>
          <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
            {lang === 'te'
              ? 'అన్ని వర్గాల ధృవీకరించబడిన సేవా డైరెక్టరీ'
              : 'Verified Pushkaralu Directory & Services'}
          </Text>
        </View>

        {/* Search Bar with Filter Modal Trigger */}
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('searchPlaceholder')}
          onFilterPress={() => setFilterModalVisible(true)}
          activeFilterCount={activeFilterCount}
        />

        {/* Category Horizontal Filter Carousel */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {/* 'All Categories' Chip */}
          <Pressable
            onPress={() => {
              setFilters((prev) => ({ ...prev, category: null }));
              setSelectedCategory(null);
            }}
            style={({ pressed }) => [
              styles.allChip,
              {
                backgroundColor: !filters.category ? colors.primary : colors.card,
                borderColor: !filters.category ? colors.primary : colors.border,
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <AppIcon
              name={{ ios: 'square.grid.2x2.fill', android: 'grid_view', web: 'th-large' }}
              size={13}
              color={!filters.category ? '#FFFFFF' : colors.textSecondary}
            />
            <Text
              style={[
                styles.allChipText,
                { color: !filters.category ? '#FFFFFF' : colors.text },
              ]}
            >
              {t('allCategories')}
            </Text>
          </Pressable>

          {/* 9 Existing Categories */}
          {categories.map((cat) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              isSelected={filters.category === cat.id}
              variant="chip"
              onPress={() => {
                setFilters((prev) => ({
                  ...prev,
                  category: prev.category === cat.id ? null : cat.id,
                }));
                setSelectedCategory(filters.category === cat.id ? null : cat.id);
              }}
            />
          ))}
        </ScrollView>
      </View>

      {/* Main Listing Content */}
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
        {/* Active Filter Tags Row */}
        {activeFilterCount > 0 && (
          <View style={styles.activeFiltersSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFiltersRow}>
              <View style={[styles.filterCountIndicator, { backgroundColor: colors.secondary }]}>
                <AppIcon
                  name={{ ios: 'line.3.horizontal.decrease.circle', android: 'filter_list', web: 'filter' }}
                  size={12}
                  color={colors.primary}
                />
                <Text style={[styles.filterCountIndicatorText, { color: colors.primary }]}>
                  {activeFilterCount}
                </Text>
              </View>

              {/* Category Tag */}
              {activeCategoryMeta && (
                <Pressable
                  onPress={handleRemoveCategory}
                  style={[styles.activeFilterPill, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Text style={[styles.activeFilterPillText, { color: colors.text }]}>
                    {lang === 'te' ? activeCategoryMeta.teLabel : activeCategoryMeta.label}
                  </Text>
                  <Text style={[styles.removeX, { color: colors.textMuted }]}>✕</Text>
                </Pressable>
              )}

              {/* Town Tag */}
              {activeTownLabel && (
                <Pressable
                  onPress={handleRemoveTown}
                  style={[styles.activeFilterPill, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Text style={[styles.activeFilterPillText, { color: colors.text }]}>
                    📍 {activeTownLabel}
                  </Text>
                  <Text style={[styles.removeX, { color: colors.textMuted }]}>✕</Text>
                </Pressable>
              )}

              {/* Verified Tag */}
              {filters.verifiedOnly && (
                <Pressable
                  onPress={handleRemoveVerified}
                  style={[styles.activeFilterPill, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Text style={[styles.activeFilterPillText, { color: colors.text }]}>
                    ✓ {t('verifiedOnly')}
                  </Text>
                  <Text style={[styles.removeX, { color: colors.textMuted }]}>✕</Text>
                </Pressable>
              )}

              {/* Accessibility Tag */}
              {filters.accessibility && (
                <Pressable
                  onPress={handleRemoveAccessibility}
                  style={[styles.activeFilterPill, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Text style={[styles.activeFilterPillText, { color: colors.text }]}>
                    ♿ {t('wheelchairAccess')}
                  </Text>
                  <Text style={[styles.removeX, { color: colors.textMuted }]}>✕</Text>
                </Pressable>
              )}

              {/* Sort Tag */}
              {activeSortLabel && (
                <Pressable
                  onPress={handleRemoveSort}
                  style={[styles.activeFilterPill, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Text style={[styles.activeFilterPillText, { color: colors.text }]}>
                    ↕ {activeSortLabel}
                  </Text>
                  <Text style={[styles.removeX, { color: colors.textMuted }]}>✕</Text>
                </Pressable>
              )}

              {/* Reset All Pill */}
              <Pressable
                onPress={handleResetAllFilters}
                style={[styles.activeFilterPill, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              >
                <Text style={[styles.activeFilterPillText, { color: colors.primary, fontWeight: '700' }]}>
                  {t('clearAll')}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        )}

        {/* Recent Search Queries (When searching or query empty) */}
        {!debouncedQuery && recentSearches.length > 0 && isBrowsingAll && (
          <View style={[styles.recentSearchCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.card]}>
            <View style={styles.recentHeaderRow}>
              <View style={styles.recentHeaderLeft}>
                <AppIcon
                  name={{ ios: 'clock.arrow.circlepath', android: 'history', web: 'history' }}
                  size={14}
                  color={colors.primary}
                />
                <Text style={[styles.recentTitle, { color: colors.text }]}>
                  {t('recentSearches')}
                </Text>
              </View>
              <Pressable onPress={handleClearHistory} hitSlop={6}>
                <Text style={[styles.clearHistoryText, { color: colors.textMuted }]}>
                  {t('clearHistory')}
                </Text>
              </Pressable>
            </View>

            <View style={styles.recentPillsRow}>
              {recentSearches.map((term) => (
                <Pressable
                  key={term}
                  onPress={() => setSearchQuery(term)}
                  style={({ pressed }) => [
                    styles.recentPill,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.recentPillText, { color: colors.text }]}>{term}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Full 9-Category Grid when not searching or filtering */}
        {isBrowsingAll && (
          <View style={styles.categoriesSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>
                {lang === 'te' ? 'విభాగాల వారీగా అన్వేషించండి' : 'Browse by Category'}
              </Text>
              <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
                {lang === 'te' ? '9 ముఖ్య పుష్కర సేవలు' : '9 Pushkara services'}
              </Text>
            </View>
            <View style={styles.categoriesGrid}>
              {categories.map((cat) => (
                <CategoryCard
                  key={cat.id}
                  category={cat}
                  variant="grid"
                  onPress={() => {
                    setFilters((prev) => ({ ...prev, category: cat.id }));
                    setSelectedCategory(cat.id);
                    router.push({ pathname: '/category/[id]', params: { id: cat.id } } as any);
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {/* Active Filter & Results Info Header */}
        <View style={styles.resultsInfoRow}>
          <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
            {activeCategoryMeta
              ? `${lang === 'te' ? activeCategoryMeta.teLabel : activeCategoryMeta.label} (${items.length})`
              : `${lang === 'te' ? 'అన్ని జాబితాలు' : 'All Directory Listings'} (${items.length})`}
            {activeTownLabel ? ` · ${activeTownLabel}` : ''}
          </Text>

          {activeFilterCount > 0 && (
            <Pressable
              onPress={handleResetAllFilters}
              style={({ pressed }) => [styles.clearChip, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.clearChipText, { color: colors.primary }]}>
                {lang === 'te' ? 'రీసెట్ చేయండి ✕' : 'Reset all ✕'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Offline Snapshot Notice if live backend connection failed */}
        {!isLive && (
          <View style={[styles.sampleDataBanner, { backgroundColor: colors.secondary }]}>
            <AppIcon
              name={{ ios: 'wifi.slash', android: 'cloud_off', web: 'wifi-slash' }}
              size={13}
              color={colors.primary}
            />
            <Text style={[styles.sampleDataText, { color: colors.textSecondary }]}>
              {lang === 'te'
                ? 'స్థానిక డేటాబేస్ సమాచారం ప్రదర్శించబడుతోంది'
                : 'Displaying verified offline database snapshot'}
            </Text>
          </View>
        )}

        {/* Content list or Loading or Empty State */}
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loaderText, { color: colors.textSecondary }]}>
              {t('loading')}
            </Text>
          </View>
        ) : items.length === 0 ? (
          <EmptyState
            title={t('noResults')}
            message={t('noResultsDesc')}
            actionLabel={t('resetFilters')}
            onAction={handleResetAllFilters}
          />
        ) : (
          <View style={styles.listingsGrid}>
            {items.map((listing) =>
              listing.category === 'GHAT' ? (
                <GhatStatusCard
                  key={listing.id}
                  ghat={listing}
                  onPress={() =>
                    router.push({ pathname: '/listing/[id]', params: { id: listing.id } } as any)
                  }
                />
              ) : (
                <FeaturedListingCard
                  key={listing.id}
                  listing={listing}
                  onPress={() =>
                    router.push({
                      pathname: '/listing/[id]',
                      params: { id: listing.id },
                    } as any)
                  }
                />
              )
            )}
          </View>
        )}
      </ScrollView>

      {/* Filter & Sort Bottom Sheet Modal */}
      <FilterSortModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={filters}
        onApply={(newFilters) => {
          setFilters(newFilters);
          setSelectedCategory(newFilters.category);
        }}
        onReset={handleResetAllFilters}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBar: {
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderBottomWidth: 1,
  },
  titleRow: {
    marginBottom: Spacing.two,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  chipsScroll: {
    paddingVertical: Spacing.one,
    gap: 8,
    alignItems: 'center',
  },
  allChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  allChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  contentScroll: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  activeFiltersSection: {
    marginBottom: -Spacing.two,
  },
  activeFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  filterCountIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
  },
  filterCountIndicatorText: {
    fontSize: 11,
    fontWeight: '800',
  },
  activeFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
  },
  activeFilterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  removeX: {
    fontSize: 11,
    fontWeight: '800',
  },
  recentSearchCard: {
    padding: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
    gap: Spacing.two,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clearHistoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  recentPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  recentPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  recentPillText: {
    fontSize: 12,
    fontWeight: '500',
  },
  categoriesSection: {
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSub: {
    fontSize: 12,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    justifyContent: 'space-between',
  },
  resultsInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
    minHeight: 28,
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  clearChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  clearChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sampleDataBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 10,
  },
  sampleDataText: {
    fontSize: 12,
    fontWeight: '500',
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
  listingsGrid: {
    gap: Spacing.three,
  },
});
