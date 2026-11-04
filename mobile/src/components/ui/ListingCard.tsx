import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { ListingItem } from '../../types';
import { CATEGORY_META } from '../../constants/categories';
import { useApp } from '../../context/app-context';
import { Spacing, Shadows } from '../../constants/theme';
import { AppIcon } from './AppIcon';
import { resolveImageUrl } from '../../services/api';
import { getOptimizedImageSource } from '../../services/image-assets';
import { isFavorite, toggleFavorite } from '../../lib/storage';

export interface ListingCardProps {
  listing: ListingItem;
  onPress?: () => void;
}

const CROWD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  FREE: { bg: '#D1FAE5', text: '#065F46', border: '#A7F3D0' },
  MODERATE: { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A' },
  CROWDED: { bg: '#FFEDD5', text: '#9A3412', border: '#FED7AA' },
  CLOSED: { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
  OVERCROWDED: { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
  EMERGENCY: { bg: '#DC2626', text: '#FFFFFF', border: '#B91C1C' },
};

export function ListingCard({ listing, onPress }: ListingCardProps) {
  const router = useRouter();
  const { lang, colors, isDark } = useApp();
  const [imageError, setImageError] = useState(false);
  const [fav, setFav] = useState(false);

  React.useEffect(() => {
    if (listing.id) {
      setFav(isFavorite(listing.id));
    }
  }, [listing.id]);

  const handleToggleFav = (e: any) => {
    e?.stopPropagation?.();
    const updated = toggleFavorite(listing.id);
    setFav(updated);
  };

  const handleCardPress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push({ pathname: '/listing/[id]', params: { id: listing.id } } as any);
    }
  };

  const meta = CATEGORY_META[listing.category] || CATEGORY_META.HOTEL;
  const categoryLabel = lang === 'te' ? meta.teLabel : meta.label;

  const resolvedUri = resolveImageUrl(listing.primaryImage);
  const imageSource = getOptimizedImageSource(listing.primaryImage, resolvedUri);
  const hasValidImage = Boolean(imageSource && !imageError);

  const locationText =
    [listing.town, listing.district].filter(Boolean).join(', ') || listing.address;

  const handleCall = () => {
    if (listing.phone) {
      const cleanPhone = listing.phone.split('/')[0].trim();
      Linking.openURL(`tel:${cleanPhone}`).catch(() => {});
    }
  };

  // Crowd status config for Ghats
  const crowdStatus = listing.ghat?.currentCrowdStatus;
  const crowdStyle = crowdStatus && CROWD_COLORS[crowdStatus]
    ? CROWD_COLORS[crowdStatus]
    : { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };

  return (
    <Pressable
      onPress={handleCardPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        Shadows.card,
        pressed && { opacity: 0.94, transform: [{ scale: 0.995 }] },
      ]}
    >
      {/* Image Header with Fallback */}
      <View style={styles.imageContainer}>
        {hasValidImage ? (
          <Image
            source={imageSource!}
            alt={listing.name}
            style={styles.image}
            resizeMode="cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <View
            style={[
              styles.imagePlaceholder,
              { backgroundColor: isDark ? '#1C2E33' : '#E6F4F3' },
            ]}
          >
            <AppIcon name={meta.symbol} size={36} color={meta.color} />
          </View>
        )}

        {/* Top-Left Category Badge */}
        <View style={styles.topLeftBadge}>
          <View style={styles.categoryBadgePill}>
            <AppIcon name={meta.symbol} size={11} color="#0F172A" />
            <Text style={styles.categoryBadgeText}>{categoryLabel}</Text>
          </View>
        </View>

        {/* Top-Right Category-Specific Badges */}
        {listing.category === 'GHAT' && (
          <View style={styles.topRightBadge}>
            <View
              style={[
                styles.badgePill,
                { backgroundColor: crowdStyle.bg, borderColor: crowdStyle.border },
              ]}
            >
              <Text style={[styles.badgePillText, { color: crowdStyle.text }]}>
                {crowdStatus || (lang === 'te' ? 'స్టేటస్ లేదు' : 'Not reported')}
              </Text>
            </View>
          </View>
        )}

        {listing.category === 'FREE_ACCOMMODATION' && (
          <View style={styles.topRightBadge}>
            {listing.freeAccommodation?.isTemporarilyUnavailable ? (
              <View style={[styles.badgePill, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                <Text style={[styles.badgePillText, { color: '#92400E' }]}>
                  {lang === 'te' ? 'అందుబాటులో లేదు' : 'Unavailable'}
                </Text>
              </View>
            ) : listing.freeAccommodation?.availableCapacity === 0 ? (
              <View style={[styles.badgePill, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
                <Text style={[styles.badgePillText, { color: '#991B1B' }]}>
                  {lang === 'te' ? 'పూర్తయింది' : 'Full'}
                </Text>
              </View>
            ) : listing.freeAccommodation?.availableCapacity != null ? (
              <View style={[styles.badgePill, { backgroundColor: '#E0E7FF', borderColor: '#C7D2FE' }]}>
                <Text style={[styles.badgePillText, { color: '#3730A3' }]}>
                  {listing.freeAccommodation.availableCapacity} {lang === 'te' ? 'ఖాలీలు' : 'available'}
                </Text>
              </View>
            ) : (
              <View style={[styles.badgePill, { backgroundColor: '#E0E7FF', borderColor: '#C7D2FE' }]}>
                <Text style={[styles.badgePillText, { color: '#3730A3' }]}>
                  {lang === 'te' ? 'ఉచిత వసతి' : 'Free Stay'}
                </Text>
              </View>
            )}
          </View>
        )}

        {listing.category === 'ANNADANAM' && (
          <View style={styles.topRightBadge}>
            <View style={[styles.badgePill, { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' }]}>
              <View style={styles.liveGreenDot} />
              <Text style={[styles.badgePillText, { color: '#065F46' }]}>
                {lang === 'te' ? 'ఉచిత భోజనం' : 'Free Meals'}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Card Content */}
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {listing.name}
        </Text>

        <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
          {listing.description}
        </Text>

        {/* Location Row with MapPin */}
        <View style={styles.locationRow}>
          <AppIcon
            name={{ ios: 'mappin.and.ellipse', android: 'place', web: 'map-pin' }}
            size={12}
            color={colors.primary}
          />
          <Text style={[styles.locationText, { color: colors.textSecondary }]} numberOfLines={1}>
            {locationText}
          </Text>
        </View>

        {/* Operating Hours / Timing */}
        <View style={styles.timingRow}>
          <AppIcon
            name={{ ios: 'clock', android: 'schedule', web: 'clock' }}
            size={12}
            color={colors.textMuted}
          />
          <Text style={[styles.timingText, { color: colors.textMuted }]}>
            {listing.category === 'GHAT' || listing.category === 'HOSPITAL'
              ? (lang === 'te' ? '24 గంటలు తెరిచి ఉంటుంది' : 'Open 24 hours')
              : (lang === 'te' ? 'ఉదయం నుండి సాయంత్రం వరకు' : 'Open Daily')}
          </Text>
        </View>

        {/* Location Unverified Warning if false */}
        {!listing.locationVerified && (
          <Text style={styles.unverifiedWarning}>
            {lang === 'te' ? 'లొకేషన్ ఇంకా ధృవీకరించబడలేదు' : 'Location unverified'}
          </Text>
        )}
      </View>

      {/* Card Footer matching website */}
      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }]}>
        {listing.phone ? (
          <Pressable
            onPress={handleCall}
            style={({ pressed }) => [
              styles.callButton,
              { backgroundColor: colors.secondary },
              pressed && { opacity: 0.75 },
            ]}
            hitSlop={6}
          >
            <AppIcon
              name={{ ios: 'phone.fill', android: 'call', web: 'phone' }}
              size={12}
              color={colors.primary}
            />
            <Text style={[styles.callButtonText, { color: colors.primary }]}>
              {lang === 'te' ? 'కాల్ చేయండి' : 'Call Now'}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.emptyFooterSpacer} />
        )}

        <View style={styles.footerActionsRight}>
          <Pressable
            onPress={handleToggleFav}
            style={({ pressed }) => [
              styles.cardFavButton,
              {
                backgroundColor: fav ? (isDark ? '#3E1F24' : '#FEE2E2') : colors.card,
                borderColor: colors.border,
              },
              pressed && { opacity: 0.7 },
            ]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Favorite ${listing.name}`}
          >
            <AppIcon
              name={
                fav
                  ? { ios: 'heart.fill', android: 'favorite', web: 'heart' }
                  : { ios: 'heart', android: 'favorite_border', web: 'heart-o' }
              }
              size={13}
              color={fav ? '#DC2626' : colors.textMuted}
            />
          </Pressable>

          <Pressable
            onPress={handleCardPress}
            style={({ pressed }) => [
              styles.exploreButton,
              { borderColor: colors.border },
              pressed && { opacity: 0.75 },
            ]}
            hitSlop={6}
          >
            <Text style={[styles.exploreButtonText, { color: colors.primary }]}>
              {lang === 'te' ? 'వివరాలు' : 'Explore'}
            </Text>
            <AppIcon
              name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron-right' }}
              size={12}
              color={colors.primary}
            />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.four,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    maxHeight: 220,
    position: 'relative',
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topLeftBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  categoryBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  categoryBadgeText: {
    color: '#0F172A',
    fontSize: 10.5,
    fontWeight: '700',
  },
  topRightBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  badgePillText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  body: {
    padding: Spacing.four,
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  locationText: {
    fontSize: 11.5,
    flex: 1,
  },
  timingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  timingText: {
    fontSize: 11,
  },
  unverifiedWarning: {
    fontSize: 10.5,
    color: '#D97706',
    fontWeight: '500',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + 2,
    borderTopWidth: 1,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  callButtonText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyFooterSpacer: {
    flex: 1,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  footerActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  cardFavButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreButtonText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
