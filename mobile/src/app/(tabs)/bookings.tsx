import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useApp } from '@/context/app-context';
import { Spacing, BottomTabInset, Shadows } from '@/constants/theme';
import { EmptyState } from '@/components/ui/EmptyState';
import { AppIcon } from '@/components/ui/AppIcon';
import {
  getPriorityBookings,
  cancelPriorityBooking,
  getHotelBookings,
  cancelHotelBooking,
  getRestaurantBookings,
  cancelRestaurantBooking,
  getAccommodationBookings,
  cancelAccommodationBooking,
} from '@/services/api';
import {
  PriorityBookingItem,
  HotelBookingItem,
  RestaurantBookingItem,
  AccommodationBookingItem,
} from '@/types';
import { AuthModal } from '@/components/ui/AuthModal';
import { PriorityBookingModal } from '@/components/ui/PriorityBookingModal';
import { DigitalPassModal } from '@/components/ui/DigitalPassModal';
import { getCachedBookings, waitForStorageInit } from '@/lib/storage';

type BookingCategoryTab = 'GHAT' | 'HOTEL' | 'DINING' | 'STAYS';

export default function BookingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ apply?: string; view?: string; category?: string }>();
  const { lang, colors, isDark, t, user } = useApp();

  const [bookingCategory, setBookingCategory] = useState<BookingCategoryTab>(
    (params?.category as BookingCategoryTab) || 'GHAT'
  );
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Four categories of bookings
  const [ghatBookings, setGhatBookings] = useState<PriorityBookingItem[]>([]);
  const [hotelBookings, setHotelBookings] = useState<HotelBookingItem[]>([]);
  const [restaurantBookings, setRestaurantBookings] = useState<RestaurantBookingItem[]>([]);
  const [accommodationBookings, setAccommodationBookings] = useState<AccommodationBookingItem[]>([]);

  const [statusTab, setStatusTab] = useState<'ALL' | 'PENDING' | 'CONFIRMED' | 'CANCELLED'>('ALL');
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [selectedPass, setSelectedPass] = useState<PriorityBookingItem | null>(null);
  const [passModalVisible, setPassModalVisible] = useState(false);
  const [submittedAppNum, setSubmittedAppNum] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (params?.apply === 'true') {
      setBookingModalVisible(true);
    }
  }, [params?.apply]);

  useEffect(() => {
    if (params?.view) {
      const all = ghatBookings.length > 0 ? ghatBookings : getCachedBookings() || [];
      const found = all.find(
        (b) => b.applicationNumber === params.view || b.id === params.view
      );
      if (found) {
        setSelectedPass(found);
        setPassModalVisible(true);
      }
    }
  }, [params?.view, ghatBookings]);

  const loadBookings = useCallback(async () => {
    if (!user) {
      await waitForStorageInit();
      const cached = getCachedBookings();
      if (cached && cached.length > 0) {
        setGhatBookings(cached);
      } else {
        setGhatBookings([]);
      }
      setHotelBookings([]);
      setRestaurantBookings([]);
      setAccommodationBookings([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setLoading(true);
    try {
      const [ghatRes, hotelRes, restRes, accRes] = await Promise.allSettled([
        getPriorityBookings(),
        getHotelBookings(),
        getRestaurantBookings(),
        getAccommodationBookings(),
      ]);

      if (ghatRes.status === 'fulfilled' && ghatRes.value.data) {
        setGhatBookings(ghatRes.value.data);
      }
      if (hotelRes.status === 'fulfilled' && hotelRes.value.data) {
        setHotelBookings(hotelRes.value.data);
      }
      if (restRes.status === 'fulfilled' && restRes.value.data) {
        setRestaurantBookings(restRes.value.data);
      }
      if (accRes.status === 'fulfilled' && accRes.value.data) {
        setAccommodationBookings(accRes.value.data);
      }
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
      return;
    }
    if (bookingCategory === 'GHAT') {
      setBookingModalVisible(true);
    } else if (bookingCategory === 'HOTEL') {
      router.push({ pathname: '/category/[id]', params: { id: 'HOTEL' } } as any);
    } else if (bookingCategory === 'DINING') {
      router.push({ pathname: '/category/[id]', params: { id: 'RESTAURANT' } } as any);
    } else if (bookingCategory === 'STAYS') {
      router.push({ pathname: '/category/[id]', params: { id: 'FREE_ACCOMMODATION' } } as any);
    }
  };

  const handleBookingSuccess = (appNum: string) => {
    setSubmittedAppNum(appNum);
    loadBookings();
  };

  const handleCancelGhatBooking = (booking: PriorityBookingItem) => {
    Alert.alert(
      lang === 'te' ? 'పాస్ రద్దు చేయాలా?' : 'Cancel Application?',
      lang === 'te'
        ? `${booking.applicationNumber} దరఖాస్తును మీరు రద్దు చేయాలనుకుంటున్నారా?`
        : `Are you sure you want to cancel pass application ${booking.applicationNumber}?`,
      [
        { text: lang === 'te' ? 'వద్దు' : 'Keep Pass', style: 'cancel' },
        {
          text: lang === 'te' ? 'అవును, రద్దు చేయి' : 'Yes, Cancel Pass',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(booking.id);
            try {
              const res = await cancelPriorityBooking(booking.id);
              if (res.error) {
                Alert.alert(lang === 'te' ? 'లోపం' : 'Error', res.error);
              } else {
                Alert.alert(
                  lang === 'te' ? 'రద్దు చేయబడింది' : 'Pass Cancelled',
                  lang === 'te'
                    ? 'మీ ప్రాధాన్యత పాస్ దరఖాస్తు విజయవంతంగా రద్దు చేయబడింది.'
                    : 'Your priority pass application has been cancelled.'
                );
                loadBookings();
              }
            } catch (err: any) {
              Alert.alert(lang === 'te' ? 'లోపం' : 'Error', err?.message || 'Failed to cancel');
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  const handleCancelHotel = (id: string, name?: string) => {
    Alert.alert(
      lang === 'te' ? 'హోటల్ బుకింగ్ రద్దు చేయాలా?' : 'Cancel Hotel Booking?',
      lang === 'te'
        ? `${name || 'ఈ హోటల్'} గది రిజర్వేషన్‌ను రద్దు చేయాలనుకుంటున్నారా?`
        : `Cancel room reservation for ${name || 'this hotel'}?`,
      [
        { text: lang === 'te' ? 'వద్దు' : 'Keep', style: 'cancel' },
        {
          text: lang === 'te' ? 'అవును, రద్దు చేయి' : 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(id);
            try {
              const res = await cancelHotelBooking(id);
              if (res.error) {
                Alert.alert(lang === 'te' ? 'లోపం' : 'Error', res.error);
              } else {
                Alert.alert(lang === 'te' ? 'రద్దు చేయబడింది' : 'Cancelled', 'Booking cancelled successfully.');
                loadBookings();
              }
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  const handleCancelRestaurant = (id: string, name?: string) => {
    Alert.alert(
      lang === 'te' ? 'టేబుల్ రద్దు చేయాలా?' : 'Cancel Restaurant Reservation?',
      lang === 'te'
        ? `${name || 'ఈ రెస్టారెంట్'} టేబుల్ రిజర్వేషన్‌ను రద్దు చేయాలనుకుంటున్నారా?`
        : `Cancel table reservation for ${name || 'this restaurant'}?`,
      [
        { text: lang === 'te' ? 'వద్దు' : 'Keep', style: 'cancel' },
        {
          text: lang === 'te' ? 'అవును, రద్దు చేయి' : 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(id);
            try {
              const res = await cancelRestaurantBooking(id);
              if (res.error) {
                Alert.alert(lang === 'te' ? 'లోపం' : 'Error', res.error);
              } else {
                Alert.alert(lang === 'te' ? 'రద్దు చేయబడింది' : 'Cancelled', 'Table reservation cancelled.');
                loadBookings();
              }
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  const handleCancelAccommodation = (id: string, name?: string) => {
    Alert.alert(
      lang === 'te' ? 'వసతి రద్దు చేయాలా?' : 'Cancel Free Stay?',
      lang === 'te'
        ? `${name || 'ఈ వసతి కేంద్రం'} రిజిస్ట్రేషన్‌ను రద్దు చేయాలనుకుంటున్నారా?`
        : `Cancel accommodation registration for ${name || 'this centre'}?`,
      [
        { text: lang === 'te' ? 'వద్దు' : 'Keep', style: 'cancel' },
        {
          text: lang === 'te' ? 'అవును, రద్దు చేయి' : 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(id);
            try {
              const res = await cancelAccommodationBooking(id);
              if (res.error) {
                Alert.alert(lang === 'te' ? 'లోపం' : 'Error', res.error);
              } else {
                Alert.alert(lang === 'te' ? 'రద్దు చేయబడింది' : 'Cancelled', 'Stay registration cancelled.');
                loadBookings();
              }
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  // Status Filter Predicates
  const filteredGhats = useMemo(() => {
    if (statusTab === 'ALL') return ghatBookings;
    if (statusTab === 'PENDING') return ghatBookings.filter((b) => b.status === 'PENDING_REVIEW' || b.status === 'SUBMITTED');
    if (statusTab === 'CONFIRMED') return ghatBookings.filter((b) => b.status === 'VERIFIED' || b.status === 'CHECKED_IN');
    if (statusTab === 'CANCELLED') return ghatBookings.filter((b) => b.status === 'CANCELLED' || b.status === 'REJECTED');
    return ghatBookings;
  }, [ghatBookings, statusTab]);

  const filteredHotels = useMemo(() => {
    if (statusTab === 'ALL') return hotelBookings;
    if (statusTab === 'PENDING') return hotelBookings.filter((b) => b.status === 'PENDING');
    if (statusTab === 'CONFIRMED') return hotelBookings.filter((b) => b.status === 'CONFIRMED');
    if (statusTab === 'CANCELLED') return hotelBookings.filter((b) => b.status === 'CANCELLED' || b.status === 'REJECTED');
    return hotelBookings;
  }, [hotelBookings, statusTab]);

  const filteredRestaurants = useMemo(() => {
    if (statusTab === 'ALL') return restaurantBookings;
    if (statusTab === 'PENDING') return restaurantBookings.filter((b) => b.status === 'PENDING');
    if (statusTab === 'CONFIRMED') return restaurantBookings.filter((b) => b.status === 'APPROVED');
    if (statusTab === 'CANCELLED') return restaurantBookings.filter((b) => b.status === 'CANCELLED' || b.status === 'REJECTED');
    return restaurantBookings;
  }, [restaurantBookings, statusTab]);

  const filteredStays = useMemo(() => {
    if (statusTab === 'ALL') return accommodationBookings;
    if (statusTab === 'PENDING') return accommodationBookings.filter((b) => b.status === 'PENDING');
    if (statusTab === 'CONFIRMED') return accommodationBookings.filter((b) => b.status === 'CONFIRMED');
    if (statusTab === 'CANCELLED') return accommodationBookings.filter((b) => b.status === 'CANCELLED');
    return accommodationBookings;
  }, [accommodationBookings, statusTab]);

  const currentCount =
    bookingCategory === 'GHAT'
      ? filteredGhats.length
      : bookingCategory === 'HOTEL'
      ? filteredHotels.length
      : bookingCategory === 'DINING'
      ? filteredRestaurants.length
      : filteredStays.length;

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
                {lang === 'te' ? 'మీ పుష్కరాల బుకింగ్‌లు & పాస్‌లు' : 'My Pushkaralu Passes & Bookings'}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleApplyPress}
            accessibilityRole="button"
            accessibilityLabel="New Booking"
            style={({ pressed }) => [
              styles.applyHeaderBtn,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.85 },
            ]}
          >
            <AppIcon name={{ ios: 'plus', android: 'add', web: 'plus' }} size={14} color="#FFFFFF" />
            <Text style={styles.applyHeaderBtnText}>
              {bookingCategory === 'GHAT'
                ? lang === 'te' ? 'కొత్త పాస్' : 'Apply Pass'
                : lang === 'te' ? 'కొత్త బుకింగ్' : 'New Booking'}
            </Text>
          </Pressable>
        </View>

        {/* Category Switcher Tabs */}
        <View style={[styles.categoryTabBar, { backgroundColor: colors.secondary }]}>
          {(
            [
              { id: 'GHAT', label: lang === 'te' ? 'ఘాట్ పాస్‌లు' : 'Ghat Passes', icon: 'water' },
              { id: 'HOTEL', label: lang === 'te' ? 'హోటళ్లు' : 'Hotels', icon: 'hotel' },
              { id: 'DINING', label: lang === 'te' ? 'భోజనం' : 'Dining', icon: 'restaurant' },
              { id: 'STAYS', label: lang === 'te' ? 'ఉచిత వసతి' : 'Free Stays', icon: 'home' },
            ] as const
          ).map((cat) => {
            const isSelected = bookingCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setBookingCategory(cat.id)}
                style={[
                  styles.categoryTabItem,
                  isSelected && [styles.activeCategoryTab, { backgroundColor: colors.card }],
                ]}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    { color: isSelected ? colors.primary : colors.textSecondary },
                    isSelected && { fontWeight: '700' },
                  ]}
                  numberOfLines={1}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Status Filter Pills */}
        {user && (
          <View style={styles.statusPillsRow}>
            {(
              [
                { id: 'ALL', label: lang === 'te' ? 'అన్నీ' : 'All' },
                { id: 'PENDING', label: lang === 'te' ? 'పరిశీలనలో' : 'Pending' },
                { id: 'CONFIRMED', label: lang === 'te' ? 'ధృవీకరించబడినవి' : 'Confirmed' },
                { id: 'CANCELLED', label: lang === 'te' ? 'రద్దు చేసినవి' : 'Cancelled' },
              ] as const
            ).map((pill) => {
              const isSelected = statusTab === pill.id;
              return (
                <Pressable
                  key={pill.id}
                  onPress={() => setStatusTab(pill.id)}
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                    ]}
                  >
                    {pill.label}
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
        {/* Success Alert Banner */}
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

        {/* Guest View: Sign In Prompts */}
        {!user ? (
          <View
            style={[
              styles.previewSection,
              { backgroundColor: colors.card, borderColor: colors.border },
              Shadows.card,
            ]}
          >
            <View style={styles.previewHeader}>
              <View style={[styles.passIconCircle, { backgroundColor: '#FDE68A' }]}>
                <AppIcon
                  name={{ ios: 'ticket.fill', android: 'confirmation_number', web: 'ticket-alt' }}
                  size={24}
                  color="#B45309"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.previewTitle, { color: colors.text }]}>
                  {lang === 'te' ? 'పుష్కరాల బుకింగ్‌ల డెస్క్' : 'Pushkaralu Bookings Portal'}
                </Text>
                <Text style={[styles.previewSub, { color: colors.textSecondary }]}>
                  {lang === 'te'
                    ? 'మీ పాస్‌లు, హోటల్ గదులు మరియు భోజన రిజర్వేషన్లను ఒకే చోట నిర్వహించండి.'
                    : 'Manage your ghat priority passes, hotel reservations, and table bookings in one place.'}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => setAuthModalVisible(true)}
              style={[styles.signInPrimaryBtn, { backgroundColor: colors.primary }]}
            >
              <AppIcon name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} size={16} color="#FFFFFF" />
              <Text style={styles.signInPrimaryBtnText}>
                {lang === 'te' ? 'లాగిన్ లేదా రిజిస్టర్ అవ్వండి' : 'Sign In with Email OTP'}
              </Text>
            </Pressable>
          </View>
        ) : loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loaderText, { color: colors.textSecondary }]}>
              {t('loading')}
            </Text>
          </View>
        ) : currentCount === 0 ? (
          <EmptyState
            title={lang === 'te' ? 'బుకింగ్‌లు లేవు' : 'No Active Bookings'}
            message={
              lang === 'te'
                ? 'ఈ విభాగంలో మీకు ఎటువంటి నమోదిత బుకింగ్‌లు లేవు. కొత్తది ప్రారంభించడానికి క్రింది బటన్ నొక్కండి.'
                : 'You do not have any active bookings in this category.'
            }
            actionLabel={
              bookingCategory === 'GHAT'
                ? lang === 'te' ? 'పాస్ దరఖాస్తు చేయండి' : 'Apply for Priority Pass'
                : lang === 'te' ? 'అన్వేషించండి' : 'Browse Services'
            }
            onAction={handleApplyPress}
          />
        ) : bookingCategory === 'GHAT' ? (
          filteredGhats.map((booking) => {
            const isVerified = booking.status === 'VERIFIED' || booking.status === 'CHECKED_IN';
            const isPending = booking.status === 'PENDING_REVIEW' || booking.status === 'SUBMITTED';
            const isCancelled = booking.status === 'CANCELLED' || booking.status === 'REJECTED';

            const statusBg = isVerified ? '#D1FAE5' : isPending ? '#FEF3C7' : '#FEE2E2';
            const statusTextColor = isVerified ? '#065F46' : isPending ? '#92400E' : '#991B1B';

            return (
              <View
                key={booking.id}
                style={[
                  styles.ticketCard,
                  { backgroundColor: colors.card, borderColor: isVerified ? '#10B981' : colors.border },
                  Shadows.card,
                ]}
              >
                <View style={styles.ticketHeaderRow}>
                  <View style={styles.refCol}>
                    <Text style={[styles.refLabel, { color: colors.textMuted }]}>
                      {lang === 'te' ? 'పాస్ నంబర్' : 'PASS REF'}
                    </Text>
                    <Text style={[styles.refValue, { color: colors.text }]}>
                      {booking.applicationNumber}
                    </Text>
                  </View>
                  <View style={[styles.ticketStatusBadge, { backgroundColor: statusBg }]}>
                    <Text style={[styles.ticketStatusText, { color: statusTextColor }]}>
                      {booking.status}
                    </Text>
                  </View>
                </View>

                <View style={[styles.dashedDivider, { borderColor: colors.border }]} />

                <View style={styles.ticketBody}>
                  <Text style={[styles.ticketTitle, { color: colors.text }]}>
                    {booking.ghat?.name || 'Godavari Pushkar Ghat'}
                  </Text>
                  <Text style={[styles.ticketSub, { color: colors.textSecondary }]}>
                    {booking.visitDate} {booking.timeSlot ? `· ${booking.timeSlot.startTime} - ${booking.timeSlot.endTime}` : ''}
                  </Text>
                  <Text style={[styles.ticketSub, { color: colors.textSecondary, marginTop: 4 }]}>
                    {lang === 'te' ? 'లబ్ధిదారుడు:' : 'Pilgrim:'} {booking.beneficiaryName} ({booking.category})
                  </Text>
                </View>

                <View style={[styles.cardActionRow, { borderTopColor: colors.border }]}>
                  {isVerified && (
                    <Pressable
                      onPress={() => {
                        setSelectedPass(booking);
                        setPassModalVisible(true);
                      }}
                      style={[styles.qrPassBtn, { backgroundColor: '#10B981' }]}
                    >
                      <AppIcon name={{ ios: 'qrcode', android: 'qr_code', web: 'qrcode' }} size={14} color="#FFFFFF" />
                      <Text style={styles.qrPassBtnText}>{lang === 'te' ? 'డిజిటల్ QR పాస్' : 'View QR Pass'}</Text>
                    </Pressable>
                  )}
                  {!isCancelled && (
                    <Pressable
                      onPress={() => handleCancelGhatBooking(booking)}
                      disabled={cancellingId === booking.id}
                      style={[styles.cancelActionBtn, { borderColor: colors.border }]}
                    >
                      <Text style={styles.cancelActionText}>{lang === 'te' ? 'రద్దు చేయి' : 'Cancel'}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })
        ) : bookingCategory === 'HOTEL' ? (
          filteredHotels.map((item) => (
            <View
              key={item.id}
              style={[styles.ticketCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.card]}
            >
              <View style={styles.ticketHeaderRow}>
                <View style={styles.refCol}>
                  <Text style={[styles.refLabel, { color: colors.textMuted }]}>HOTEL BOOKING</Text>
                  <Text style={[styles.refValue, { color: colors.text }]}>#{item.id.slice(-8).toUpperCase()}</Text>
                </View>
                <View style={[styles.ticketStatusBadge, { backgroundColor: item.status === 'CONFIRMED' ? '#D1FAE5' : '#FEF3C7' }]}>
                  <Text style={[styles.ticketStatusText, { color: item.status === 'CONFIRMED' ? '#065F46' : '#92400E' }]}>{item.status}</Text>
                </View>
              </View>

              <View style={[styles.dashedDivider, { borderColor: colors.border }]} />

              <View style={styles.ticketBody}>
                <Text style={[styles.ticketTitle, { color: colors.text }]}>{item.listing?.name || 'Verified Hotel'}</Text>
                <Text style={[styles.ticketSub, { color: colors.textSecondary }]}>
                  {item.checkIn} → {item.checkOut}
                </Text>
                <Text style={[styles.ticketSub, { color: colors.textSecondary, marginTop: 4 }]}>
                  {item.guests} {lang === 'te' ? 'అతిథులు' : 'Guests'} ({item.rooms} {lang === 'te' ? 'గదులు' : 'Rooms'})
                </Text>
                {item.specialRequest && (
                  <Text style={[styles.ticketNotes, { color: colors.textMuted }]}>"{item.specialRequest}"</Text>
                )}
              </View>

              {item.status !== 'CANCELLED' && (
                <View style={[styles.cardActionRow, { borderTopColor: colors.border }]}>
                  <Pressable
                    onPress={() => handleCancelHotel(item.id, item.listing?.name)}
                    disabled={cancellingId === item.id}
                    style={[styles.cancelActionBtn, { borderColor: colors.border }]}
                  >
                    <Text style={styles.cancelActionText}>{lang === 'te' ? 'బుకింగ్ రద్దు చేయి' : 'Cancel Booking'}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))
        ) : bookingCategory === 'DINING' ? (
          filteredRestaurants.map((item) => (
            <View
              key={item.id}
              style={[styles.ticketCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.card]}
            >
              <View style={styles.ticketHeaderRow}>
                <View style={styles.refCol}>
                  <Text style={[styles.refLabel, { color: colors.textMuted }]}>TABLE RESERVATION</Text>
                  <Text style={[styles.refValue, { color: colors.text }]}>#{item.id.slice(-8).toUpperCase()}</Text>
                </View>
                <View style={[styles.ticketStatusBadge, { backgroundColor: item.status === 'APPROVED' ? '#D1FAE5' : '#FEF3C7' }]}>
                  <Text style={[styles.ticketStatusText, { color: item.status === 'APPROVED' ? '#065F46' : '#92400E' }]}>{item.status}</Text>
                </View>
              </View>

              <View style={[styles.dashedDivider, { borderColor: colors.border }]} />

              <View style={styles.ticketBody}>
                <Text style={[styles.ticketTitle, { color: colors.text }]}>{item.listing?.name || 'Restaurant'}</Text>
                <Text style={[styles.ticketSub, { color: colors.textSecondary }]}>
                  {item.bookingDate} · {item.timeSlot}
                </Text>
                <Text style={[styles.ticketSub, { color: colors.textSecondary, marginTop: 4 }]}>
                  {item.peopleCount} {lang === 'te' ? 'వ్యక్తులు' : 'Guests'}
                </Text>
                {item.specialRequest && (
                  <Text style={[styles.ticketNotes, { color: colors.textMuted }]}>"{item.specialRequest}"</Text>
                )}
              </View>

              {item.status !== 'CANCELLED' && (
                <View style={[styles.cardActionRow, { borderTopColor: colors.border }]}>
                  <Pressable
                    onPress={() => handleCancelRestaurant(item.id, item.listing?.name)}
                    disabled={cancellingId === item.id}
                    style={[styles.cancelActionBtn, { borderColor: colors.border }]}
                  >
                    <Text style={styles.cancelActionText}>{lang === 'te' ? 'రిజర్వేషన్ రద్దు చేయి' : 'Cancel Reservation'}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))
        ) : (
          filteredStays.map((item) => (
            <View
              key={item.id}
              style={[styles.ticketCard, { backgroundColor: colors.card, borderColor: colors.border }, Shadows.card]}
            >
              <View style={styles.ticketHeaderRow}>
                <View style={styles.refCol}>
                  <Text style={[styles.refLabel, { color: colors.textMuted }]}>FREE PILGRIM STAY</Text>
                  <Text style={[styles.refValue, { color: colors.text }]}>#{item.id.slice(-8).toUpperCase()}</Text>
                </View>
                <View style={[styles.ticketStatusBadge, { backgroundColor: item.status === 'CONFIRMED' ? '#D1FAE5' : '#FEF3C7' }]}>
                  <Text style={[styles.ticketStatusText, { color: item.status === 'CONFIRMED' ? '#065F46' : '#92400E' }]}>{item.status}</Text>
                </View>
              </View>

              <View style={[styles.dashedDivider, { borderColor: colors.border }]} />

              <View style={styles.ticketBody}>
                <Text style={[styles.ticketTitle, { color: colors.text }]}>{item.listing?.name || 'Pilgrim Shelter'}</Text>
                <Text style={[styles.ticketSub, { color: colors.textSecondary }]}>
                  {item.checkInDate} → {item.checkOutDate}
                </Text>
                <Text style={[styles.ticketSub, { color: colors.textSecondary, marginTop: 4 }]}>
                  {item.guestName} · {item.peopleCount} {lang === 'te' ? 'యాత్రికులు' : 'Pilgrims'} ({item.groupType})
                </Text>
              </View>

              {item.status !== 'CANCELLED' && (
                <View style={[styles.cardActionRow, { borderTopColor: colors.border }]}>
                  <Pressable
                    onPress={() => handleCancelAccommodation(item.id, item.listing?.name)}
                    disabled={cancellingId === item.id}
                    style={[styles.cancelActionBtn, { borderColor: colors.border }]}
                  >
                    <Text style={styles.cancelActionText}>{lang === 'te' ? 'రద్దు చేయి' : 'Cancel Stay'}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Priority Booking Modal */}
      <PriorityBookingModal
        visible={bookingModalVisible}
        onClose={() => setBookingModalVisible(false)}
        onSuccess={handleBookingSuccess}
      />

      {/* Digital Pass Modal (QR) */}
      <DigitalPassModal
        visible={passModalVisible}
        pass={selectedPass}
        onClose={() => setPassModalVisible(false)}
      />

      {/* Authentication Modal */}
      <AuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        onSuccess={() => {
          setAuthModalVisible(false);
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
    paddingBottom: Spacing.three,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  screenSubtitle: {
    fontSize: 12,
  },
  applyHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  applyHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  categoryTabBar: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
  },
  categoryTabItem: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  activeCategoryTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryTabText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  contentScroll: {
    padding: Spacing.four,
    gap: 12,
  },
  successBanner: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
  },
  bannerIconRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  successBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  successBannerBody: {
    fontSize: 11,
    color: '#065F46',
    marginTop: 2,
  },
  previewSection: {
    padding: Spacing.four,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  passIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  previewSub: {
    fontSize: 12,
    marginTop: 2,
  },
  signInPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
  },
  signInPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  loaderContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loaderText: {
    fontSize: 13,
  },
  ticketCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
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
    fontSize: 13,
    fontWeight: '800',
  },
  ticketStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
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
    gap: 3,
  },
  ticketTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  ticketSub: {
    fontSize: 12,
  },
  ticketNotes: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
  cardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  qrPassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  qrPassBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cancelActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelActionText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '600',
  },
});
