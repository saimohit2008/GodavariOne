import React, { useState, useEffect, useCallback } from 'react';
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
import { useRouter } from 'expo-router';

import { useApp } from '@/context/app-context';
import { Spacing, BottomTabInset, Shadows } from '@/constants/theme';
import { AppIcon } from '@/components/ui/AppIcon';
import { getGhats, updateGhatCrowdStatus } from '@/services/api';
import { ListingItem } from '@/types';
import { PassScannerModal } from '@/components/ui/PassScannerModal';

type CrowdLevel = 'FREE' | 'MODERATE' | 'CROWDED' | 'OVERCROWDED' | 'CLOSED';

const CROWD_OPTIONS: { status: CrowdLevel; labelEn: string; labelTe: string; color: string; bg: string }[] = [
  { status: 'FREE', labelEn: 'Normal (Free)', labelTe: 'సాధారణం (తక్కువ)', color: '#059669', bg: '#D1FAE5' },
  { status: 'MODERATE', labelEn: 'Moderate', labelTe: 'మితమైన రద్దీ', color: '#2563EB', bg: '#DBEAFE' },
  { status: 'CROWDED', labelEn: 'Crowded', labelTe: 'ఎక్కువ రద్దీ', color: '#D97706', bg: '#FEF3C7' },
  { status: 'OVERCROWDED', labelEn: 'Overcrowded', labelTe: 'అత్యధిక రద్దీ', color: '#7C3AED', bg: '#EDE9FE' },
  { status: 'CLOSED', labelEn: 'Closed / Hold', labelTe: 'ప్రవేశం నిలుపుదల', color: '#DC2626', bg: '#FEE2E2' },
];

