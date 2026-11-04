import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Image,
  Linking,
  Share,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useApp } from '@/context/app-context';
import { Spacing, BottomTabInset, Shadows } from '@/constants/theme';
import { CATEGORY_META, ListingCategory, CrowdStatus } from '@/constants/categories';
import { getListingById, resolveImageUrl } from '@/services/api';
import { getOptimizedImageSource } from '@/services/image-assets';
import { ListingItem } from '@/types';
import { isFavorite, toggleFavorite } from '@/lib/storage';

import { AppIcon } from '@/components/ui/AppIcon';
import { EmptyState } from '@/components/ui/EmptyState';
import { CrowdBadge } from '@/components/ui/CrowdBadge';

const CROWD_CONFIG: Record<string, { bg: string; text: string; border: string; label: string; teLabel: string }> = {
  FREE: { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0', label: 'Low Crowd / Safe', teLabel: 'తక్కువ రద్దీ / అనుకూలం' },
  MODERATE: { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A', label: 'Moderate Crowd', teLabel: 'మధ్యస్థ రద్దీ' },
  CROWDED: { bg: '#FFEDD5', text: '#9A3412', border: '#FED7AA', label: 'Heavy Crowd', teLabel: 'ఎక్కువ రద్దీ' },
  OVERCROWDED: { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA', label: 'Overcrowded', teLabel: 'విపరీతమైన రద్దీ' },
  CLOSED: { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0', label: 'Temporarily Closed', teLabel: 'తాత్కాలికంగా మూసివేయబడింది' },
  EMERGENCY: { bg: '#DC2626', text: '#FFFFFF', border: '#B91C1C', label: 'Emergency Alert', teLabel: 'అత్యవసర హెచ్చరిక' },
};

export default function ListingDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { lang, toggleLang, colors, isDark, t } = useApp();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listing, setListing] = useState<ListingItem | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [fav, setFav] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const rawId = Array.isArray(id) ? id[0] : id;

  const loadListing = useCallback(async () => {
    if (!rawId) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const res = await getListingById(rawId);
      setListing(res.data);
      setIsLive(res.isLive);
      if (!res.data) {
        setError(res.error || 'Listing not found');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load listing details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rawId]);

  useEffect(() => {
    setLoading(true);
    loadListing();
    if (rawId) {
      setFav(isFavorite(rawId));
    }
  }, [loadListing, rawId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadListing();
  }, [loadListing]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/explore');
    }
  };

  const handleToggleFavorite = () => {
    if (!rawId) return;
    const newStatus = toggleFavorite(rawId);
    setFav(newStatus);
  };

  const handleCall = () => {
    if (listing?.phone) {
      const clean = listing.phone.split('/')[0].trim();
      Linking.openURL(`tel:${clean}`).catch(() => {});
    }
  };

  const handleDirections = () => {
    if (!listing) return;
    const dest = listing.latitude && listing.longitude
      ? `${listing.latitude},${listing.longitude}`
      : encodeURIComponent(`${listing.name}, ${listing.address}, Rajahmundry`);

    let url = `https://www.google.com/maps/search/?api=1&query=${dest}`;
    if (Platform.OS === 'android') {
      url = `geo:0,0?q=${dest}`;
    } else if (Platform.OS === 'ios') {
      url = `maps:?q=${dest}`;
    }

    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${dest}`);
    });
  };

  const handleShare = async () => {
    if (!listing) return;
    const shareMessage = `${listing.name} · Godavari Pushkaralu 2027\n${listing.address}\n\nDiscovered on Godavari One.`;
    try {
      await Share.share({
        title: listing.name,
        message: shareMessage,
      });
    } catch {}
  };

  const handleReport = () => {
    setReportSubmitted(true);
    setTimeout(() => setReportSubmitted(false), 5000);
  };

  const categoryMeta = listing ? CATEGORY_META[listing.category] : null;
  const categoryLabel = categoryMeta
    ? lang === 'te'
      ? categoryMeta.teLabel
      : categoryMeta.label
    : '';

  // Collect all gallery images
  const imagesList = useMemo(() => {
    if (!listing) return [];
    const imgs: string[] = [];
    if (Array.isArray((listing as any).images) && (listing as any).images.length > 0) {
      for (const img of (listing as any).images) {
        if (img?.url) imgs.push(img.url);
      }
    }
    if (imgs.length === 0 && listing.primaryImage) {
      imgs.push(listing.primaryImage);
    }
    return imgs;
  }, [listing]);

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.centerText, { color: colors.textSecondary }]}>
            {t('loading')}
          </Text>
        </View>
      </View>
    );
  }

  if (error || !listing) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.headerBar, { paddingTop: Math.max(insets.top, 12), backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
            <AppIcon name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow-left' }} size={20} color={colors.primary} />
            <Text style={[styles.backText, { color: colors.primary }]}>{lang === 'te' ? 'వెనుకకు' : 'Back'}</Text>
          </Pressable>
        </View>
        <EmptyState
          title={lang === 'te' ? 'జాబితా కనుగొనబడలేదు' : 'Listing Not Found'}
          message={error || (lang === 'te' ? 'కోరిన సేవ సమాచారం అందుబాటులో లేదు.' : 'The requested listing details could not be found.')}
          actionLabel={t('retry')}
          onAction={loadListing}
        />
      </View>
    );
  }

  const primaryUri = imagesList[activeImageIdx] || listing.primaryImage;
  const resolvedUri = resolveImageUrl(primaryUri);
  const imageSource = getOptimizedImageSource(primaryUri, resolvedUri);

  // Accessibility flags
  const a11y = (listing as any).accessibility;
  const a11yFlags = [
    { key: 'wheelchair_access', label: 'Wheelchair Accessible', te: 'వీల్‌చైర్ సౌకర్యం', icon: 'figure.roll' },
    { key: 'accessible_toilet', label: 'Accessible Toilets', te: 'ప్రత్యేక మరుగుదొడ్లు', icon: 'toilet' },
    { key: 'drinking_water', label: 'Drinking Water', te: 'రక్షిత తాగునీరు', icon: 'drop.fill' },
    { key: 'first_aid', label: 'First Aid & Medical', te: 'ప్రథమ చికిత్స కేంద్రం', icon: 'cross.case.fill' },
    { key: 'senior_citizen_assist', label: 'Senior Citizen Support', te: 'వృద్ధుల సహాయం', icon: 'person.fill.badge.plus' },
    { key: 'emergency_point', label: 'Emergency Helpdesk', te: 'అత్యవసర సహాయ కేంద్రం', icon: 'shield.fill' },
    { key: 'parking', label: 'Vehicle Parking', te: 'వాహన పార్కింగ్', icon: 'car.fill' },
    { key: 'family_friendly', label: 'Family Friendly', te: 'కుటుంబ అనుకూలం', icon: 'figure.2.and.child.holdinghands' },
  ].filter((f) => a11y && a11y[f.key]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Top Header Bar */}
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

          <View style={styles.headerRightActions}>
            {/* Favorite Button */}
            <Pressable
              onPress={handleToggleFavorite}
              style={({ pressed }) => [
                styles.iconActionBtn,
                { backgroundColor: fav ? (isDark ? '#3E1F24' : '#FEE2E2') : colors.secondary },
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Favorite"
            >
              <AppIcon
                name={fav ? { ios: 'heart.fill', android: 'favorite', web: 'heart' } : { ios: 'heart', android: 'favorite_border', web: 'heart-o' }}
                size={18}
                color={fav ? '#DC2626' : colors.textSecondary}
              />
            </Pressable>

            {/* Share Button */}
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [
                styles.iconActionBtn,
                { backgroundColor: colors.secondary },
                pressed && { opacity: 0.7 },
              ]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Share"
            >
              <AppIcon
                name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
                size={18}
                color={colors.primary}
              />
            </Pressable>

            {/* Language Toggle Pill */}
            <Pressable
              onPress={toggleLang}
              style={({ pressed }) => [
                styles.langPill,
                { backgroundColor: colors.secondary, borderColor: colors.border },
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
        {/* Hero Image Section */}
        <View style={[styles.heroImageCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.card]}>
          {imageSource ? (
            <Image source={imageSource} alt={listing.name} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: isDark ? '#1C2E33' : '#E6F4F3' }]}>
              {categoryMeta && <AppIcon name={categoryMeta.symbol} size={54} color={categoryMeta.color} />}
            </View>
          )}

          {/* Badges Over Image */}
          <View style={styles.badgeOverlayRow}>
            {categoryMeta && (
              <View style={[styles.categoryBadge, { backgroundColor: categoryMeta.color }]}>
                <AppIcon name={categoryMeta.symbol} size={12} color="#FFFFFF" />
                <Text style={styles.categoryBadgeText}>{categoryLabel}</Text>
              </View>
            )}

            {listing.verificationStatus === 'VERIFIED' && (
              <View style={styles.verifiedBadge}>
                <AppIcon name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'check-circle' }} size={13} color="#059669" />
                <Text style={styles.verifiedBadgeText}>{lang === 'te' ? 'ధృవీకరించబడింది' : 'Verified'}</Text>
              </View>
            )}
          </View>

          {/* Image Gallery Indicator Thumbnails */}
          {imagesList.length > 1 && (
            <View style={styles.galleryThumbnailsRow}>
              {imagesList.map((img, idx) => (
                <Pressable
                  key={`${img}-${idx}`}
                  onPress={() => setActiveImageIdx(idx)}
                  style={[
                    styles.thumbnailDot,
                    idx === activeImageIdx && { backgroundColor: colors.primary, width: 22 },
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Title & Core Location Header */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.card]}>
          <Text style={[styles.listingTitle, { color: colors.text }]}>{listing.name}</Text>

          <View style={styles.locationRow}>
            <AppIcon
              name={{ ios: 'mappin.and.ellipse', android: 'place', web: 'map-marker' }}
              size={16}
              color={colors.primary}
            />
            <Text style={[styles.locationAddress, { color: colors.textSecondary }]}>
              {listing.address}
              {listing.town ? ` · ${listing.town}` : ''}
              {listing.district ? ` · ${listing.district}` : ''}
            </Text>
          </View>

          {listing.latitude && listing.longitude && (
            <View style={styles.coordsRow}>
              <AppIcon name={{ ios: 'location.circle.fill', android: 'my_location', web: 'compass' }} size={13} color={colors.textMuted} />
              <Text style={[styles.coordsText, { color: colors.textMuted }]}>
                {listing.latitude.toFixed(4)}° N, {listing.longitude.toFixed(4)}° E
                {listing.locationVerified ? (lang === 'te' ? ' · ధృవీకరించిన నిరూపకాలు' : ' · Verified Coords') : ''}
              </Text>
            </View>
          )}

          {/* Primary Quick Actions Bar */}
          <View style={styles.quickActionsBar}>
            {listing.phone && (
              <Pressable
                onPress={handleCall}
                style={({ pressed }) => [
                  styles.primaryActionButton,
                  { backgroundColor: colors.primary },
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Call"
              >
                <AppIcon name={{ ios: 'phone.fill', android: 'call', web: 'phone' }} size={16} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>{t('call')}</Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleDirections}
              style={({ pressed }) => [
                styles.primaryActionButton,
                { backgroundColor: listing.phone ? colors.secondary : colors.primary },
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Directions"
            >
              <AppIcon
                name={{ ios: 'arrow.triangle.turn.up.right.circle.fill', android: 'directions', web: 'directions' }}
                size={16}
                color={listing.phone ? colors.primary : '#FFFFFF'}
              />
              <Text
                style={[
                  styles.primaryActionText,
                  { color: listing.phone ? colors.primary : '#FFFFFF' },
                ]}
              >
                {t('directions')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Real-Time Operational Status (Timing / Crowd Status) */}
        <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.card]}>
          <View style={styles.statusRow}>
            <View style={styles.statusLeft}>
              <Text style={[styles.statusSectionHeading, { color: colors.text }]}>
                {lang === 'te' ? 'ప్రస్తుత స్థితి' : 'Live Status'}
              </Text>
              <Text style={[styles.statusSub, { color: colors.textSecondary }]}>
                {listing.timingStatus?.detail || listing.timingStatus?.label || (lang === 'te' ? '2027 పుష్కరాల సేవా డెస్క్' : 'Pushkaralu 2027 active seva')}
              </Text>
            </View>

            {listing.timingStatus?.isOpen && (
              <View style={[styles.openBadge, { backgroundColor: '#D1FAE5' }]}>
                <View style={styles.openDot} />
                <Text style={styles.openBadgeText}>{lang === 'te' ? 'ప్రస్తుతం తెరిచి ఉంది' : 'Open Now'}</Text>
              </View>
            )}
          </View>

          {/* Ghat Live Crowd Status */}
          {listing.category === 'GHAT' && listing.ghat?.currentCrowdStatus && (
            <View style={[styles.crowdStatusBanner, { backgroundColor: CROWD_CONFIG[listing.ghat.currentCrowdStatus]?.bg || '#F1F5F9' }]}>
              <View style={styles.crowdStatusHeader}>
                <AppIcon name={{ ios: 'person.3.fill', android: 'groups', web: 'users' }} size={18} color={CROWD_CONFIG[listing.ghat.currentCrowdStatus]?.text || '#1E293B'} />
                <Text style={[styles.crowdStatusTitle, { color: CROWD_CONFIG[listing.ghat.currentCrowdStatus]?.text || '#1E293B' }]}>
                  {lang === 'te' ? CROWD_CONFIG[listing.ghat.currentCrowdStatus]?.teLabel : CROWD_CONFIG[listing.ghat.currentCrowdStatus]?.label}
                </Text>
              </View>
              {listing.ghat.statusUpdatedAt && (
                <Text style={[styles.crowdUpdatedText, { color: CROWD_CONFIG[listing.ghat.currentCrowdStatus]?.text || '#1E293B' }]}>
                  {lang === 'te' ? 'అధికారిక అప్‌డేట్:' : 'Official update:'} {new Date(listing.ghat.statusUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
            </View>
          )}

          {/* Hospital Emergency Status */}
          {listing.category === 'HOSPITAL' && (listing as any).hospital?.emergencyAvailable && (
            <View style={[styles.emergencyBanner, { backgroundColor: isDark ? '#3E1F24' : '#FEE2E2' }]}>
              <AppIcon name={{ ios: 'cross.fill', android: 'local_hospital', web: 'plus-square' }} size={16} color="#DC2626" />
              <Text style={[styles.emergencyBannerText, { color: isDark ? '#FECACA' : '#991B1B' }]}>
                {t('emergencyAvailable')}
              </Text>
            </View>
          )}
        </View>

        {/* Description Section */}
        {listing.description ? (
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.card]}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>{t('overview')}</Text>
            <Text style={[styles.bodyDescription, { color: colors.textSecondary }]}>
              {listing.description}
            </Text>
          </View>
        ) : null}

        {/* Category-Specific Real Details */}
        {listing.category === 'HOTEL' && (listing as any).hotel && (
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.card]}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>{t('details')}</Text>
            <View style={styles.attributesGrid}>
              {(listing as any).hotel.numRooms && (
                <View style={[styles.attrItem, { backgroundColor: colors.background }]}>
                  <Text style={[styles.attrLabel, { color: colors.textMuted }]}>{t('rooms')}</Text>
                  <Text style={[styles.attrValue, { color: colors.text }]}>{(listing as any).hotel.numRooms} Rooms</Text>
                </View>
              )}
              {(listing as any).hotel.roomCapacity && (
                <View style={[styles.attrItem, { backgroundColor: colors.background }]}>
                  <Text style={[styles.attrLabel, { color: colors.textMuted }]}>{t('capacity')}</Text>
                  <Text style={[styles.attrValue, { color: colors.text }]}>{(listing as any).hotel.roomCapacity} Guests / Room</Text>
                </View>
              )}
              {(listing as any).hotel.checkInTime && (
                <View style={[styles.attrItem, { backgroundColor: colors.background }]}>
                  <Text style={[styles.attrLabel, { color: colors.textMuted }]}>{t('checkIn')}</Text>
                  <Text style={[styles.attrValue, { color: colors.text }]}>{(listing as any).hotel.checkInTime}</Text>
                </View>
              )}
              {(listing as any).hotel.checkOutTime && (
                <View style={[styles.attrItem, { backgroundColor: colors.background }]}>
                  <Text style={[styles.attrLabel, { color: colors.textMuted }]}>{t('checkOut')}</Text>
                  <Text style={[styles.attrValue, { color: colors.text }]}>{(listing as any).hotel.checkOutTime}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {listing.category === 'RESTAURANT' && (listing as any).restaurant && (
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.card]}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>{t('details')}</Text>
            <View style={styles.attributesGrid}>
              {(listing as any).restaurant.cuisine && (
                <View style={[styles.attrItem, { backgroundColor: colors.background }]}>
                  <Text style={[styles.attrLabel, { color: colors.textMuted }]}>{t('cuisine')}</Text>
                  <Text style={[styles.attrValue, { color: colors.text }]}>{(listing as any).restaurant.cuisine}</Text>
                </View>
              )}
              {(listing as any).restaurant.foodType && (
                <View style={[styles.attrItem, { backgroundColor: colors.background }]}>
                  <Text style={[styles.attrLabel, { color: colors.textMuted }]}>{t('foodType')}</Text>
                  <Text style={[styles.attrValue, { color: colors.text }]}>
                    {(listing as any).restaurant.foodType === 'VEG' ? t('pureVeg') : (listing as any).restaurant.foodType}
                  </Text>
                </View>
              )}
              {(listing as any).restaurant.tableCapacity && (
                <View style={[styles.attrItem, { backgroundColor: colors.background }]}>
                  <Text style={[styles.attrLabel, { color: colors.textMuted }]}>{t('capacity')}</Text>
                  <Text style={[styles.attrValue, { color: colors.text }]}>{(listing as any).restaurant.tableCapacity} Seating</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {listing.category === 'FREE_ACCOMMODATION' && (listing as any).freeAccommodation && (
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.card]}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>{t('freeSeva')}</Text>
            <View style={styles.attributesGrid}>
              {(listing as any).freeAccommodation.totalCapacity && (
                <View style={[styles.attrItem, { backgroundColor: colors.background }]}>
                  <Text style={[styles.attrLabel, { color: colors.textMuted }]}>{lang === 'te' ? 'మొత్తం సామర్థ్యం' : 'Total Capacity'}</Text>
                  <Text style={[styles.attrValue, { color: colors.text }]}>{(listing as any).freeAccommodation.totalCapacity} Pilgrims</Text>
                </View>
              )}
              {(listing as any).freeAccommodation.maxStayDays && (
                <View style={[styles.attrItem, { backgroundColor: colors.background }]}>
                  <Text style={[styles.attrLabel, { color: colors.textMuted }]}>{lang === 'te' ? 'గరిష్ట బస' : 'Max Stay'}</Text>
                  <Text style={[styles.attrValue, { color: colors.text }]}>{(listing as any).freeAccommodation.maxStayDays} Days</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {listing.category === 'GHAT' && (
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.card]}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>
              {lang === 'te' ? 'ఘాట్ సదుపాయాలు & వివరాలు' : 'Ghat Facilities & Safety Measures'}
            </Text>

            <View style={styles.attributesGrid}>
              {Boolean((listing as any).ghatDetails?.capacity || (listing as any).ghat?.capacity) && (
                <View style={[styles.attrItem, { backgroundColor: colors.background }]}>
                  <Text style={[styles.attrLabel, { color: colors.textMuted }]}>{t('capacity')}</Text>
                  <Text style={[styles.attrValue, { color: colors.text }]}>
                    {(listing as any).ghatDetails?.capacity || (listing as any).ghat?.capacity} Pilgrims
                  </Text>
                </View>
              )}
              <View style={[styles.attrItem, { backgroundColor: colors.background }]}>
                <Text style={[styles.attrLabel, { color: colors.textMuted }]}>{lang === 'te' ? 'స్నాన భద్రత' : 'Bathing Barricades'}</Text>
                <Text style={[styles.attrValue, { color: colors.success }]}>
                  {lang === 'te' ? 'సురక్షిత వలలు కలవు' : 'Netted Safety Zone'}
                </Text>
              </View>
              <View style={[styles.attrItem, { backgroundColor: colors.background }]}>
                <Text style={[styles.attrLabel, { color: colors.textMuted }]}>{lang === 'te' ? 'లైఫ్ గార్డ్స్' : 'Life Guards'}</Text>
                <Text style={[styles.attrValue, { color: colors.primary }]}>
                  {lang === 'te' ? '24/7 సిబ్బంది' : 'Active Duty'}
                </Text>
              </View>
            </View>

            {/* Priority Bathing Pass Card */}
            <Pressable
              onPress={() => router.push('/bookings')}
              accessibilityRole="button"
              accessibilityLabel="Book priority bathing pass"
              style={({ pressed }) => [
                styles.priorityPassDetailCta,
                {
                  backgroundColor: isDark ? '#262215' : '#FEF3C7',
                  borderColor: isDark ? '#53431D' : '#FDE68A',
                },
                pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
              ]}
            >
              <View style={[styles.starIconBox, { backgroundColor: '#F59E0B' }]}>
                <AppIcon name={{ ios: 'star.fill', android: 'star', web: 'star' }} size={16} color="#FFFFFF" />
              </View>
              <View style={styles.priorityCtaTextCol}>
                <Text style={[styles.priorityCtaTitle, { color: isDark ? '#FDE68A' : '#92400E' }]}>
                  {lang === 'te' ? 'ప్రాధాన్యత స్నాన పాస్ దరఖాస్తు' : 'Apply for Priority Ghat Pass'}
                </Text>
                <Text style={[styles.priorityCtaSub, { color: isDark ? '#D1B875' : '#B45309' }]}>
                  {lang === 'te'
                    ? 'సీనియర్ సిటిజన్లు (65+) & దివ్యాంగుల కోసం ఉచిత స్లాట్ మరియు వీల్‌చైర్ సదుపాయం.'
                    : 'Dedicated slot booking & wheelchair ramp assistance for seniors 65+ and persons with disability.'}
                </Text>
              </View>
              <AppIcon name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron-right' }} size={16} color={isDark ? '#FDE68A' : '#92400E'} />
            </Pressable>
          </View>
        )}

        {/* Accessibility & Pilgrim Assistance */}
        {a11yFlags.length > 0 && (
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.card]}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>
              {t('accessibilityFeatures')}
            </Text>
            <View style={styles.a11yGrid}>
              {a11yFlags.map((item) => (
                <View key={item.key} style={[styles.a11yPill, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <AppIcon name={{ ios: item.icon as any, android: 'check', web: 'check' }} size={15} color={colors.primary} />
                  <Text style={[styles.a11yPillText, { color: colors.primary }]}>
                    {lang === 'te' ? item.te : item.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Report Incorrect Info Button */}
        <View style={styles.reportSection}>
          <Pressable
            onPress={handleReport}
            style={({ pressed }) => [
              styles.reportButton,
              { borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <AppIcon
              name={{ ios: 'flag.fill', android: 'report', web: 'flag' }}
              size={14}
              color={colors.textMuted}
            />
            <Text style={[styles.reportButtonText, { color: colors.textMuted }]}>
              {t('reportIssue')}
            </Text>
          </Pressable>

          {reportSubmitted && (
            <View style={[styles.reportFeedback, { backgroundColor: '#D1FAE5' }]}>
              <Text style={styles.reportFeedbackText}>{t('reportSent')}</Text>
            </View>
          )}
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
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
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
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  centerText: {
    fontSize: 14,
  },
  heroImageCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    height: 220,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOverlayRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  verifiedBadgeText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '700',
  },
  galleryThumbnailsRow: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  thumbnailDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  infoCard: {
    padding: Spacing.four,
    borderRadius: 16,
    borderWidth: 1,
    gap: Spacing.three,
  },
  listingTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  locationAddress: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  coordsText: {
    fontSize: 12,
  },
  quickActionsBar: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Spacing.one,
  },
  primaryActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 12,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  statusCard: {
    padding: Spacing.four,
    borderRadius: 16,
    borderWidth: 1,
    gap: Spacing.three,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLeft: {
    gap: 2,
  },
  statusSectionHeading: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusSub: {
    fontSize: 13,
  },
  openBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  openDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  openBadgeText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '700',
  },
  crowdStatusBanner: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: 4,
  },
  crowdStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  crowdStatusTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  crowdUpdatedText: {
    fontSize: 11,
    fontWeight: '500',
  },
  emergencyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.three,
    borderRadius: 12,
  },
  emergencyBannerText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
  },
  bodyDescription: {
    fontSize: 14,
    lineHeight: 22,
  },
  attributesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  attrItem: {
    flex: 1,
    minWidth: '45%',
    padding: Spacing.three,
    borderRadius: 12,
    gap: 3,
  },
  attrLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  attrValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  priorityPassDetailCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.three,
    marginTop: 8,
  },
  starIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityCtaTextCol: {
    flex: 1,
    gap: 2,
  },
  priorityCtaTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  priorityCtaSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  a11yGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  a11yPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 14,
    borderWidth: 1,
  },
  a11yPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reportSection: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  reportButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reportFeedback: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  reportFeedbackText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '600',
  },
});
