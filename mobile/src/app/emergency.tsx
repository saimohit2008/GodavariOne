import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useApp } from '@/context/app-context';
import { Spacing, BottomTabInset, Shadows } from '@/constants/theme';
import { AppIcon } from '@/components/ui/AppIcon';

interface Hotline {
  titleEn: string;
  titleTe: string;
  descEn: string;
  descTe: string;
  phone: string;
  badge: string;
  icon: { ios: string; android: string; web: string };
  badgeColor: string;
}

const HOTLINES: Hotline[] = [
  {
    titleEn: 'Ambulance & Mobile ICU Boats',
    titleTe: 'అత్యవసర అంబులెన్స్ & మొబైల్ ICU',
    descEn: '24/7 riverbank medical response, first aid booths, and emergency patient transport.',
    descTe: '24 గంటల నదీతీర వైద్య సహాయం, ప్రథమ చికిత్స శిబిరాలు మరియు అత్యవసర రవాణా.',
    phone: '108',
    badge: '108',
    icon: { ios: 'cross.fill', android: 'local_hospital', web: 'hospital' },
    badgeColor: '#DC2626',
  },
  {
    titleEn: 'Police & River Patrol Force',
    titleTe: 'పోలీస్ & నదీ రక్షణ దళం',
    descEn: 'Crowd management, perimeter safety, anti-theft, and emergency security assistance.',
    descTe: 'రద్దీ నియంత్రణ, భద్రతా నిఘా, దొంగతనాల నివారణ మరియు రక్షణ సేవలు.',
    phone: '100',
    badge: '100 / 112',
    icon: { ios: 'shield.fill', android: 'local_police', web: 'shield' },
    badgeColor: '#2563EB',
  },
  {
    titleEn: 'Disaster Rescue & Fire Force (SDRF/NDRF)',
    titleTe: 'విపత్తు నివారణ & అగ్నిమాపక రక్షణ',
    descEn: 'Deep-water river search, rescue boats, lifebuoy squads, and hazard prevention.',
    descTe: 'లోతైన నీటి రక్షణ పడవలు, లైఫ్‌జాకెట్ దళాలు మరియు అత్యవసర విపత్తు నివారణ.',
    phone: '101',
    badge: '101 / 1077',
    icon: { ios: 'flame.fill', android: 'fire_extinguisher', web: 'fire' },
    badgeColor: '#D97706',
  },
  {
    titleEn: 'Women & Child Safety / Lost Help Desk',
    titleTe: 'మహిళా & పిల్లల రక్షణ / తప్పిపోయిన వారి విభాగం',
    descEn: 'Missing persons tracing, sector announcement desks, and safe shelters.',
    descTe: 'తప్పిపోయిన వారిని గుర్తించడం, అనౌన్స్‌మెంట్ కేంద్రాలు మరియు సురక్షిత ఆశ్రయాలు.',
    phone: '181',
    badge: '181',
    icon: { ios: 'person.2.fill', android: 'family_restroom', web: 'users' },
    badgeColor: '#7C3AED',
  },
];

