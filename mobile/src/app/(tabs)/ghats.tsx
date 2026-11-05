import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useApp } from '@/context/app-context';
import { Spacing, BottomTabInset, Shadows } from '@/constants/theme';
import { CrowdStatus, CROWD_META } from '@/constants/categories';
import { getGhats } from '@/services/api';
import { ListingItem } from '@/types';

import { GhatStatusCard } from '@/components/ui/GhatStatusCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { AppIcon } from '@/components/ui/AppIcon';

export default function GhatsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang, colors, isDark, t } = useApp();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allGhats, setAllGhats] = useState<ListingItem[]>([]);
  const [isMock, setIsMock] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [townFilter, setTownFilter] = useState<string>('ALL');

  const loadGhats = useCallback(async () => {
    try {
      const res = await getGhats();
      setAllGhats(res.data);
      setIsMock(!res.isLive);
    } catch {
      // safe fallback in api client
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadGhats();
  }, [loadGhats]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadGhats();
  }, [loadGhats]);

  const crowdStatuses: CrowdStatus[] = useMemo(
    () => ['FREE', 'MODERATE', 'CROWDED', 'CLOSED', 'OVERCROWDED'],
    []
  );

  const towns = useMemo(() => ['ALL', 'Rajahmundry', 'Kovvur'], []);

  // Filtered ghats computed locally from authentic data
  const filteredGhats = useMemo(() => {
    return allGhats.filter((item) => {
      const details = (item as any).ghatDetails || item.ghat || {};
      const crowd = details.currentCrowdStatus || item.ghat?.currentCrowdStatus;

      // Status filter
      if (statusFilter && crowd !== statusFilter) {
        return false;
      }

      // Town filter
      if (townFilter !== 'ALL') {
        const itemTown = (item.town || '').toLowerCase();
        const itemAddr = (item.address || '').toLowerCase();
        const targetTown = townFilter.toLowerCase();
        if (!itemTown.includes(targetTown) && !itemAddr.includes(targetTown)) {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = item.name.toLowerCase().includes(q);
        const matchLoc = (item.locality || '').toLowerCase().includes(q);
        const matchTown = (item.town || '').toLowerCase().includes(q);
        const matchDesc = (item.description || '').toLowerCase().includes(q);
        if (!matchName && !matchLoc && !matchTown && !matchDesc) {
          return false;
        }
      }

      return true;
    });
  }, [allGhats, statusFilter, townFilter, searchQuery]);

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
          <View style={styles.titleWithIcon}>
            <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
              <AppIcon
                name={{ ios: 'water.waves', android: 'water', web: 'waves' }}
                size={18}
                color={colors.primary}
              />
            </View>
            <View>
              <Text style={[styles.screenTitle, { color: colors.text }]}>
                {t('ghatDirectory')}
              </Text>
              <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
                {t('ghatDirectoryDesc')}
              </Text>
            </View>
          </View>
        </View>

        {/* Search Bar Input */}
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: colors.secondary,
              borderColor: colors.border,
            },
          ]}
        >
          <AppIcon
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={16}
            color={colors.textSecondary}
          />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={
              lang === 'te'
                ? 'ఘాట్ పేరు లేదా ప్రదేశం శోధించండి...'
                : 'Search pushkar ghats by name or area...'
            }
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => setSearchQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              style={styles.clearSearchBtn}
            >
              <AppIcon
                name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'times-circle' }}
                size={16}
                color={colors.textMuted}
              />
            </Pressable>
          )}
        </View>

        {/* Town & Crowd Filter Chips Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {/* Towns */}
          {towns.map((town) => {
            const isSelected = townFilter === town;
            const label =
              town === 'ALL'
                ? lang === 'te'
                  ? 'అన్ని నగరాలు'
                  : 'All Towns'
                : town === 'Rajahmundry'
                  ? lang === 'te'
                    ? 'రాజమండ్రి'
                    : 'Rajahmundry'
                  : lang === 'te'
                    ? 'కొవ్వూరు'
                    : 'Kovvur';
            return (
              <Pressable
                key={town}
                onPress={() => setTownFilter(town)}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: isSelected ? '#FFFFFF' : colors.text },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}

          <View style={[styles.filterDivider, { backgroundColor: colors.border }]} />

          {/* All Ghats Crowd */}
          <Pressable
            onPress={() => setStatusFilter(null)}
            style={({ pressed }) => [
              styles.filterChip,
              {
                backgroundColor: !statusFilter ? colors.primary : colors.card,
                borderColor: !statusFilter ? colors.primary : colors.border,
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: !statusFilter ? '#FFFFFF' : colors.text },
              ]}
            >
              {t('allStatuses')}
            </Text>
          </Pressable>

          {/* Individual Crowd Statuses */}
          {crowdStatuses.map((st) => {
            const meta = CROWD_META[st];
            const isSelected = statusFilter === st;
            return (
              <Pressable
                key={st}
                onPress={() => setStatusFilter(isSelected ? null : st)}
                style={({ pressed }) => [
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? meta.bgColor : colors.card,
                    borderColor: isSelected ? meta.dotColor : colors.border,
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <View style={[styles.chipDot, { backgroundColor: meta.dotColor }]} />
                <Text
                  style={[
                    styles.filterChipText,
                    { color: isSelected ? meta.color : colors.text },
                  ]}
                >
                  {lang === 'te' ? meta.teLabel : meta.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
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
        {/* Offline Stale Crowd Data Warning Banner */}
        {isMock && (
          <View
            style={[
              styles.offlineAlertCard,
              {
                backgroundColor: isDark ? '#3D2418' : '#FEF3C7',
                borderColor: isDark ? '#78350F' : '#F59E0B',
              },
            ]}
          >
            <View style={styles.offlineAlertHeader}>
              <AppIcon
                name={{ ios: 'wifi.slash', android: 'cloud_off', web: 'wifi-off' }}
                size={16}
                color="#D97706"
              />
              <Text style={[styles.offlineAlertTitle, { color: isDark ? '#FDE68A' : '#92400E' }]}>
                {lang === 'te'
                  ? 'ఆఫ్‌లైన్ మోడ్ — రద్దీ సమాచారం తాజాది కాదు'
                  : 'Offline Mode — Crowd Data is Cached'}
              </Text>
            </View>
            <Text style={[styles.offlineAlertBody, { color: isDark ? '#FCD34D' : '#B45309' }]}>
              {lang === 'te'
                ? 'ప్రత్యక్ష సర్వర్ లేదా నెట్‌వర్క్ అందుబాటులో లేదు. క్రింద చూపిన రద్దీ స్థాయిలు గత నిల్వ నుండి వచ్చినవి, ప్రస్తుత నదీ తీర పరిస్థితిని సూచించవు.'
                : 'Live backend disconnected. The crowd statuses displayed below are cached snapshots and do not represent real-time riverbank conditions. Follow on-site personnel instructions.'}
            </Text>
            <Pressable
              onPress={loadGhats}
              style={({ pressed }) => [
                styles.offlineRetryBtn,
                { backgroundColor: isDark ? '#78350F' : '#FDE68A' },
                pressed && { opacity: 0.75 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Retry live connection"
            >
              <AppIcon name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }} size={13} color={isDark ? '#FDE68A' : '#92400E'} />
              <Text style={[styles.offlineRetryText, { color: isDark ? '#FDE68A' : '#92400E' }]}>
                {lang === 'te' ? 'ప్రత్యక్ష కనెక్షన్ మళ్లీ ప్రయత్నించండి' : 'Retry Live Connection'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Safety & Sacred Snanam Advisory Banner */}
        <View
          style={[
            styles.advisoryCard,
            {
              backgroundColor: isDark ? '#1F2A38' : '#EFF6FF',
              borderColor: isDark ? '#2D3E53' : '#BFDBFE',
            },
          ]}
        >
          <View style={styles.advisoryHeader}>
            <AppIcon
              name={{ ios: 'info.circle.fill', android: 'info', web: 'info' }}
              size={15}
              color="#2563EB"
            />
            <Text style={[styles.advisoryTitle, { color: isDark ? '#93C5FD' : '#1D4ED8' }]}>
              {lang === 'te' ? 'యాత్రికుల రక్షణ సూచన' : 'Pilgrim Safety Advisory'}
            </Text>
          </View>
          <Text style={[styles.advisoryBody, { color: colors.textSecondary }]}>
            {lang === 'te'
              ? 'నది ప్రవాహం ఎక్కువగా ఉన్న ఘాట్‌లలో బారికేడ్ల పరిధిలోనే స్నానం చేయండి. లైఫ్ గార్డుల సూచనలను తప్పక పాటించండి.'
              : 'Please bathe only within safe netted barricades. Keep children close and follow life guard instructions at all times.'}
          </Text>
        </View>

        {/* Priority Pass CTA Banner */}
        <Pressable
          onPress={() => router.push('/bookings')}
          accessibilityRole="button"
          accessibilityLabel="Apply for priority pass"
          style={({ pressed }) => [
            styles.priorityPassBanner,
            {
              backgroundColor: isDark ? '#262215' : '#FEF3C7',
              borderColor: isDark ? '#53431D' : '#FDE68A',
            },
            Shadows.card,
            pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
          ]}
        >
          <View style={styles.priorityPassContent}>
            <View style={[styles.starBadge, { backgroundColor: '#F59E0B' }]}>
              <AppIcon
                name={{ ios: 'star.fill', android: 'star', web: 'star' }}
                size={14}
                color="#FFFFFF"
              />
            </View>
            <View style={styles.priorityTextCol}>
              <Text style={[styles.priorityTitle, { color: isDark ? '#FDE68A' : '#92400E' }]}>
                {lang === 'te'
                  ? 'సీనియర్ సిటిజన్లు & దివ్యాంగుల ప్రాధాన్యత పాస్'
                  : 'Senior Citizen (65+) & Special Assistance Passes'}
              </Text>
              <Text style={[styles.prioritySubtitle, { color: isDark ? '#D1B875' : '#B45309' }]}>
                {lang === 'te'
                  ? 'పుష్కర ఘాట్‌ల వద్ద ప్రత్యేక ప్రవేశం మరియు వీల్‌చైర్ సహాయం కోసం దరఖాస్తు చేసుకోండి'
                  : 'Apply for fast-track entry and wheelchair assistance at pushkar ghats'}
              </Text>
            </View>
            <AppIcon
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron-right' }}
              size={16}
              color={isDark ? '#FDE68A' : '#92400E'}
            />
          </View>
        </Pressable>

        {/* Ghats List Count Header */}
        <View style={styles.countRow}>
          <Text style={[styles.countLabel, { color: colors.textSecondary }]}>
            {lang === 'te'
              ? `${filteredGhats.length} ఘాట్‌లు అందుబాటులో ఉన్నాయి`
              : `Showing ${filteredGhats.length} pushkar ghats`}
          </Text>
        </View>

        {/* Ghats List */}
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loaderText, { color: colors.textSecondary }]}>
              {t('loading')}
            </Text>
          </View>
        ) : filteredGhats.length === 0 ? (
          <EmptyState
            title={lang === 'te' ? 'ఘాట్‌లు కనుగొనబడలేదు' : 'No Ghats Found'}
            message={
              lang === 'te'
                ? 'ఎంచుకున్న శోధన లేదా ఫిల్టర్‌లకు తగిన ఘాట్‌లు లేవు.'
                : 'No pushkar ghats match your search or filter criteria.'
            }
            actionLabel={lang === 'te' ? 'అన్ని ఘాట్‌లను చూడండి' : 'Show All Ghats'}
            onAction={() => {
              setStatusFilter(null);
              setTownFilter('ALL');
              setSearchQuery('');
            }}
          />
        ) : (
          filteredGhats.map((ghat) => (
            <GhatStatusCard
              key={ghat.id}
              ghat={ghat}
              isOffline={isMock}
              onPress={() =>
                router.push({
                  pathname: '/listing/[id]',
                  params: { id: ghat.id },
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
    paddingBottom: Spacing.two,
    borderBottomWidth: 1,
  },
  titleRow: {
    marginBottom: Spacing.two,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  screenSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 2,
  },
  filterScroll: {
    paddingVertical: 4,
    gap: 8,
    alignItems: 'center',
  },
  filterDivider: {
    width: 1,
    height: 20,
    marginHorizontal: 4,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
    marginRight: 6,
  },
  chipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  contentScroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  offlineAlertCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    gap: 6,
  },
  offlineAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineAlertTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  offlineAlertBody: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
  },
  offlineRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 4,
  },
  offlineRetryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  advisoryCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    gap: 4,
  },
  advisoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  advisoryTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  advisoryBody: {
    fontSize: 11,
    lineHeight: 16,
  },
  priorityPassBanner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  priorityPassContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  starBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityTextCol: {
    flex: 1,
    gap: 2,
  },
  priorityTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  prioritySubtitle: {
    fontSize: 11,
    lineHeight: 15,
  },
  countRow: {
    marginBottom: Spacing.two,
  },
  countLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  loaderContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 13,
  },
});
