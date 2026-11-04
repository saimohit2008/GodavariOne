import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useApp } from '@/context/app-context';
import { Spacing, BottomTabInset, Shadows } from '@/constants/theme';
import { EmptyState } from '@/components/ui/EmptyState';
import { AppIcon } from '@/components/ui/AppIcon';
import { getPriorityBookings } from '@/services/api';
import { PriorityBookingItem } from '@/types';
import { AuthModal } from '@/components/ui/AuthModal';
import { PriorityBookingModal } from '@/components/ui/PriorityBookingModal';
import { DigitalPassModal } from '@/components/ui/DigitalPassModal';
import { getCachedBookings, waitForStorageInit } from '@/lib/storage';

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ apply?: string; view?: string }>();
  const { lang, colors, isDark, t, user } = useApp();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [bookings, setBookings] = useState<PriorityBookingItem[]>([]);
  const [statusTab, setStatusTab] = useState<'ALL' | 'PENDING' | 'VERIFIED'>('ALL');
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [selectedPass, setSelectedPass] = useState<PriorityBookingItem | null>(null);
  const [passModalVisible, setPassModalVisible] = useState(false);
  const [submittedAppNum, setSubmittedAppNum] = useState<string | null>(null);

  useEffect(() => {
    if (params?.apply === 'true') {
      setBookingModalVisible(true);
    }
  }, [params?.apply]);

  useEffect(() => {
    if (params?.view) {
      const all = bookings.length > 0 ? bookings : getCachedBookings() || [];
      const found = all.find(
        (b) => b.applicationNumber === params.view || b.id === params.view
      );
      if (found) {
        setSelectedPass(found);
        setPassModalVisible(true);
      }
    }
  }, [params?.view, bookings]);

  const loadBookings = useCallback(async () => {
    if (!user) {
      await waitForStorageInit();
      const cached = getCachedBookings();
      if (cached && cached.length > 0) {
        setBookings(cached);
      } else {
        setBookings([]);
      }
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoading(true);
    try {
      const res = await getPriorityBookings();
      setBookings(res.data);
    } catch {
      // safe fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadBookings();
  }, [loadBookings]);

  const handleApplyPress = () => {
    if (!user) {
      setAuthModalVisible(true);
    } else {
      setBookingModalVisible(true);
    }
  };

  const handleBookingSuccess = (appNum: string) => {
    setSubmittedAppNum(appNum);
    loadBookings();
  };

  // Filter bookings based on active status tab
  const filteredBookings = useMemo(() => {
    if (statusTab === 'ALL') return bookings;
    if (statusTab === 'PENDING') return bookings.filter((b) => b.status === 'PENDING_REVIEW');
    if (statusTab === 'VERIFIED') return bookings.filter((b) => b.status === 'VERIFIED' || b.status === 'CHECKED_IN');
    return bookings;
  }, [bookings, statusTab]);

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
        <View style={styles.headerTopRow}>
          <View style={styles.titleWithIcon}>
            <View style={[styles.iconBox, { backgroundColor: colors.primaryLight }]}>
              <AppIcon
                name={{ ios: 'ticket.fill', android: 'confirmation_number', web: 'ticket-alt' }}
                size={18}
                color={colors.primary}
              />
            </View>
            <View>
              <Text style={[styles.screenTitle, { color: colors.text }]}>{t('bookings')}</Text>
              <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
                {t('myBookings')}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleApplyPress}
            accessibilityRole="button"
            accessibilityLabel="Apply for priority pass"
            style={({ pressed }) => [
              styles.applyHeaderBtn,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.85 },
            ]}
          >
            <AppIcon
              name={{ ios: 'plus', android: 'add', web: 'plus' }}
              size={14}
              color="#FFFFFF"
            />
            <Text style={styles.applyHeaderBtnText}>
              {lang === 'te' ? 'కొత్త పాస్' : 'Apply Pass'}
            </Text>
          </Pressable>
        </View>

        {/* Status Filter Tabs (when signed in) */}
        {user && bookings.length > 0 && (
          <View style={[styles.tabBarRow, { backgroundColor: colors.secondary }]}>
            {(['ALL', 'PENDING', 'VERIFIED'] as const).map((tab) => {
              const isSelected = statusTab === tab;
              const label =
                tab === 'ALL'
                  ? lang === 'te' ? 'అన్నీ' : 'All Passes'
                  : tab === 'PENDING'
                  ? lang === 'te' ? 'పరిశీలనలో' : 'Pending'
                  : lang === 'te' ? 'ధృవీకరించబడినవి' : 'Verified';
              return (
                <Pressable
                  key={tab}
                  onPress={() => setStatusTab(tab)}
                  style={[
                    styles.tabItem,
                    isSelected && [styles.activeTabItem, { backgroundColor: colors.card }],
                  ]}
                >
                  <Text
                    style={[
                      styles.tabItemText,
                      { color: isSelected ? colors.primary : colors.textSecondary },
                      isSelected && styles.activeTabItemText,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
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
        {/* Success Alert Banner if an application was just submitted */}
        {submittedAppNum && (
          <View style={[styles.successBanner, { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' }]}>
            <View style={styles.bannerIconRow}>
              <AppIcon
                name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check-circle' }}
                size={18}
                color="#059669"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.successBannerTitle}>
                  {lang === 'te' ? 'దరఖాస్తు సమర్పించబడింది!' : 'Application Submitted!'}
                </Text>
                <Text style={styles.successBannerBody}>
                  {lang === 'te'
                    ? `మీ దరఖాస్తు సంఖ్య: ${submittedAppNum}. ఘాట్ పర్యవేక్షకుల సమీక్ష తర్వాత పాస్ జారీ చేయబడుతుంది.`
                    : `Application Reference: ${submittedAppNum}. Supervisor review in progress.`}
                </Text>
              </View>
              <Pressable onPress={() => setSubmittedAppNum(null)} hitSlop={8}>
                <AppIcon name={{ ios: 'xmark', android: 'close', web: 'times' }} size={14} color="#065F46" />
              </Pressable>
            </View>
          </View>
        )}

        {/* Guest View: Explanatory Banner & Sign-In Prompts */}
        {!user ? (
          <>
            {/* Priority Pass Overview Card */}
            <View
              style={[
                styles.previewSection,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
                Shadows.card,
              ]}
            >
              <View style={styles.previewHeader}>
                <View style={[styles.passIconCircle, { backgroundColor: '#FDE68A' }]}>
                  <AppIcon
                    name={{ ios: 'star.circle.fill', android: 'military_tech', web: 'star' }}
                    size={20}
                    color="#B45309"
                  />
                </View>
                <View style={styles.previewTextCol}>
                  <Text style={[styles.previewHeading, { color: colors.text }]}>
                    {t('priorityPassInfo')}
                  </Text>
                  <Text style={[styles.previewSubtext, { color: colors.textSecondary }]}>
                    {t('priorityPassDesc')}
                  </Text>
                </View>
              </View>

              <View style={styles.passFeaturesList}>
                <View style={styles.passFeatureRow}>
                  <Text style={[styles.checkIcon, { color: colors.primary }]}>✓</Text>
                  <Text style={[styles.featureText, { color: colors.text }]}>
                    {lang === 'te'
                      ? 'సీనియర్ సిటిజన్లు (65+) కోసం ప్రత్యేక క్యూ లైన్ పాస్'
                      : 'Dedicated senior citizen (65+) quick-access bathing pass'}
                  </Text>
                </View>
                <View style={styles.passFeatureRow}>
                  <Text style={[styles.checkIcon, { color: colors.primary }]}>✓</Text>
                  <Text style={[styles.featureText, { color: colors.text }]}>
                    {lang === 'te'
                      ? 'దివ్యాంగుల కోసం ఉచిత వీల్‌చైర్ & బ్యాటరీ వెహికల్ నమోదు'
                      : 'Free wheelchair assistance & battery cart reservation'}
                  </Text>
                </View>
                <View style={styles.passFeatureRow}>
                  <Text style={[styles.checkIcon, { color: colors.primary }]}>✓</Text>
                  <Text style={[styles.featureText, { color: colors.text }]}>
                    {lang === 'te'
                      ? 'డిజిటల్ క్యూఆర్ కోడ్ ఎంట్రీ ధృవీకరణ మరియు సేవా సహాయం'
                      : 'Digital QR-code pass verification at pushkar ghats'}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={handleApplyPress}
                accessibilityRole="button"
                accessibilityLabel="Sign in or apply"
                style={({ pressed }) => [
                  styles.guestCtaButton,
                  { backgroundColor: colors.primary },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <AppIcon
                  name={{ ios: 'lock.open.fill', android: 'login', web: 'sign-in-alt' }}
                  size={16}
                  color="#FFFFFF"
                />
                <Text style={styles.guestCtaButtonText}>
                  {lang === 'te'
                    ? 'పాస్ కోసం లాగిన్ అవ్వండి / దరఖాస్తు చేయండి'
                    : 'Sign In to Apply for Priority Pass'}
                </Text>
              </Pressable>
            </View>

            {/* Empty State */}
            <EmptyState
              title={t('noBookings')}
              message={t('noBookingsHint')}
              icon={
                <AppIcon
                  name={{ ios: 'calendar.badge.clock', android: 'event_busy', web: 'calendar-times' }}
                  size={48}
                  color={colors.textSecondary}
                />
              }
              actionLabel={t('explore')}
              onAction={() => router.push('/explore')}
            />
          </>
        ) : loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loaderText, { color: colors.textSecondary }]}>
              {t('loading')}
            </Text>
          </View>
        ) : filteredBookings.length === 0 ? (
          <EmptyState
            title={t('noBookings')}
            message={
              lang === 'te'
                ? 'మీరు ఇంకా ఎటువంటి ప్రాధాన్యత పాస్‌లను నమోదు చేయలేదు.'
                : 'You do not have any active passes in this category.'
            }
            icon={
              <AppIcon
                name={{ ios: 'ticket', android: 'confirmation_number', web: 'ticket-alt' }}
                size={48}
                color={colors.textMuted}
              />
            }
            actionLabel={t('applyPriorityPass')}
            onAction={handleApplyPress}
          />
        ) : (
          filteredBookings.map((booking) => {
            const isVerified = booking.status === 'VERIFIED' || booking.status === 'CHECKED_IN';
            const isPending = booking.status === 'PENDING_REVIEW';
            const isRejected = booking.status === 'REJECTED';

            const statusBg = isVerified ? '#D1FAE5' : isPending ? '#FEF3C7' : isRejected ? '#FEE2E2' : colors.secondary;
            const statusTextColor = isVerified ? '#065F46' : isPending ? '#92400E' : isRejected ? '#991B1B' : colors.text;

            const statusLabel =
              booking.status === 'VERIFIED'
                ? lang === 'te' ? 'ధృవీకరించబడింది' : 'VERIFIED PASS'
                : booking.status === 'CHECKED_IN'
                ? lang === 'te' ? 'ప్రవేశించారు' : 'CHECKED IN'
                : booking.status === 'PENDING_REVIEW'
                ? lang === 'te' ? 'పరిశీలనలో ఉంది' : 'PENDING REVIEW'
                : booking.status;

            return (
              <View
                key={booking.id}
                style={[
                  styles.ticketCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isVerified ? '#10B981' : colors.border,
                  },
                  Shadows.card,
                ]}
              >
                {/* Ticket Header Row */}
                <View style={styles.ticketHeaderRow}>
                  <View style={styles.refCol}>
                    <Text style={[styles.refLabel, { color: colors.textMuted }]}>
                      {lang === 'te' ? 'దరఖాస్తు సంఖ్య' : 'REFERENCE'}
                    </Text>
                    <Text style={[styles.refValue, { color: colors.text }]}>
                      {booking.applicationNumber}
                    </Text>
                  </View>

                  <View style={[styles.ticketStatusBadge, { backgroundColor: statusBg }]}>
                    <Text style={[styles.ticketStatusText, { color: statusTextColor }]}>
                      {statusLabel}
                    </Text>
                  </View>
                </View>

                {/* Dashed Separator */}
                <View style={[styles.dashedDivider, { borderColor: colors.border }]} />

                {/* Ticket Details Body */}
                <View style={styles.ticketBody}>
                  {/* Ghat & Location */}
                  <View style={styles.ticketDetailRow}>
                    <AppIcon
                      name={{ ios: 'water.waves', android: 'water', web: 'waves' }}
                      size={16}
                      color={colors.primary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.ticketGhatName, { color: colors.text }]}>
                        {booking.ghat?.name || 'Godavari Pushkar Ghat'}
                      </Text>
                      <Text style={[styles.ticketGhatLocation, { color: colors.textSecondary }]}>
                        {[booking.ghat?.locality, booking.ghat?.town, booking.ghat?.district].filter(Boolean).join(', ') || 'Rajahmundry, Andhra Pradesh'}
                      </Text>
                    </View>
                  </View>

                  {/* Visit Date & Slot */}
                  <View style={styles.ticketDetailRow}>
                    <AppIcon
                      name={{ ios: 'calendar', android: 'calendar_today', web: 'calendar' }}
                      size={16}
                      color={colors.primary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.ticketMetaText, { color: colors.text }]}>
                        {lang === 'te' ? 'దర్శన తేదీ: ' : 'Visit Date: '}
                        <Text style={{ fontWeight: '700' }}>{booking.visitDate}</Text>
                      </Text>
                      {booking.timeSlot && (
                        <Text style={[styles.ticketSlotText, { color: colors.textSecondary }]}>
                          {booking.timeSlot.startTime} - {booking.timeSlot.endTime}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Beneficiary & Accompanying */}
                  <View style={styles.ticketDetailRow}>
                    <AppIcon
                      name={{ ios: 'person.fill', android: 'person', web: 'user' }}
                      size={16}
                      color={colors.primary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.ticketMetaText, { color: colors.text }]}>
                        {booking.beneficiaryName}
                        <Text style={{ color: colors.textMuted }}>
                          {` · ${booking.category === 'SENIOR_CITIZEN' ? (lang === 'te' ? 'సీనియర్ సిటిజన్' : 'Senior 65+') : (lang === 'te' ? 'దివ్యాంగులు' : 'PWD')}`}
                        </Text>
                      </Text>
                      <Text style={[styles.ticketSubMeta, { color: colors.textSecondary }]}>
                        {lang === 'te'
                          ? `తోడుగా: ${booking.accompanyingCount} సహాయకుడు`
                          : `Companions: +${booking.accompanyingCount} attendant(s)`}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Verified Digital Pass Footer with QR Entry Pass Code */}
                {isVerified && (
                  <View style={[styles.qrPassBox, { backgroundColor: isDark ? '#1F2A38' : '#EFF6FF', borderColor: '#BFDBFE' }]}>
                    <View style={styles.qrRow}>
                      <View style={styles.qrIconBadge}>
                        <AppIcon
                          name={{ ios: 'qrcode', android: 'qr_code', web: 'qrcode' }}
                          size={24}
                          color="#2563EB"
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.qrPassTitle}>
                          {lang === 'te' ? 'డిజిటల్ క్యూఆర్ ఎంట్రీ పాస్' : 'Digital QR Entry Pass Ready'}
                        </Text>
                        <Text style={styles.qrPassDesc}>
                          {lang === 'te'
                            ? 'ఘాట్ ప్రవేశ ద్వారం వద్ద సిబ్బందికి ఈ దరఖాస్తు సంఖ్యను చూపించండి.'
                            : 'Present this digital pass at the priority queue entrance for scanning.'}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* View Full Digital Pass Button */}
                <Pressable
                  onPress={() => {
                    setSelectedPass(booking);
                    setPassModalVisible(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="View full digital pass and QR code"
                  style={({ pressed }) => [
                    styles.viewPassActionBtn,
                    { backgroundColor: colors.secondary },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <AppIcon
                    name={{ ios: 'qrcode', android: 'qr_code', web: 'qrcode' }}
                    size={15}
                    color={colors.primary}
                  />
                  <Text style={[styles.viewPassActionText, { color: colors.primary }]}>
                    {lang === 'te' ? 'పూర్తి డిజిటల్ పాస్ చూడండి' : 'View Full Digital Pass & QR'}
                  </Text>
                  <AppIcon
                    name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron-right' }}
                    size={14}
                    color={colors.primary}
                  />
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Auth Modal for signing in / registering */}
      <AuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        onSuccess={() => {
          setAuthModalVisible(false);
          loadBookings();
        }}
      />

      {/* Priority Booking Form Modal */}
      <PriorityBookingModal
        visible={bookingModalVisible}
        onClose={() => setBookingModalVisible(false)}
        onSuccess={handleBookingSuccess}
      />

      {/* Digital Entry Pass Modal */}
      <DigitalPassModal
        visible={passModalVisible}
        pass={selectedPass}
        onClose={() => {
          setPassModalVisible(false);
          setSelectedPass(null);
        }}
        onCheckInSuccess={() => {
          loadBookings();
        }}
      />
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
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
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
  applyHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  applyHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  tabBarRow: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginTop: 6,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTabItem: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabItemText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeTabItemText: {
    fontWeight: '800',
  },
  contentScroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  successBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.three,
  },
  bannerIconRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  successBannerTitle: {
    color: '#065F46',
    fontSize: 13,
    fontWeight: '800',
  },
  successBannerBody: {
    color: '#047857',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  previewSection: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  passIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTextCol: {
    flex: 1,
    gap: 2,
  },
  previewHeading: {
    fontSize: 15,
    fontWeight: '700',
  },
  previewSubtext: {
    fontSize: 11,
    lineHeight: 15,
  },
  passFeaturesList: {
    gap: 8,
    paddingVertical: 4,
  },
  passFeatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  checkIcon: {
    fontSize: 14,
    fontWeight: '800',
  },
  featureText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  guestCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  guestCtaButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  ticketCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: Spacing.four,
    gap: 12,
  },
  ticketHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refCol: {
    gap: 2,
  },
  refLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  refValue: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  ticketStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ticketStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  dashedDivider: {
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    marginVertical: 2,
  },
  ticketBody: {
    gap: 10,
  },
  ticketDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  ticketGhatName: {
    fontSize: 14,
    fontWeight: '700',
  },
  ticketGhatLocation: {
    fontSize: 11,
    marginTop: 1,
  },
  ticketMetaText: {
    fontSize: 13,
  },
  ticketSlotText: {
    fontSize: 11,
    marginTop: 1,
  },
  ticketSubMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  qrPassBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    marginTop: 4,
  },
  qrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qrIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPassTitle: {
    color: '#1E40AF',
    fontSize: 12,
    fontWeight: '700',
  },
  qrPassDesc: {
    color: '#3B82F6',
    fontSize: 10,
    lineHeight: 14,
    marginTop: 1,
  },
  viewPassActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  viewPassActionText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    marginLeft: 8,
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