export default function EmergencyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang, colors, isDark, t } = useApp();

  const handleCall = (phoneNumber: string) => {
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {});
  };

  const handleOpenHospitals = () => {
    router.push({
      pathname: '/category/[id]',
      params: { id: 'hospital' },
    } as any);
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
              {t('emergencyServices')}
            </Text>
            <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
              {lang === 'te'
                ? 'గోదావరి పుష్కరాలు 2027 · అధికారిక అత్యవసర వేదిక'
                : 'Godavari Pushkaralu 2027 · 24/7 Safety Command'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + BottomTabInset + 24 },
        ]}
      >
        {/* Central Pushkaralu Control Center Card */}
        <View
          style={[
            styles.controlRoomCard,
            {
              backgroundColor: isDark ? '#1E293B' : '#FEF2F2',
              borderColor: '#F87171',
            },
            Shadows.card,
          ]}
        >
          <View style={styles.controlHeaderRow}>
            <View style={styles.controlIconCircle}>
              <AppIcon
                name={{ ios: 'phone.badge.waveform.fill', android: 'phone_in_talk', web: 'phone-alt' }}
                size={22}
                color="#DC2626"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.controlRoomTitle}>
                {t('pushkarControlRoom')}
              </Text>
              <Text style={styles.controlRoomSub}>
                {lang === 'te'
                  ? 'గోదావరి పుష్కరాల ప్రధాన కంట్రోల్ సెంటర్ & టోల్-ఫ్రీ హెల్ప్‌లైన్'
                  : 'Main Pushkaralu 24x7 District Helpline & Disaster Center'}
              </Text>
            </View>
          </View>

          <View style={styles.controlPhoneRow}>
            <Text style={styles.controlPhoneNumber}>1800-425-5151</Text>
            <Pressable
              onPress={() => handleCall('18004255151')}
              accessibilityRole="button"
              accessibilityLabel="Call control room 18004255151"
              style={({ pressed }) => [
                styles.controlCallBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <AppIcon
                name={{ ios: 'phone.fill', android: 'call', web: 'phone' }}
                size={14}
                color="#FFFFFF"
              />
              <Text style={styles.controlCallBtnText}>{t('callNow')}</Text>
            </Pressable>
          </View>
        </View>

        {/* Section Title */}
        <Text style={[styles.sectionHeading, { color: colors.text }]}>
          {t('emergencyHotlines')}
        </Text>

        {/* Hotlines Grid */}
        <View style={styles.hotlinesGrid}>
          {HOTLINES.map((h, index) => (
            <View
              key={index}
              style={[
                styles.hotlineCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
                Shadows.card,
              ]}
            >
              <View style={styles.hotlineTopRow}>
                <View style={[styles.hotlineIconBadge, { backgroundColor: h.badgeColor + '20' }]}>
                  <AppIcon name={h.icon} size={18} color={h.badgeColor} />
                </View>
                <View style={[styles.badgePill, { backgroundColor: h.badgeColor }]}>
                  <Text style={styles.badgeText}>{h.badge}</Text>
                </View>
              </View>

              <Text style={[styles.hotlineTitle, { color: colors.text }]}>
                {lang === 'te' ? h.titleTe : h.titleEn}
              </Text>

              <Text style={[styles.hotlineDesc, { color: colors.textSecondary }]}>
                {lang === 'te' ? h.descTe : h.descEn}
              </Text>

              <Pressable
                onPress={() => handleCall(h.phone)}
                accessibilityRole="button"
                accessibilityLabel={`Call ${h.badge}`}
                style={({ pressed }) => [
                  styles.callButton,
                  { backgroundColor: h.badgeColor },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <AppIcon
                  name={{ ios: 'phone.fill', android: 'call', web: 'phone' }}
                  size={14}
                  color="#FFFFFF"
                />
                <Text style={styles.callButtonText}>
                  {lang === 'te' ? `${h.phone} కి కాల్ చేయండి` : `Call ${h.phone}`}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        {/* View Hospital Directory Button */}
        <Pressable
          onPress={handleOpenHospitals}
          accessibilityRole="button"
          accessibilityLabel="View verified hospital listings"
          style={({ pressed }) => [
            styles.hospitalBanner,
            { backgroundColor: colors.secondary, borderColor: colors.border },
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={[styles.hospitalIconCircle, { backgroundColor: colors.primaryLight }]}>
            <AppIcon
              name={{ ios: 'cross.case.fill', android: 'medical_services', web: 'medkit' }}
              size={20}
              color={colors.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.hospitalBannerTitle, { color: colors.text }]}>
              {lang === 'te'
                ? 'ఆసుపత్రులు & వైద్య సేవల వివరాలు'
                : 'Verified Hospitals & Medical Centers'}
            </Text>
            <Text style={[styles.hospitalBannerSub, { color: colors.textSecondary }]}>
              {lang === 'te'
                ? 'రాజమండ్రి & కొవ్వూరులో అందుబాటులో ఉన్న ఆసుపత్రులు'
                : 'Browse real listings, phone contacts, and directions'}
            </Text>
          </View>
          <AppIcon
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron-right' }}
            size={16}
            color={colors.primary}
          />
        </Pressable>

        {/* River Safety Guidelines */}
        <View
          style={[
            styles.safetyCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            Shadows.card,
          ]}
        >
          <View style={styles.safetyHeader}>
            <AppIcon
              name={{ ios: 'info.circle.fill', android: 'info', web: 'info-circle' }}
              size={18}
              color={colors.primary}
            />
            <Text style={[styles.safetyTitle, { color: colors.text }]}>
              {t('safetyGuidelines')}
            </Text>
          </View>

          <View style={styles.guidelineRow}>
            <Text style={[styles.guideBullet, { color: colors.primary }]}>1.</Text>
            <Text style={[styles.guideText, { color: colors.textSecondary }]}>
              {lang === 'te'
                ? 'కేవలం భద్రతా బారికేడ్ల పరిధిలోనే పవిత్ర స్నానం చేయండి. లోతైన నీటి ప్రవాహాల వైపు వెళ్లవద్దు.'
                : 'Bathe strictly within marked iron barricades. Never swim past warning flags into deep river currents.'}
            </Text>
          </View>

          <View style={styles.guidelineRow}>
            <Text style={[styles.guideBullet, { color: colors.primary }]}>2.</Text>
            <Text style={[styles.guideText, { color: colors.textSecondary }]}>
              {lang === 'te'
                ? 'బోటు ప్రయాణాల్లో లైఫ్‌జాకెట్లు తప్పనిసరిగా ధరించండి. అనుమతి లేని బోట్లను ఎక్కకండి.'
                : 'Wearing life jackets is mandatory on all Godavari river boats. Avoid uncertified boat operators.'}
            </Text>
          </View>

          <View style={styles.guidelineRow}>
            <Text style={[styles.guideBullet, { color: colors.primary }]}>3.</Text>
            <Text style={[styles.guideText, { color: colors.textSecondary }]}>
              {lang === 'te'
                ? 'పిల్లలు, వృద్ధుల చేతులకు రక్షక సమాచార బ్యాండ్లు అమర్చండి. తప్పిపోతే వెంటనే హెల్ప్ డెస్క్‌ను సంప్రదించండి.'
                : 'Equip children and senior citizens with identification wristbands. In case of separation, notify Sector Desks.'}
            </Text>
          </View>

          <View style={styles.guidelineRow}>
            <Text style={[styles.guideBullet, { color: colors.primary }]}>4.</Text>
            <Text style={[styles.guideText, { color: colors.textSecondary }]}>
              {lang === 'te'
                ? 'ఘాట్‌ల వద్ద తొక్కిసలాట జరగకుండా ఎప్పటికప్పుడు ముందుకు కదలండి. అధికారుల సైరన్ సూచనలు పాటించండి.'
                : 'Keep moving steadily through bathing platforms to prevent bottlenecks. Obey siren and lifeguard signals.'}
            </Text>
          </View>
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
  },
  screenTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  scrollContent: {
    padding: Spacing.four,
    gap: 16,
  },
  controlRoomCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: Spacing.four,
    gap: 14,
  },
  controlHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  controlIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlRoomTitle: {
    color: '#991B1B',
    fontSize: 16,
    fontWeight: '800',
  },
  controlRoomSub: {
    color: '#B91C1C',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  controlPhoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  controlPhoneNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#991B1B',
    letterSpacing: 0.5,
  },
  controlCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  controlCallBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
  },
  hotlinesGrid: {
    gap: 12,
  },
  hotlineCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
    gap: 8,
  },
  hotlineTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hotlineIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  hotlineTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  hotlineDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 4,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  hospitalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
  },
  hospitalIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hospitalBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  hospitalBannerSub: {
    fontSize: 11,
    marginTop: 2,
  },
  safetyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
    gap: 12,
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  safetyTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  guidelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  guideBullet: {
    fontSize: 13,
    fontWeight: '800',
  },
  guideText: {
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
});

