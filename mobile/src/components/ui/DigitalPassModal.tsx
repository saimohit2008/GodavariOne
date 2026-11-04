import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { useApp } from '../../context/app-context';
import { Spacing, Shadows } from '../../constants/theme';
import { AppIcon } from './AppIcon';
import { PriorityBookingItem } from '../../types';
import { openMapsDirections } from '../../lib/maps';
import { verifyPriorityPass } from '../../services/api';

export interface DigitalPassModalProps {
  visible: boolean;
  pass: PriorityBookingItem | null;
  onClose: () => void;
  onCheckInSuccess?: () => void;
}

export function DigitalPassModal({
  visible,
  pass,
  onClose,
  onCheckInSuccess,
}: DigitalPassModalProps) {
  const { lang, colors, isDark, t, user } = useApp();

  const [verifying, setVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  if (!visible || !pass) return null;

  const isStaff = user?.role === 'SUPER_ADMIN' || user?.role === 'GHAT_SUPERVISOR';
  const isCheckedIn = pass.status === 'CHECKED_IN';
  const isAssigned = pass.status === 'SLOT_ASSIGNED' || pass.status === 'VERIFIED';

  const categoryLabel =
    pass.category === 'SENIOR_CITIZEN'
      ? lang === 'te'
        ? 'సీనియర్ సిటిజన్ (65+)'
        : 'Senior Citizen (65+)'
      : lang === 'te'
      ? 'దివ్యాంగులు (PWD)'
      : 'Person with Disability';

  const handleDirections = () => {
    if (pass.ghat) {
      openMapsDirections(
        pass.ghat.latitude ?? undefined,
        pass.ghat.longitude ?? undefined,
        pass.ghat.name,
        pass.ghat.address ?? undefined
      );
    }
  };

  const handleStaffCheckIn = async () => {
    setVerifyError(null);
    setVerifyMessage(null);
    setVerifying(true);

    try {
      const res = await verifyPriorityPass({
        token: pass.qrPassToken || undefined,
        applicationNumber: pass.applicationNumber,
      });

      if (res.data) {
        setVerifyMessage(t('entryVerifiedSuccess'));
        onCheckInSuccess?.();
      } else {
        setVerifyError(res.error || 'Check-in verification failed.');
      }
    } catch (err: any) {
      setVerifyError(err?.message || 'Verification failed. Please retry.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={styles.backdropPressable}
          onPress={onClose}
          accessibilityLabel="Close pass"
        />

        <View
          style={[
            styles.modalCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
            Shadows.card,
          ]}
        >
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.brandIconBadge, { backgroundColor: colors.primaryLight }]}>
                <AppIcon
                  name={{ ios: 'qrcode', android: 'qr_code', web: 'qrcode' }}
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.text }]}>
                  {t('digitalEntryPass')}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {lang === 'te'
                    ? 'గోదావరి పుష్కరాలు 2027 అధికారిక పాస్'
                    : 'Godavari Pushkaralu 2027 Official Pass'}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close pass dialog"
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: colors.secondary },
                pressed && { opacity: 0.7 },
              ]}
            >
              <AppIcon
                name={{ ios: 'xmark', android: 'close', web: 'times' }}
                size={16}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Ticket Card Container */}
            <View
              style={[
                styles.ticketContainer,
                {
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  borderColor: isCheckedIn ? '#10B981' : isAssigned ? colors.primary : '#F59E0B',
                },
              ]}
            >
              {/* Official Seal Ribbon */}
              <View
                style={[
                  styles.ribbonBar,
                  {
                    backgroundColor: isCheckedIn
                      ? '#10B981'
                      : isAssigned
                      ? colors.primary
                      : '#F59E0B',
                  },
                ]}
              >
                <AppIcon
                  name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'check-circle' }}
                  size={14}
                  color="#FFFFFF"
                />
                <Text style={styles.ribbonText}>
                  {isCheckedIn
                    ? lang === 'te'
                      ? 'ప్రవేశం ధృవీకరించబడింది · CHECKED IN'
                      : 'ENTRY CONFIRMED · CHECKED IN'
                    : isAssigned
                    ? lang === 'te'
                      ? 'ధృవీకరించబడిన ప్రవేశ పాస్ · VALID ENTRY PASS'
                      : 'VERIFIED PRIORITY ENTRY PASS'
                    : lang === 'te'
                    ? 'పరిశీలనలో ఉంది · APPLICATION UNDER REVIEW'
                    : 'APPLICATION UNDER REVIEW'}
                </Text>
              </View>

              {/* QR Matrix Block */}
              <View style={styles.qrBlock}>
                <View style={styles.qrFrame}>
                  {/* Digital QR Pattern Representation */}
                  <View style={styles.qrPatternBox}>
                    <View style={styles.qrCornerTL} />
                    <View style={styles.qrCornerTR} />
                    <View style={styles.qrCornerBL} />
                    <View style={styles.qrCenterEye}>
                      <AppIcon
                        name={{ ios: 'water.waves', android: 'waves', web: 'water' }}
                        size={22}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.qrDotsRow}>
                      <View style={styles.qrDot} />
                      <View style={styles.qrDot} />
                      <View style={styles.qrDot} />
                      <View style={styles.qrDot} />
                    </View>
                  </View>
                  <Text style={[styles.qrTokenText, { color: colors.textSecondary }]}>
                    {pass.qrPassToken || pass.applicationNumber}
                  </Text>
                </View>
                <Text style={[styles.qrScanNotice, { color: colors.textSecondary }]}>
                  {t('scanAtGate')}
                </Text>
              </View>

              {/* Perforation Line */}
              <View style={styles.perforationRow}>
                <View style={[styles.perforationHole, { backgroundColor: colors.card }]} />
                <View style={[styles.dashedLine, { borderColor: colors.border }]} />
                <View
                  style={[styles.perforationHole, styles.holeRight, { backgroundColor: colors.card }]}
                />
              </View>

              {/* Pass Details Table */}
              <View style={styles.passDetailsTable}>
                {/* Application Number */}
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {lang === 'te' ? 'దరఖాస్తు సంఖ్య' : 'Application Ref'}
                  </Text>
                  <Text style={[styles.detailValueBold, { color: colors.primary }]}>
                    {pass.applicationNumber}
                  </Text>
                </View>

                {/* Beneficiary */}
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {lang === 'te' ? 'యాత్రికుని పేరు' : 'Beneficiary Name'}
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {pass.beneficiaryName}
                  </Text>
                </View>

                {/* Category */}
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {lang === 'te' ? 'విభాగం' : 'Category'}
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {categoryLabel}
                  </Text>
                </View>

                {/* Destination Ghat */}
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {lang === 'te' ? 'స్నాన ఘాట్' : 'Assigned Ghat'}
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {pass.ghat?.name || 'Godavari Riverbank Ghat'}
                    {pass.ghat?.town ? ` (${pass.ghat.town})` : ''}
                  </Text>
                </View>

                {/* Visit Date & Time Slot */}
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {lang === 'te' ? 'తేదీ & సమయం' : 'Visit Date & Slot'}
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {pass.visitDate}
                    {pass.timeSlot ? ` · ${pass.timeSlot.startTime} - ${pass.timeSlot.endTime}` : ''}
                  </Text>
                </View>

                {/* Accompanying */}
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {lang === 'te' ? 'సహాయకులు' : 'Attendants'}
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {pass.accompanyingCount > 0
                      ? `${pass.accompanyingCount} ${lang === 'te' ? 'వ్యక్తులు' : 'Persons'}`
                      : lang === 'te'
                      ? 'ఎవరూ లేరు'
                      : 'None'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Offline Storage Notice */}
            <View style={[styles.offlineBanner, { backgroundColor: colors.secondary }]}>
              <AppIcon
                name={{ ios: 'arrow.down.circle.fill', android: 'offline_pin', web: 'check' }}
                size={16}
                color={colors.primary}
              />
              <Text style={[styles.offlineBannerText, { color: colors.textSecondary }]}>
                {lang === 'te'
                  ? 'ఈ పాస్ మీ పరికరంలో సేవ్ చేయబడింది. ఘాట్ వద్ద ఇంటర్నెట్ లేకపోయినా పనిచేస్తుంది.'
                  : 'This pass is securely cached on your device. Valid for entry even without internet at the riverbank.'}
              </Text>
            </View>

            {/* Ghat Directions Action */}
            {pass.ghat && (
              <Pressable
                onPress={handleDirections}
                accessibilityRole="button"
                accessibilityLabel="Get directions to ghat priority entrance"
                style={({ pressed }) => [
                  styles.directionsBtn,
                  { backgroundColor: colors.secondary },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <AppIcon
                  name={{ ios: 'location.fill', android: 'navigation', web: 'location-arrow' }}
                  size={15}
                  color={colors.primary}
                />
                <Text style={[styles.directionsBtnText, { color: colors.primary }]}>
                  {lang === 'te' ? 'ఘాట్ ప్రత్యేక ప్రవేశ ద్వారానికి దారి' : 'Get Directions to Ghat Gate'}
                </Text>
              </Pressable>
            )}

            {/* Staff / Supervisor Check-in Section (Role gated) */}
            {isStaff && !isCheckedIn && (
              <View style={[styles.staffCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <View style={styles.staffHeader}>
                  <AppIcon
                    name={{ ios: 'shield.lefthalf.filled', android: 'admin_panel_settings', web: 'shield' }}
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={[styles.staffTitle, { color: colors.text }]}>
                    {t('supervisorCheckIn')}
                  </Text>
                </View>

                {verifyMessage && (
                  <View style={[styles.alertBox, { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' }]}>
                    <Text style={styles.successAlertText}>{verifyMessage}</Text>
                  </View>
                )}

                {verifyError && (
                  <View style={[styles.alertBox, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
                    <Text style={styles.errorAlertText}>{verifyError}</Text>
                  </View>
                )}

                <Pressable
                  onPress={handleStaffCheckIn}
                  disabled={verifying}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm entry verification"
                  style={({ pressed }) => [
                    styles.verifyBtn,
                    { backgroundColor: '#059669' },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  {verifying ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.verifyBtnText}>{t('verifyEntryNow')}</Text>
                  )}
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdropPressable: {
    ...StyleSheet.absoluteFill,
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: '92%',
    paddingBottom: Spacing.four,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.four,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: Spacing.four,
    gap: 16,
  },
  ticketContainer: {
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  ribbonBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  ribbonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  qrBlock: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: Spacing.four,
  },
  qrFrame: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qrPatternBox: {
    width: 130,
    height: 130,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#0F172A',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCornerTL: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 26,
    height: 26,
    borderWidth: 4,
    borderColor: '#0F172A',
    borderRadius: 4,
  },
  qrCornerTR: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderWidth: 4,
    borderColor: '#0F172A',
    borderRadius: 4,
  },
  qrCornerBL: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 26,
    height: 26,
    borderWidth: 4,
    borderColor: '#0F172A',
    borderRadius: 4,
  },
  qrCenterEye: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrDotsRow: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    gap: 3,
  },
  qrDot: {
    width: 5,
    height: 5,
    backgroundColor: '#0F172A',
    borderRadius: 1,
  },
  qrTokenText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  qrScanNotice: {
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
  perforationRow: {
    position: 'relative',
    height: 20,
    justifyContent: 'center',
  },
  perforationHole: {
    position: 'absolute',
    left: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    zIndex: 2,
  },
  holeRight: {
    left: undefined,
    right: -10,
  },
  dashedLine: {
    borderStyle: 'dashed',
    borderBottomWidth: 1,
    marginHorizontal: 16,
  },
  passDetailsTable: {
    padding: Spacing.four,
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: '55%',
    textAlign: 'right',
  },
  detailValueBold: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
  },
  offlineBannerText: {
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  directionsBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  staffCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.three,
    gap: 10,
  },
  staffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  staffTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  verifyBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  alertBox: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  successAlertText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  errorAlertText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
