import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useApp } from '@/context/app-context';
import { Spacing, BottomTabInset, Shadows } from '@/constants/theme';
import { CATEGORY_META, ListingCategory } from '@/constants/categories';
import { getHomepageData } from '@/services/api';
import { HomepageData, ListingItem } from '@/types';

import { ConnectionBanner } from '@/components/ui/ConnectionBanner';
import { AnnouncementBanner } from '@/components/ui/AnnouncementBanner';
import { HeroSection } from '@/components/ui/HeroSection';
import { SearchBar } from '@/components/ui/SearchBar';
import { HomeCarousel } from '@/components/ui/HomeCarousel';
import { CategoryCard } from '@/components/ui/CategoryCard';
import { ListingCard } from '@/components/ui/ListingCard';
import { GhatStatusCard } from '@/components/ui/GhatStatusCard';
import { EmergencyContactsCard } from '@/components/ui/EmergencyContactsCard';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { AppIcon } from '@/components/ui/AppIcon';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang, toggleLang, colors, isDark, t, setSearchQuery, setSelectedCategory } = useApp();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [homeInput, setHomeInput] = useState('');
  const [data, setData] = useState<HomepageData | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await getHomepageData();
      setData(res);
    } catch {
      // safe fallback already handled in getHomepageData
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleSearchSubmit = () => {
    if (homeInput.trim()) {
      setSearchQuery(homeInput.trim());
      router.push('/explore');
    }
  };

  const handleCategoryPress = (catId: ListingCategory) => {
    setSelectedCategory(catId);
    router.push({ pathname: '/category/[id]', params: { id: catId } } as any);
  };

  const handleListingPress = (listing: ListingItem) => {
    setSelectedCategory(listing.category);
    router.push({ pathname: '/listing/[id]', params: { id: listing.id } } as any);
  };

  const categories = Object.values(CATEGORY_META);

  // Extract free services from authentic listings
  const freeStayListing = data?.freeAccommodationListings?.[0];
  const annadanamListing = data?.annadanamListings?.[0];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top Header Bar with Brand and Language Switch */}
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
        <View style={styles.brandRow}>
          <View style={styles.brandTitleCol}>
            <View style={styles.brandNameWithIcon}>
              <View style={[styles.brandLogoCircle, { backgroundColor: colors.primary }]}>
                <AppIcon
                  name={{ ios: 'water.waves', android: 'water', web: 'waves' }}
                  size={16}
                  color="#FFFFFF"
                />
              </View>
              <Text style={[styles.brandName, { color: colors.text }]}>Godavari One</Text>
            </View>
            <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>
              {lang === 'te' ? 'గోదావరి పుష్కరాలు 2027 డిజిటల్ వేదిక' : 'Pushkaralu 2027 · Digital Platform'}
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
        {/* Connection State Banner (Live vs Authentic Offline Snapshot) */}
        <ConnectionBanner
          isLive={Boolean(data?.isLive)}
          apiUrl={data?.apiUrl}
          connectionError={data?.connectionError}
          onRetry={loadData}
        />

        {/* 1. Official Announcement Banner */}
        {data?.announcements?.[0] && (
          <AnnouncementBanner
            announcement={data.announcements[0]}
            onPressAction={() => router.push('/ghats')}
          />
        )}

        {/* 2. Hero Section with Authentic Godavari Devi Statue & 6 Quick Category Pills */}
        <HeroSection
          title={data?.heroSettings?.heroTitle}
          subtitle={data?.heroSettings?.heroSubtitle}
          tagline={data?.heroSettings?.tagline}
          showStatue={data?.heroSettings?.showStatue ?? true}
          onSelectCategory={handleCategoryPress}
        />

        {/* 3. Search Bar */}
        <SearchBar
          value={homeInput}
          onChangeText={setHomeInput}
          onSubmit={handleSearchSubmit}
        />

        {/* 4. Sliding Carousel (Featured Highlights from Website /carousel) */}
        {data?.carouselBanners && data.carouselBanners.length > 0 && (
          <HomeCarousel
            banners={data.carouselBanners}
            onPressBanner={(b) => {
              if (b.destinationUrl?.includes('GHAT')) {
                router.push('/ghats');
              } else {
                router.push('/explore');
              }
            }}
          />
        )}

        {/* 5. Directory Categories (All 9 Categories Grid) */}
        <View style={styles.sectionWrapper}>
          <SectionHeading
            title={t('categories')}
            subtitle={lang === 'te' ? 'అన్ని పుష్కర సేవలు' : 'Explore all pushkara pilgrimage services'}
            actionLabel={t('viewAll')}
            onAction={() => router.push('/explore')}
          />

          <View style={styles.categoryGrid}>
            {categories.map((cat) => (
              <CategoryCard
                key={cat.id}
                category={cat}
                onPress={() => handleCategoryPress(cat.id)}
              />
            ))}
          </View>
        </View>

        {/* 6. Free Accommodation & Annadanam Seva Container */}
        {(freeStayListing || annadanamListing) && (
          <View
            style={[
              styles.freeServicesBox,
              {
                backgroundColor: isDark ? '#1C272C' : '#FFF7ED',
                borderColor: isDark ? '#3D3220' : '#FFEDD5',
              },
            ]}
          >
            <View style={styles.freeServicesHeader}>
              <View style={[styles.heartBadge, { backgroundColor: '#E11D48' }]}>
                <AppIcon
                  name={{ ios: 'heart.fill', android: 'favorite', web: 'heart' }}
                  size={14}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.freeHeaderCol}>
                <Text style={[styles.freeTitle, { color: isDark ? '#FECDD3' : '#9F1239' }]}>
                  {lang === 'te'
                    ? 'ఉచిత వసతి & అన్నదాన సేవ'
                    : 'Free Accommodation & Annadanam Seva'}
                </Text>
                <Text style={[styles.freeSubtitle, { color: colors.textSecondary }]}>
                  {lang === 'te'
                    ? 'ధృవీకరించబడిన ఉచిత యాత్రికుల వసతి మరియు రోజువారీ అన్నదాన కేంద్రాలు'
                    : 'Verified free pilgrim shelters, dormitories, and daily Annadanam centres for Pushkaralu 2027.'}
                </Text>
              </View>
            </View>

            {/* Quick Action Pill Buttons */}
            <View style={styles.freeActionsRow}>
              <Pressable
                onPress={() => handleCategoryPress('FREE_ACCOMMODATION')}
                style={({ pressed }) => [
                  styles.freeActionBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text style={[styles.freeActionText, { color: colors.primary }]}>
                  {lang === 'te' ? 'ఉచిత వసతి' : 'Free Stays'} →
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleCategoryPress('ANNADANAM')}
                style={({ pressed }) => [
                  styles.freeActionBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text style={[styles.freeActionText, { color: colors.primary }]}>
                  {lang === 'te' ? 'అన్నదానం' : 'Annadanam'} →
                </Text>
              </Pressable>
            </View>

            {/* Verified Free Listings Cards */}
            <View style={styles.freeCardsList}>
              {freeStayListing && (
                <Pressable
                  onPress={() => handleListingPress(freeStayListing)}
                  style={({ pressed }) => [
                    styles.freeMiniCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    Shadows.card,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <View style={styles.freeMiniTop}>
                    <View style={[styles.freeTag, { backgroundColor: '#E0E7FF' }]}>
                      <Text style={[styles.freeTagText, { color: '#3730A3' }]}>
                        {freeStayListing.freeAccommodation?.availableCapacity || 150} {lang === 'te' ? 'యాత్రికులకు వసతి' : 'available'}
                      </Text>
                    </View>
                    <Text style={[styles.freeTagBadge, { color: '#059669' }]}>
                      ✓ {lang === 'te' ? 'ధృవీకరించబడింది' : 'Verified'}
                    </Text>
                  </View>
                  <Text style={[styles.freeMiniName, { color: colors.text }]} numberOfLines={1}>
                    {freeStayListing.name}
                  </Text>
                  <Text style={[styles.freeMiniDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                    {freeStayListing.description}
                  </Text>
                  <Text style={[styles.freeMiniLocation, { color: colors.primary }]}>
                    📍 {freeStayListing.address}
                  </Text>
                </Pressable>
              )}

              {annadanamListing && (
                <Pressable
                  onPress={() => handleListingPress(annadanamListing)}
                  style={({ pressed }) => [
                    styles.freeMiniCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    Shadows.card,
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <View style={styles.freeMiniTop}>
                    <View style={[styles.freeTag, { backgroundColor: '#D1FAE5' }]}>
                      <Text style={[styles.freeTagText, { color: '#065F46' }]}>
                        ● {lang === 'te' ? 'ఉచిత భోజనం & మహాప్రసాదం' : 'Free Meals & Prasadam'}
                      </Text>
                    </View>
                    <Text style={[styles.freeTagBadge, { color: '#D97706' }]}>
                      {lang === 'te' ? 'నిరంతర సేవ' : 'Daily Seva'}
                    </Text>
                  </View>
                  <Text style={[styles.freeMiniName, { color: colors.text }]} numberOfLines={1}>
                    {annadanamListing.name}
                  </Text>
                  <Text style={[styles.freeMiniDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                    {annadanamListing.description}
                  </Text>
                  <Text style={[styles.freeMiniLocation, { color: colors.primary }]}>
                    📍 {annadanamListing.address}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* 7. Ghat Crowd Status Preview */}
        <View style={styles.sectionWrapper}>
          <SectionHeading
            title={t('ghatCrowdStatus')}
            subtitle={lang === 'te' ? 'ప్రత్యక్ష భక్తుల రద్దీ సమాచారం' : 'Live crowd status updates along Godavari ghats'}
            actionLabel={t('viewAll')}
            onAction={() => router.push('/ghats')}
          />

          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} />
          ) : (
            data?.ghats?.slice(0, 3).map((ghat) => (
              <GhatStatusCard
                key={ghat.id}
                ghat={ghat}
                onPress={() => router.push('/ghats')}
              />
            ))
          )}
        </View>

        {/* 8. Emergency Contacts (Police, Medical, Fire, Helplines) */}
        <View style={styles.sectionWrapper}>
          <EmergencyContactsCard limit={6} />
        </View>

        {/* 9. Featured Published Listings from Database */}
        <View style={styles.sectionWrapper}>
          <SectionHeading
            title={t('featured')}
            subtitle={lang === 'te' ? 'ప్రచురించబడిన పుష్కర సేవలు మరియు వివరాలు' : 'Verified published pushkara listings and services'}
            actionLabel={t('viewAll')}
            onAction={() => router.push('/explore')}
          />

          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 16 }} />
          ) : (
            <View style={styles.listingsGrid}>
              {data?.featuredListings?.slice(0, 6).map((listing) => (
                <View key={listing.id} style={styles.listingGridItem}>
                  <ListingCard
                    listing={listing}
                    onPress={() => handleListingPress(listing)}
                  />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 10. Accessibility Information Card */}
        <View
          style={[
            styles.accessibilityCard,
            {
              backgroundColor: isDark ? '#152C28' : '#ECFDF5',
              borderColor: isDark ? '#234C44' : '#A7F3D0',
            },
          ]}
        >
          <View style={styles.accessHeader}>
            <View style={[styles.accessIconCircle, { backgroundColor: '#059669' }]}>
              <AppIcon
                name={{ ios: 'figure.roll', android: 'accessible', web: 'wheelchair' }}
                size={16}
                color="#FFFFFF"
              />
            </View>
            <View style={styles.accessTextCol}>
              <Text style={[styles.accessTitle, { color: isDark ? '#A7F3D0' : '#065F46' }]}>
                {t('accessibility')}
              </Text>
              <Text style={[styles.accessDesc, { color: colors.textSecondary }]}>
                {lang === 'te'
                  ? 'వీల్‌చైర్ యాక్సెస్, వృద్ధుల సహాయం, ప్రాథమిక చికిత్స, మరియు అత్యవసర సహాయ కేంద్రాల సమాచారం.'
                  : 'Find wheelchair-accessible ghat routes, senior-citizen assistance, first-aid, drinking water, and emergency help points with verified details.'}
              </Text>
            </View>
          </View>

          <View style={styles.accessPillsRow}>
            <View style={[styles.accessPill, { backgroundColor: colors.card }]}>
              <Text style={[styles.accessPillText, { color: colors.text }]}>
                ♿ {lang === 'te' ? 'వీల్‌చైర్ రాంప్‌లు' : 'Wheelchair Ramps'}
              </Text>
            </View>
            <View style={[styles.accessPill, { backgroundColor: colors.card }]}>
              <Text style={[styles.accessPillText, { color: colors.text }]}>
                👴 {lang === 'te' ? 'వృద్ధుల ప్రాధాన్యత' : 'Senior Priority'}
              </Text>
            </View>
            <View style={[styles.accessPill, { backgroundColor: colors.card }]}>
              <Text style={[styles.accessPillText, { color: colors.text }]}>
                🩹 {lang === 'te' ? '24/7 మెడికల్ క్యాంపులు' : '24/7 First Aid'}
              </Text>
            </View>
          </View>
        </View>

        {/* 11. Pushkaralu Information Card */}
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: isDark ? '#16282E' : '#F0F9FF',
              borderColor: isDark ? '#284650' : '#BAE6FD',
            },
          ]}
        >
          <View style={styles.infoHeader}>
            <View style={[styles.infoIconCircle, { backgroundColor: colors.primary }]}>
              <AppIcon
                name={{ ios: 'info.circle.fill', android: 'info', web: 'info' }}
                size={16}
                color="#FFFFFF"
              />
            </View>
            <View style={styles.infoTextCol}>
              <Text style={[styles.infoTitle, { color: colors.text }]}>
                {lang === 'te' ? 'గోదావరి పుష్కరాలు 2027 సమాచారం' : 'About Godavari Pushkaralu 2027'}
              </Text>
              <Text style={[styles.infoDesc, { color: colors.textSecondary }]}>
                {lang === 'te'
                  ? 'గోదావరి పుష్కరాలు ప్రతి 12 సంవత్సరాలకు ఒకసారి జరిగే పవిత్ర నదీ ఉత్సవం. రాజమండ్రి, కొవ్వూరు మరియు పరిసర ప్రాంతాలలో లక్షలాది మంది భక్తులు పవిత్ర స్నానాలు ఆచరిస్తారు.'
                  : 'Godavari Pushkaralu is a sacred river festival occurring once every 12 years. Millions of pilgrims take holy dips along Rajahmundry, Kovvur, and riverbank ghats.'}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => router.push('/explore')}
            style={({ pressed }) => [
              styles.infoActionBtn,
              pressed && { opacity: 0.75 },
            ]}
          >
            <Text style={[styles.infoActionText, { color: colors.primary }]}>
              {lang === 'te' ? 'డైరెక్టరీ బ్రౌజ్ చేయండి' : 'Browse Directory'} →
            </Text>
          </Pressable>
        </View>
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandTitleCol: {
    gap: 2,
  },
  brandNameWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogoCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },
  langPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  scrollContent: {
    padding: Spacing.four,
  },
  sectionWrapper: {
    marginBottom: Spacing.four,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  listingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  listingGridItem: {
    flex: 1,
    minWidth: 300,
  },
  freeServicesBox: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.four,
    marginBottom: Spacing.four,
    gap: Spacing.three,
  },
  freeServicesHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two + 2,
  },
  heartBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  freeHeaderCol: {
    flex: 1,
    gap: 2,
  },
  freeTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  freeSubtitle: {
    fontSize: 11,
    lineHeight: 16,
  },
  freeActionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  freeActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  freeActionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  freeCardsList: {
    gap: Spacing.two + 2,
  },
  freeMiniCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 5,
  },
  freeMiniTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  freeTag: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  freeTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  freeTagBadge: {
    fontSize: 10,
    fontWeight: '700',
  },
  freeMiniName: {
    fontSize: 13,
    fontWeight: '700',
  },
  freeMiniDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  freeMiniLocation: {
    fontSize: 11,
    fontWeight: '600',
  },
  accessibilityCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.four,
    marginBottom: Spacing.four,
    gap: Spacing.three,
  },
  accessHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two + 2,
  },
  accessIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  accessTextCol: {
    flex: 1,
    gap: 3,
  },
  accessTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  accessDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  accessPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  accessPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  accessPillText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  infoCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.four,
    marginBottom: Spacing.four,
    gap: Spacing.three,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two + 2,
  },
  infoIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  infoTextCol: {
    flex: 1,
    gap: 3,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  infoDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  infoActionBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  infoActionText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
});