export default function GhatOperationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { lang, colors, isDark, t, user } = useApp();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ghats, setGhats] = useState<ListingItem[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; success: boolean; msg: string } | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);

  const isSupervisor = user?.role === 'GHAT_SUPERVISOR';
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';
  const hasStaffRole = isSupervisor || isAdmin;

  const loadGhatsData = useCallback(async () => {
    try {
      const res = await getGhats();
      setGhats(res.data);
    } catch {
      // safe fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadGhatsData();
  }, [loadGhatsData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadGhatsData();
  }, [loadGhatsData]);

  const handleUpdateStatus = async (ghatId: string, newStatus: CrowdLevel) => {
    setUpdatingId(ghatId);
    setFeedback(null);

    try {
      const res = await updateGhatCrowdStatus(ghatId, newStatus);
      if (res.data) {
        setFeedback({
          id: ghatId,
          success: true,
          msg: t('statusUpdatedSuccess'),
        });
        // Update local state immediately
        setGhats((prev) =>
          prev.map((g) =>
            g.id === ghatId
              ? {
                  ...g,
                  ghat: {
                    ...(g.ghat || {}),
                    currentCrowdStatus: newStatus,
                    statusUpdatedAt: new Date().toISOString(),
                  },
                }
              : g
          )
        );
      } else {
        setFeedback({
          id: ghatId,
          success: false,
          msg: res.error || 'Update failed',
        });
      }
    } catch (err: any) {
      setFeedback({
        id: ghatId,
        success: false,
        msg: err?.message || 'Network error',
      });
    } finally {
      setUpdatingId(null);
    }
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
              {t('ghatOperations')}
            </Text>
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.staffRolePill,
                  { backgroundColor: hasStaffRole ? colors.primaryLight : '#FEE2E2' },
                ]}
              >
                <AppIcon
                  name={
                    hasStaffRole
                      ? { ios: 'shield.fill', android: 'verified_user', web: 'shield' }
                      : { ios: 'lock.fill', android: 'lock', web: 'lock' }
                  }
                  size={12}
                  color={hasStaffRole ? colors.primary : '#DC2626'}
                />
                <Text
                  style={[
                    styles.staffRolePillText,
                    { color: hasStaffRole ? colors.primary : '#991B1B' },
                  ]}
                >
                  {isAdmin
                    ? t('adminBadge')
                    : isSupervisor
                    ? t('supervisorBadge')
                    : t('accessRestricted')}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      {!hasStaffRole ? (
        <View style={styles.accessRestrictedBox}>
          <View style={[styles.accessIconCircle, { backgroundColor: '#FEE2E2' }]}>
            <AppIcon
              name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }}
              size={36}
              color="#DC2626"
            />
          </View>
          <Text style={[styles.accessRestrictedTitle, { color: colors.text }]}>
            {t('accessRestricted')}
          </Text>
          <Text style={[styles.accessRestrictedDesc, { color: colors.textSecondary }]}>
            {t('accessRestrictedDesc')}
          </Text>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Return"
            style={({ pressed }) => [
              styles.backHomeBtn,
              { backgroundColor: colors.primary },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.backHomeBtnText}>
              {lang === 'te' ? 'తిరిగి వెళ్ళండి' : 'Go Back'}
            </Text>
          </Pressable>
        </View>
      ) : (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + BottomTabInset + 24 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Operations Overview Banner */}
        <View
          style={[
            styles.opsOverviewBanner,
            { backgroundColor: colors.secondary, borderColor: colors.border },
          ]}
        >
          <AppIcon
            name={{ ios: 'antenna.radiowaves.left.and.right', android: 'sensors', web: 'broadcast-tower' }}
            size={22}
            color={colors.primary}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.opsBannerTitle, { color: colors.text }]}>
              {lang === 'te'
                ? 'ప్రత్యక్ష నదీతీర రద్దీ నవీకరణ వేదిక'
                : 'Live Riverbank Crowd Operations'}
            </Text>
            <Text style={[styles.opsBannerSub, { color: colors.textSecondary }]}>
              {t('ghatOpsDesc')}
            </Text>
          </View>
        </View>

        {/* Staff Priority Pass QR Scanner Action Card */}
        <Pressable
          onPress={() => setScannerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Scan pilgrim priority pass"
          style={({ pressed }) => [
            styles.scannerActionCard,
            {
              backgroundColor: colors.primaryLight,
              borderColor: colors.primary,
            },
            Shadows.card,
            pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
          ]}
        >
          <View style={[styles.scannerIconCircle, { backgroundColor: colors.primary }]}>
            <AppIcon
              name={{ ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qrcode' }}
              size={20}
              color="#FFFFFF"
            />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.scannerCardTitle, { color: colors.primary }]}>
              {lang === 'te' ? 'యాత్రికుని పాస్ QR స్కాన్ చేయండి' : 'Scan Pilgrim Priority Pass'}
            </Text>
            <Text style={[styles.scannerCardSub, { color: colors.textSecondary }]} numberOfLines={2}>
              {lang === 'te'
                ? 'ఘాట్ ప్రవేశ ద్వారం వద్ద లైవ్ కెమెరా లేదా మాన్యువల్ కోడ్ ద్వారా ధృవీకరించండి'
                : 'Gate check-in via native camera scanner or reference lookup'}
            </Text>
          </View>
          <AppIcon
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron-right' }}
            size={18}
            color={colors.primary}
          />
        </Pressable>

        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loaderText, { color: colors.textSecondary }]}>
              {t('loading')}
            </Text>
          </View>
        ) : (
          ghats.map((ghat) => {
            const currentStatus = (ghat.ghat?.currentCrowdStatus as CrowdLevel) || 'FREE';
            const matchedOption =
              CROWD_OPTIONS.find((c) => c.status === currentStatus) || CROWD_OPTIONS[0];
            const isThisUpdating = updatingId === ghat.id;
            const thisFeedback = feedback?.id === ghat.id ? feedback : null;

            return (
              <View
                key={ghat.id}
                style={[
                  styles.ghatOpCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: matchedOption.color + '40',
                  },
                  Shadows.card,
                ]}
              >
                {/* Top Ghat Info */}
                <View style={styles.ghatTopInfo}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.ghatNameText, { color: colors.text }]}>
                      {ghat.name}
                    </Text>
                    <Text style={[styles.ghatTownText, { color: colors.textSecondary }]}>
                      {[ghat.locality, ghat.town, ghat.district].filter(Boolean).join(', ') || 'Rajahmundry'}
                    </Text>
                  </View>

                  {/* Active Status Badge */}
                  <View style={[styles.activeStatusPill, { backgroundColor: matchedOption.bg }]}>
                    <Text style={[styles.activeStatusText, { color: matchedOption.color }]}>
                      {lang === 'te' ? matchedOption.labelTe : matchedOption.labelEn}
                    </Text>
                  </View>
                </View>

                {/* Feedback Toast */}
                {thisFeedback && (
                  <View
                    style={[
                      styles.feedbackAlert,
                      {
                        backgroundColor: thisFeedback.success ? '#D1FAE5' : '#FEE2E2',
                        borderColor: thisFeedback.success ? '#A7F3D0' : '#FECACA',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.feedbackText,
                        { color: thisFeedback.success ? '#065F46' : '#991B1B' },
                      ]}
                    >
                      {thisFeedback.msg}
                    </Text>
                  </View>
                )}

                {/* Prompt Label */}
                <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>
                  {t('updateStatusPrompt')}:
                </Text>

                {/* Status Selector Button Strip */}
                <View style={styles.statusButtonGroup}>
                  {CROWD_OPTIONS.map((opt) => {
                    const isSelected = opt.status === currentStatus;
                    return (
                      <Pressable
                        key={opt.status}
                        onPress={() => handleUpdateStatus(ghat.id, opt.status)}
                        disabled={isThisUpdating}
                        accessibilityRole="button"
                        accessibilityLabel={`Set crowd status to ${opt.labelEn}`}
                        style={({ pressed }) => [
                          styles.statusOptionBtn,
                          {
                            backgroundColor: isSelected ? opt.color : colors.secondary,
                            borderColor: isSelected ? opt.color : colors.border,
                          },
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusOptionText,
                            {
                              color: isSelected ? '#FFFFFF' : colors.text,
                              fontWeight: isSelected ? '800' : '600',
                            },
                          ]}
                        >
                          {lang === 'te' ? opt.labelTe.split(' ')[0] : opt.labelEn.split(' ')[0]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
      )}

      {/* Staff Native Camera Pass Scanner Modal */}
      {hasStaffRole && (
        <PassScannerModal
          visible={scannerVisible}
          onClose={() => setScannerVisible(false)}
        />
      )}
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
    gap: 3,
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  staffRolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  staffRolePillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  scrollContent: {
    padding: Spacing.four,
    gap: 14,
  },
  opsOverviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.four,
    borderRadius: 16,
    borderWidth: 1,
  },
  opsBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  opsBannerSub: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  scannerActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.four,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  scannerIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerCardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  scannerCardSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  loaderBox: {
    paddingVertical: 50,
    alignItems: 'center',
    gap: 10,
  },
  loaderText: {
    fontSize: 13,
  },
  ghatOpCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: Spacing.four,
    gap: 10,
  },
  ghatTopInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  ghatNameText: {
    fontSize: 15,
    fontWeight: '800',
  },
  ghatTownText: {
    fontSize: 11,
    marginTop: 2,
  },
  activeStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  activeStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  selectorLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  statusButtonGroup: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  statusOptionBtn: {
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusOptionText: {
    fontSize: 11,
  },
  feedbackAlert: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  feedbackText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  accessRestrictedBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.six,
    gap: 12,
  },
  accessIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  accessRestrictedTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  accessRestrictedDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  backHomeBtn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  backHomeBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

