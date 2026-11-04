import React from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { useApp } from '../../context/app-context';
import { Spacing } from '../../constants/theme';
import { AppIcon } from './AppIcon';
import { CATEGORY_META, ListingCategory } from '../../constants/categories';
import godavariDeviImage from '@/assets/images/godavari-devi.png';

export interface HeroSectionProps {
  title?: string;
  subtitle?: string;
  tagline?: string;
  showStatue?: boolean;
  onSelectCategory?: (category: ListingCategory) => void;
}

const QUICK_CATEGORIES: ListingCategory[] = [
  'GHAT',
  'ANNADANAM',
  'FREE_ACCOMMODATION',
  'HOTEL',
  'RESTAURANT',
  'TRANSPORT',
];

export function HeroSection({
  title,
  subtitle,
  tagline,
  showStatue = true,
  onSelectCategory,
}: HeroSectionProps) {
  const { lang, colors, isDark } = useApp();

  const heroTitle = title || (lang === 'te' ? 'గోదావరి వన్‌కు స్వాగతం' : 'Welcome to Godavari One');
  const heroSubtitle =
    subtitle ||
    (lang === 'te'
      ? 'గోదావరి పుష్కరాలు 2027 కోసం మీ సంపూర్ణ మార్గదర్శి — ఘాట్‌లు, వసతి, ఆహారం, రవాణా మరియు అత్యవసర సేవలు ఒకే చోట.'
      : 'Your complete guide to Godavari Pushkaralu 2027 — ghats, stay, food, transport and emergency services in one place.');
  const heroTagline =
    tagline || (lang === 'te' ? 'గోదావరి పుష్కరాలు 2027 · డిజిటల్ వేదిక' : 'Godavari Pushkaralu 2027 · Digital Platform');

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? '#16282E' : '#E6F4F3',
          borderColor: isDark ? '#2D444E' : '#CBE5E3',
        },
      ]}
    >
      {/* Decorative Wave Circles */}
      <View style={styles.waveBackground} pointerEvents="none">
        <View
          style={[
            styles.waveCircle1,
            { backgroundColor: isDark ? 'rgba(85,189,181,0.06)' : 'rgba(22,138,138,0.08)' },
          ]}
        />
        <View
          style={[
            styles.waveCircle2,
            { backgroundColor: isDark ? 'rgba(245,158,11,0.04)' : 'rgba(217,119,6,0.05)' },
          ]}
        />
      </View>

      <View style={styles.contentRow}>
        <View style={styles.textContainer}>
          {/* Pushkaralu Tagline Badge */}
          <View
            style={[
              styles.taglineBadge,
              {
                backgroundColor: isDark ? '#203940' : '#FFFFFF',
                borderColor: colors.border,
              },
            ]}
          >
            <AppIcon
              name={{ ios: 'water.waves', android: 'water', web: 'waves' }}
              size={12}
              color={colors.primary}
            />
            <Text style={[styles.taglineText, { color: colors.primary }]}>{heroTagline}</Text>
          </View>

          {/* Hero Heading */}
          <Text style={[styles.heroHeading, { color: colors.text }]}>{heroTitle}</Text>

          {/* Subtitle */}
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            {heroSubtitle}
          </Text>
        </View>

        {/* Authentic Goddess Godavari Devi Statue */}
        {showStatue && (
          <View style={styles.imageContainer}>
            <View
              style={[
                styles.glowBackdrop,
                {
                  backgroundColor: isDark
                    ? 'rgba(245, 158, 11, 0.16)'
                    : 'rgba(217, 119, 6, 0.18)',
                },
              ]}
            />
            <Image
              source={godavariDeviImage}
              alt="Goddess Sri Godavari Devi"
              style={styles.deviImage}
              resizeMode="contain"
            />
          </View>
        )}
      </View>

      {/* 6 Category Quick Pills matching website home-view.tsx */}
      <View style={styles.quickPillsRow}>
        {QUICK_CATEGORIES.map((catKey) => {
          const catMeta = CATEGORY_META[catKey];
          if (!catMeta) return null;
          const label = lang === 'te' ? catMeta.teLabel : catMeta.label;

          return (
            <Pressable
              key={catKey}
              onPress={() => onSelectCategory?.(catKey)}
              style={({ pressed }) => [
                styles.quickPill,
                {
                  backgroundColor: isDark ? '#203940' : '#FFFFFF',
                  borderColor: colors.border,
                },
                pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
              ]}
              hitSlop={4}
            >
              <AppIcon name={catMeta.symbol} size={11} color={colors.primary} />
              <Text style={[styles.quickPillText, { color: colors.text }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Decorative River Wave Pill Bar */}
      <View style={styles.waveBarContainer}>
        <View style={[styles.wavePill, { backgroundColor: colors.primary, opacity: 0.9 }]} />
        <View style={[styles.wavePill, { backgroundColor: colors.accent, opacity: 0.7, width: 28 }]} />
        <View style={[styles.wavePill, { backgroundColor: colors.primary, opacity: 0.5, width: 14 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.four,
    marginBottom: Spacing.four,
    overflow: 'hidden',
    position: 'relative',
  },
  waveBackground: {
    ...StyleSheet.absoluteFill,
  },
  waveCircle1: {
    position: 'absolute',
    top: -50,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  waveCircle2: {
    position: 'absolute',
    bottom: -60,
    left: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  textContainer: {
    flex: 1,
    gap: 7,
  },
  taglineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 16,
    borderWidth: 1,
    gap: 5,
    alignSelf: 'flex-start',
  },
  taglineText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  heroHeading: {
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 27,
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    fontSize: 11.5,
    lineHeight: 16.5,
  },
  imageContainer: {
    width: 94,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginLeft: 4,
  },
  glowBackdrop: {
    position: 'absolute',
    width: 82,
    height: 82,
    borderRadius: 41,
    transform: [{ scale: 1.15 }],
  },
  deviImage: {
    width: 92,
    height: 102,
    borderRadius: 12,
  },
  quickPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.three,
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
  },
  quickPillText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  waveBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: Spacing.three,
  },
  wavePill: {
    height: 3.5,
    width: 44,
    borderRadius: 2,
  },
});
