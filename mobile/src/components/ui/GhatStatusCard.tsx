import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ListingItem } from '../../types';
import { useApp } from '../../context/app-context';
import { Spacing, Shadows } from '../../constants/theme';
import { CrowdBadge } from './CrowdBadge';
import { AppIcon } from './AppIcon';
import { openMapsDirections } from '../../lib/maps';

export interface GhatStatusCardProps {
  ghat: ListingItem;
  onPress?: () => void;
  isOffline?: boolean;
}

function formatRelativeTime(dateStr?: string | null, lang: 'en' | 'te' = 'en'): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    if (diffMins < 1) return lang === 'te' ? 'ఇప్పుడే' : 'Just now';
    if (diffMins < 60) return lang === 'te' ? `${diffMins} ని. క్రితం` : `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return lang === 'te' ? `${diffHours} గం. క్రితం` : `${diffHours}h ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function GhatStatusCard({ ghat, onPress, isOffline = false }: GhatStatusCardProps) {
  const router = useRouter();
  const { lang, colors, isDark, t } = useApp();

  const details = (ghat as any).ghatDetails || ghat.ghat || {};
  const status = details.currentCrowdStatus;
  const updatedAt = formatRelativeTime(details.statusUpdatedAt, lang);
  const location = [ghat.locality, ghat.town, ghat.district].filter(Boolean).join(', ') || 'Godavari Riverbank';

  // Build combined facility list
  const facilities: string[] = [];
  if (Array.isArray(details.facilities)) {
    facilities.push(...details.facilities);
  }
  if (details.bathingSafe) {
    facilities.push(lang === 'te' ? 'రక్షణ బారికేడ్లు' : 'Safety Barricades');
  }
  if (details.changingRooms) {
    facilities.push(lang === 'te' ? 'చేంజింగ్ రూమ్‌లు' : 'Changing Rooms');
  }
  if (details.wheelchairAccess) {
    facilities.push(lang === 'te' ? 'వీల్‌చైర్ ర్యాంప్' : 'Wheelchair Ramp');
  }
  if (details.drinkingWater) {
    facilities.push(lang === 'te' ? 'మంచినీరు' : 'Drinking Water');
  }
  if (details.patrolBoatsAvailable) {
    facilities.push(lang === 'te' ? 'పెట్రోలింగ్ బోట్లు' : 'Rescue Patrol');
  }

  const handleCardPress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push({
        pathname: '/listing/[id]',
        params: { id: ghat.id },
      } as any);
    }
  };

  const handleDirections = (e: any) => {
    e?.stopPropagation?.();
    openMapsDirections(ghat.latitude, ghat.longitude, ghat.name, ghat.address);
  };

  return (
    <Pressable
      onPress={handleCardPress}
      accessibilityLabel={`Ghat ${ghat.name}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        Shadows.card,
        pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.nameColumn}>
          <View style={styles.riverIconRow}>
            <View style={[styles.riverIconBadge, { backgroundColor: colors.primaryLight }]}>
              <AppIcon
                name={{ ios: 'water.waves', android: 'water', web: 'waves' }}
                size={14}
                color={colors.primary}
              />
            </View>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {ghat.name}
            </Text>
          </View>
          <Text style={[styles.location, { color: colors.textSecondary }]} numberOfLines={1}>
            {location}
          </Text>
        </View>

        <View style={styles.statusColumn}>
          <CrowdBadge status={status} isOffline={isOffline} />
          {isOffline ? (
            <Text style={[styles.timeText, { color: '#D97706', fontWeight: '600' }]}>
              {lang === 'te' ? `ఆఫ్‌లైన్: ${updatedAt || 'మునుపటిది'}` : `Cached: ${updatedAt || 'stale'}`}
            </Text>
          ) : updatedAt ? (
            <Text style={[styles.timeText, { color: colors.textMuted }]}>
              {lang === 'te' ? `నవీకరణ: ${updatedAt}` : `Updated ${updatedAt}`}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Description */}
      {ghat.description ? (
        <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
          {ghat.description}
        </Text>
      ) : null}

      {/* Facilities Pills */}
      {facilities.length > 0 && (
        <View style={styles.facilitiesRow}>
          {facilities.slice(0, 4).map((f, i) => (
            <View
              key={i}
              style={[
                styles.facilityPill,
                { backgroundColor: isDark ? '#1F2E35' : colors.secondary },
              ]}
            >
              <Text style={[styles.facilityText, { color: colors.textSecondary }]}>
                {f}
              </Text>
            </View>
          ))}
          {facilities.length > 4 && (
            <View
              style={[
                styles.facilityPill,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <Text style={[styles.facilityText, { color: colors.primary }]}>
                +{facilities.length - 4}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Quick Action Footer */}
      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <Pressable
          onPress={handleDirections}
          accessibilityRole="button"
          accessibilityLabel="Get directions"
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: colors.secondary },
            pressed && { opacity: 0.7 },
          ]}
        >
          <AppIcon
            name={{ ios: 'location.north.line.fill', android: 'directions', web: 'directions' }}
            size={13}
            color={colors.primary}
          />
          <Text style={[styles.actionButtonText, { color: colors.primary }]}>
            {t('directions')}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleCardPress}
          accessibilityRole="button"
          accessibilityLabel="View ghat details"
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: colors.primaryLight },
            pressed && { opacity: 0.7 },
          ]}
        >
          <AppIcon
            name={{ ios: 'info.circle', android: 'info', web: 'info' }}
            size={13}
            color={colors.primary}
          />
          <Text style={[styles.actionButtonText, { color: colors.primary }]}>
            {lang === 'te' ? 'పూర్తి వివరాలు' : 'View Details'}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
    marginBottom: Spacing.three,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  nameColumn: {
    flex: 1,
  },
  riverIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  riverIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  location: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 32,
  },
  statusColumn: {
    alignItems: 'flex-end',
    gap: 4,
  },
  timeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 8,
  },
  facilitiesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
    marginBottom: 8,
  },
  facilityPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  facilityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
