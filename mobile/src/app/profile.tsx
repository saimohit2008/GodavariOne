import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useApp, ThemeMode } from '@/context/app-context';
import { Spacing, BottomTabInset, Shadows } from '@/constants/theme';
import { Lang } from '@/lib/i18n';
import { AppIcon } from '@/components/ui/AppIcon';
import { getFavorites, waitForStorageInit } from '@/lib/storage';
import { AuthModal } from '@/components/ui/AuthModal';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang, setLang, themeMode, setThemeMode, colors, isDark, t, user, logout } = useApp();

  const params = useLocalSearchParams<{ auth?: string }>();
  const [favCount, setFavCount] = useState(0);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const isStaff = user?.role === 'GHAT_SUPERVISOR' || user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  useEffect(() => {
    if (params?.auth === 'true' || params?.auth === 'login') {
      setAuthModalVisible(true);
    }
  }, [params?.auth]);

  useEffect(() => {
    try {
      waitForStorageInit().then(() => {
        const favs = getFavorites();
        setFavCount(favs.length);
      });
    } catch {
      // safe fallback
    }
  }, []);

  const handleLanguageChange = (newLang: Lang) => {
    setLang(newLang);
  };

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

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
        <Text style={[styles.screenTitle, { color: colors.text }]}>{t('profile')}</Text>
        <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
          {t('account')}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.contentScroll,
          { paddingBottom: insets.bottom + BottomTabInset + Spacing.four },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. User Information Card */}
        <View
          style={[
            styles.userCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            Shadows.card,
          ]}
        >
          <View style={[styles.avatarCircle, { backgroundColor: colors.primaryLight }]}>
            <AppIcon
              name={{ ios: 'person.crop.circle.fill', android: 'account_circle', web: 'user-circle' }}
              size={48}
              color={colors.primary}
            />
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.text }]}>
              {user ? user.name || user.phone || 'Pilgrim' : t('guestUser')}
            </Text>
            <Text style={[styles.userRole, { color: colors.textSecondary }]}>
              {user
                ? user.phone || user.email || 'Verified Pilgrim Account'
                : t('guestUserDesc')}
            </Text>
            <View style={[styles.modeBadge, { backgroundColor: colors.secondary }]}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: user ? colors.success : colors.warning },
                ]}
              />
              <Text style={[styles.modeText, { color: colors.textSecondary }]}>
                {user
                  ? lang === 'te'
                    ? 'ధృవీకరించబడిన యాత్రికుడు'
                    : 'Verified Pilgrim'
                  : lang === 'te'
                    ? 'పబ్లిక్ యాక్సెస్ మోడ్'
                    : 'Public Access Mode'}
              </Text>
            </View>
          </View>
        </View>

        {/* Saved Places / Favorites Card */}
        <Pressable
          onPress={() => router.push('/favorites' as any)}
          accessibilityRole="button"
          accessibilityLabel="Saved Places and Favorites"
          style={({ pressed }) => [
            styles.favoritesEntryCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            Shadows.card,
            pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
          ]}
        >
          <View style={[styles.favIconCircle, { backgroundColor: '#FEE2E2' }]}>
            <AppIcon
              name={{ ios: 'heart.fill', android: 'favorite', web: 'heart' }}
              size={22}
              color="#DC2626"
            />
          </View>
          <View style={styles.favTextCol}>
            <View style={styles.favTitleRow}>
              <Text style={[styles.favTitle, { color: colors.text }]}>
                {t('favorites')}
              </Text>
              <View style={[styles.favBadge, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.favBadgeText, { color: colors.primary }]}>
                  {favCount}
                </Text>
              </View>
            </View>
            <Text style={[styles.favSubtext, { color: colors.textSecondary }]} numberOfLines={1}>
              {t('favoritesDesc')}
            </Text>
          </View>
          <AppIcon
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron-right' }}
            size={18}
            color={colors.textSecondary}
          />
        </Pressable>

        {/* Emergency & Safety Services Card */}
        <Pressable
          onPress={() => router.push('/emergency')}
          accessibilityRole="button"
          accessibilityLabel="24/7 Emergency & Pilgrim Safety Hub"
          style={({ pressed }) => [
            styles.favoritesEntryCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            Shadows.card,
            pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
          ]}
        >
          <View style={[styles.favIconCircle, { backgroundColor: '#FEE2E2' }]}>
            <AppIcon
              name={{ ios: 'cross.case.fill', android: 'emergency', web: 'medkit' }}
              size={20}
              color="#DC2626"
            />
          </View>
          <View style={styles.favTextCol}>
            <View style={styles.favTitleRow}>
              <Text style={[styles.favTitle, { color: colors.text }]}>
                {t('emergencyServices')}
              </Text>
              <View style={[styles.favBadge, { backgroundColor: '#FEE2E2' }]}>
                <Text style={[styles.favBadgeText, { color: '#DC2626' }]}>24/7</Text>
              </View>
            </View>
            <Text style={[styles.favSubtext, { color: colors.textSecondary }]} numberOfLines={1}>
              {lang === 'te'
                ? 'పోలీస్ (100), అంబులెన్స్ (108), అగ్నిమాపక & రెస్క్యూ హెల్ప్‌లైన్లు'
                : 'Police (100), Ambulance (108), SDRF & District Helplines'}
            </Text>
          </View>
          <AppIcon
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron-right' }}
            size={18}
            color={colors.textSecondary}
          />
        </Pressable>

        {/* Notifications & Announcements Card */}
        <Pressable
          onPress={() => router.push('/notifications')}
          accessibilityRole="button"
          accessibilityLabel="Notifications & Alerts"
          style={({ pressed }) => [
            styles.favoritesEntryCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            Shadows.card,
            pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
          ]}
        >
          <View style={[styles.favIconCircle, { backgroundColor: colors.primaryLight }]}>
            <AppIcon
              name={{ ios: 'bell.fill', android: 'notifications', web: 'bell' }}
              size={20}
              color={colors.primary}
            />
          </View>
          <View style={styles.favTextCol}>
            <View style={styles.favTitleRow}>
              <Text style={[styles.favTitle, { color: colors.text }]}>
                {t('notifications')}
              </Text>
            </View>
            <Text style={[styles.favSubtext, { color: colors.textSecondary }]} numberOfLines={1}>
              {lang === 'te'
                ? 'ముఖ్యమైన ప్రవేశ ప్రకటనలు మరియు పుష్కరాల తాజా సమాచారం'
                : 'Priority alerts, crowd notices, and festival updates'}
            </Text>
          </View>
          <AppIcon
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron-right' }}
            size={18}
            color={colors.textSecondary}
          />
        </Pressable>

        {/* 2. Login / Register or Logged In Actions */}
        {!user ? (
          <View
            style={[
              styles.authCard,
              {
                backgroundColor: isDark ? '#1F2E35' : '#EAF2F2',
                borderColor: colors.border,
              },
              Shadows.card,
            ]}
          >
            <View style={styles.authHeader}>
              <View style={[styles.lockIconBadge, { backgroundColor: colors.primary }]}>
                <AppIcon
                  name={{ ios: 'lock.shield.fill', android: 'lock', web: 'shield' }}
                  size={16}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.authTitleCol}>
                <Text style={[styles.authTitle, { color: colors.text }]}>{t('signInCta')}</Text>
                <Text style={[styles.authDesc, { color: colors.textSecondary }]}>
                  {t('signInNotice')}
                </Text>
              </View>
            </View>

            <Pressable
              testID="sign-in-button"
              onPress={() => {
                setAuthModalVisible(true);
              }}
              {...(Platform.OS === 'web'
                ? {
                  onClick: (e: any) => {
                    e?.preventDefault?.();
                    e?.stopPropagation?.();
                    setAuthModalVisible(true);
                  },
                }
                : {})}
              accessibilityRole="button"
              accessibilityLabel="Sign in or register"
              style={({ pressed }) => [
                styles.authButtonActive,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.authButtonActiveText}>{t('signIn')}</Text>
            </Pressable>
          </View>
        ) : (
          <View
            style={[
              styles.authCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
              Shadows.card,
            ]}
          >
            <Pressable
              onPress={() => router.push('/bookings')}
              accessibilityRole="button"
              accessibilityLabel="View my bookings"
              style={({ pressed }) => [
                styles.bookingsShortcutRow,
                pressed && { opacity: 0.8 },
              ]}
            >
              <View style={[styles.ticketIconCircle, { backgroundColor: colors.primaryLight }]}>
                <AppIcon
                  name={{ ios: 'ticket.fill', android: 'confirmation_number', web: 'ticket-alt' }}
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.shortcutTitle, { color: colors.text }]}>
                  {t('myBookings')}
                </Text>
                <Text style={[styles.shortcutSub, { color: colors.textSecondary }]}>
                  {lang === 'te'
                    ? 'మీ ప్రాధాన్యత స్నాన పాస్‌లు మరియు వివరాలను చూడండి'
                    : 'View your verified ghat passes & passes'}
                </Text>
              </View>
              <AppIcon
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron-right' }}
                size={16}
                color={colors.textSecondary}
              />
            </Pressable>

            {/* Role-Protected Ghat Operations Dashboard (Only visible to authorized Staff) */}
            {isStaff && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Pressable
                  onPress={() => router.push('/ghat-operations')}
                  accessibilityRole="button"
                  accessibilityLabel="Ghat Operations Dashboard"
                  style={({ pressed }) => [
                    styles.bookingsShortcutRow,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <View style={[styles.ticketIconCircle, { backgroundColor: '#EDE9FE' }]}>
                    <AppIcon
                      name={{ ios: 'antenna.radiowaves.left.and.right', android: 'sensors', web: 'broadcast-tower' }}
                      size={18}
                      color="#7C3AED"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.shortcutTitle, { color: colors.text }]}>
                      {t('ghatOperations')}
                    </Text>
                    <Text style={[styles.shortcutSub, { color: colors.textSecondary }]}>
                      {lang === 'te'
                        ? 'ప్రత్యక్ష ఘాట్ రద్దీ స్థాయిలు & పర్యవేక్షణ'
                        : 'Real-time ghat crowd levels & operations'}
                    </Text>
                  </View>
                  <AppIcon
                    name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron-right' }}
                    size={16}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </>
            )}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Pressable
              onPress={logout}
              accessibilityRole="button"
              accessibilityLabel="Log out"
              style={({ pressed }) => [
                styles.logoutButton,
                { borderColor: colors.dangerLight },
                pressed && { opacity: 0.8 },
              ]}
            >
              <AppIcon
                name={{ ios: 'arrow.right.square', android: 'logout', web: 'sign-out-alt' }}
                size={16}
                color={colors.danger}
              />
              <Text style={[styles.logoutText, { color: colors.danger }]}>
                {t('logout')}
              </Text>
            </Pressable>
          </View>
        )}

        {/* 3. Language Setting */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            Shadows.card,
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <AppIcon
              name={{ ios: 'globe', android: 'language', web: 'globe' }}
              size={18}
              color={colors.primary}
            />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('languagePreference')}
            </Text>
          </View>

          <View style={styles.optionsList}>
            {/* English Option */}
            <Pressable
              onPress={() => handleLanguageChange('en')}
              style={({ pressed }) => [
                styles.optionRow,
                { borderBottomColor: colors.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.optionLabel, { color: colors.text }]}>
                {t('english')}
              </Text>
              <View
                style={[
                  styles.radioOuter,
                  { borderColor: lang === 'en' ? colors.primary : colors.border },
                ]}
              >
                {lang === 'en' && (
                  <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                )}
              </View>
            </Pressable>

            {/* Telugu Option */}
            <Pressable
              onPress={() => handleLanguageChange('te')}
              style={({ pressed }) => [
                styles.optionRow,
                { borderBottomWidth: 0 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.optionLabel, { color: colors.text }]}>
                {t('telugu')}
              </Text>
              <View
                style={[
                  styles.radioOuter,
                  { borderColor: lang === 'te' ? colors.primary : colors.border },
                ]}
              >
                {lang === 'te' && (
                  <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                )}
              </View>
            </Pressable>
          </View>
        </View>

        {/* 4. Theme Setting */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            Shadows.card,
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <AppIcon
              name={{ ios: 'circle.lefthalf.filled', android: 'brightness_6', web: 'adjust' }}
              size={18}
              color={colors.primary}
            />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('theme')}</Text>
          </View>

          <View style={styles.themeButtonsRow}>
            {(
              [
                { mode: 'system' as ThemeMode, label: t('themeSystem'), icon: 'gear' },
                { mode: 'light' as ThemeMode, label: t('themeLight'), icon: 'sun.max.fill' },
                { mode: 'dark' as ThemeMode, label: t('themeDark'), icon: 'moon.fill' },
              ] as const
            ).map((item) => {
              const isSelected = themeMode === item.mode;
              return (
                <Pressable
                  key={item.mode}
                  onPress={() => handleThemeChange(item.mode)}
                  style={({ pressed }) => [
                    styles.themeButton,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.secondary,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text
                    style={[
                      styles.themeButtonText,
                      { color: isSelected ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 5. About Godavari One & Platform Disclaimer */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            Shadows.card,
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <AppIcon
              name={{ ios: 'info.circle.fill', android: 'info', web: 'info' }}
              size={18}
              color={colors.primary}
            />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('aboutGodavariOne')}
            </Text>
          </View>

          <Text style={[styles.aboutText, { color: colors.textSecondary }]}>
            {t('pushkaraluInfoText')}
          </Text>

          <View
            style={[
              styles.disclaimerBox,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.disclaimerHeading, { color: colors.text }]}>
              {t('disclaimerTitle')}
            </Text>
            <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
              {t('disclaimerText')}
            </Text>
          </View>

          <View style={styles.appInfoFooter}>
            <Text style={[styles.versionText, { color: colors.textMuted }]}>
              {t('appVersion')}
            </Text>
            <Text style={[styles.copyText, { color: colors.textMuted }]}>
              © 2027 Godavari One · Public Service Platform
            </Text>
          </View>
        </View>
      </ScrollView>

      <AuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        onSuccess={() => setAuthModalVisible(false)}
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
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  screenSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  contentScroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.four,
    gap: 14,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    gap: 3,
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
  },
  userRole: {
    fontSize: 12,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  favoritesEntryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
    gap: 12,
  },
  favIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favTextCol: {
    flex: 1,
    gap: 3,
  },
  favTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  favTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  favBadge: {
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 10,
  },
  favBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  favSubtext: {
    fontSize: 11,
  },
  authCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  authHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  lockIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authTitleCol: {
    flex: 1,
    gap: 2,
  },
  authTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  authDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  authButtonDisabled: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  authButtonActive: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authButtonActiveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  bookingsShortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ticketIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  shortcutSub: {
    fontSize: 11,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
  },
  logoutText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  optionsList: {
    gap: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  themeButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeButton: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeButtonText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  aboutText: {
    fontSize: 12,
    lineHeight: 18,
  },
  disclaimerBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 4,
  },
  disclaimerHeading: {
    fontSize: 11,
    fontWeight: '700',
  },
  disclaimerText: {
    fontSize: 10,
    lineHeight: 15,
  },
  appInfoFooter: {
    alignItems: 'center',
    gap: 2,
    paddingTop: 4,
  },
  versionText: {
    fontSize: 10,
    fontWeight: '500',
  },
  copyText: {
    fontSize: 9,
  },
});
