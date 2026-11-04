// Godavari One Mobile — Staff Priority Pass QR Scanner Modal
// Safeguards:
// 1. Hardware camera scanning via expo-camera (CameraView) with permission handling.
// 2. Strict Server-Authoritative Verification: NEVER approves an entry check-in locally or offline.
// 3. Duplicate check-in prevention: Surfaces HTTP 409 duplicate alerts with timestamps and staff ID.
// 4. Fallback manual lookup for web, simulator, or damaged QR codes.
// 5. Throttled scan events to prevent duplicate in-flight network requests.

import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { useApp } from '@/context/app-context';
import { Spacing, Shadows } from '@/constants/theme';
import { AppIcon } from './AppIcon';
import { verifyPriorityPass } from '@/services/api';

export interface PassScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (booking: any) => void;
}

export function PassScannerModal({ visible, onClose, onSuccess }: PassScannerModalProps) {
  const { lang, colors, isDark, t } = useApp();
  const [permission, requestPermission] = useCameraPermissions();

  const [scanningActive, setScanningActive] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [result, setResult] = useState<{
    success: boolean;
    title: string;
    message: string;
    booking?: any;
  } | null>(null);

  const lastScannedTimeRef = useRef<number>(0);

  useEffect(() => {
    if (visible) {
      setScanningActive(true);
      setVerifying(false);
      setResult(null);
      setManualInput('');
    }
  }, [visible]);

  if (!visible) return null;

  const handleVerifyPayload = async (payload: string) => {
    const now = Date.now();
    // Debounce scans by at least 2 seconds
    if (now - lastScannedTimeRef.current < 2000) return;
    lastScannedTimeRef.current = now;

    setScanningActive(false);
    setVerifying(true);
    setResult(null);

    let cleanToken = payload.trim();
    let appNumber: string | undefined = undefined;

    // Parse JSON payload if formatted via formatQrPassPayload
    if (cleanToken.startsWith('{')) {
      try {
        const parsed = JSON.parse(cleanToken);
        if (parsed.token) cleanToken = parsed.token;
        if (parsed.ref) appNumber = parsed.ref;
      } catch {
        // use raw string
      }
    }

    try {
      const res = await verifyPriorityPass({
        token: cleanToken,
        applicationNumber: appNumber,
      });

      if (res.data && res.data.success) {
        setResult({
          success: true,
          title: lang === 'te' ? 'ప్రవేశం ధృవీకరించబడింది!' : 'Entry Verified!',
          message:
            lang === 'te'
              ? `${res.data.booking?.beneficiaryName || 'యాత్రికుడు'} ప్రవేశం విజయవంతంగా నమోదు చేయబడింది.`
              : `${res.data.booking?.beneficiaryName || 'Beneficiary'} entry successfully verified and recorded.`,
          booking: res.data.booking,
        });
        onSuccess?.(res.data.booking);
      } else {
        setResult({
          success: false,
          title: lang === 'te' ? 'ధృవీకరణ విఫలమైంది' : 'Check-in Rejected',
          message: res.error || (lang === 'te' ? 'పాస్ చెల్లుబాటు కాలేదు.' : 'Pass is not valid for entry.'),
        });
      }
    } catch (err: any) {
      setResult({
        success: false,
        title: lang === 'te' ? 'నెట్‌వర్క్ లోపం' : 'Verification Error',
        message:
          err?.message ||
          (lang === 'te'
            ? 'లైవ్ సర్వర్ కనెక్షన్ విఫలమైంది. ఆఫ్‌లైన్ ప్రవేశం నిషేధించబడింది.'
            : 'Live server connection failed. Offline check-in is prohibited.'),
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (!scanningActive || verifying) return;
    handleVerifyPayload(data);
  };

  const handleManualSubmit = () => {
    if (!manualInput.trim()) return;
    handleVerifyPayload(manualInput.trim());
  };

  const handleResetScan = () => {
    setResult(null);
    setVerifying(false);
    setScanningActive(true);
    setManualInput('');
  };

  const canUseCamera = Platform.OS !== 'web' && permission?.granted;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.headerIconBox, { backgroundColor: colors.primaryLight }]}>
                <AppIcon
                  name={{ ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qrcode' }}
                  size={20}
                  color={colors.primary}
                />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.text }]}>
                  {lang === 'te' ? 'ప్రాధాన్యత పాస్ స్కానర్' : 'Priority Pass QR Scanner'}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {lang === 'te'
                    ? 'ప్రవేశం వద్ద అధికారిక సర్వర్ ధృవీకరణ'
                    : 'Official Server-Authoritative Gate Verification'}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close scanner"
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: colors.secondary },
                pressed && { opacity: 0.7 },
              ]}
            >
              <AppIcon
                name={{ ios: 'xmark', android: 'close', web: 'times' }}
                size={18}
                color={colors.text}
              />
            </Pressable>
          </View>

          {/* Body */}
          <View style={styles.body}>
            {/* 1. Camera View (when available and permitted) */}
            {canUseCamera ? (
              <View style={styles.cameraBox}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={handleBarcodeScanned}
                />
                <View style={styles.viewfinderOverlay}>
                  <View style={[styles.scanTarget, { borderColor: colors.primary }]} />
                  <Text style={styles.scanHint}>
                    {lang === 'te'
                      ? 'యాత్రికుని QR కోడ్‌ను ఫ్రేమ్‌లో ఉంచండి'
                      : 'Align pilgrim QR code within frame'}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={[styles.cameraFallback, { backgroundColor: colors.secondary }]}>
                <AppIcon
                  name={{ ios: 'camera.fill', android: 'photo_camera', web: 'camera' }}
                  size={32}
                  color={colors.primary}
                />
                <Text style={[styles.fallbackTitle, { color: colors.text }]}>
                  {Platform.OS === 'web'
                    ? lang === 'te'
                      ? 'వెబ్ మోడ్ — మాన్యువల్ ధృవీకరణ'
                      : 'Web Environment — Manual Entry'
                    : lang === 'te'
                    ? 'కెమెరా అనుమతి అవసరం'
                    : 'Camera Permission Required'}
                </Text>
                {Platform.OS !== 'web' && !permission?.granted && (
                  <Pressable
                    onPress={requestPermission}
                    style={[styles.grantBtn, { backgroundColor: colors.primary }]}
                  >
                    <Text style={styles.grantBtnText}>
                      {lang === 'te' ? 'కెమెరా అనుమతిని ఇవ్వండి' : 'Enable Camera Access'}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* 2. Verification Status / Results */}
            {verifying ? (
              <View style={[styles.verifyingCard, { backgroundColor: colors.primaryLight }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.verifyingText, { color: colors.primary }]}>
                  {lang === 'te'
                    ? 'సర్వర్‌తో ధృవీకరించబడుతోంది...'
                    : 'Authorizing with live server...'}
                </Text>
              </View>
            ) : result ? (
              <View
                style={[
                  styles.resultCard,
                  {
                    backgroundColor: result.success ? '#D1FAE5' : '#FEE2E2',
                    borderColor: result.success ? '#059669' : '#DC2626',
                  },
                ]}
              >
                <View style={styles.resultHeader}>
                  <AppIcon
                    name={
                      result.success
                        ? { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check-circle' }
                        : { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'exclamation-triangle' }
                    }
                    size={22}
                    color={result.success ? '#059669' : '#DC2626'}
                  />
                  <Text
                    style={[
                      styles.resultTitle,
                      { color: result.success ? '#065F46' : '#991B1B' },
                    ]}
                  >
                    {result.title}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.resultBody,
                    { color: result.success ? '#047857' : '#B91C1C' },
                  ]}
                >
                  {result.message}
                </Text>

                {result.booking && (
                  <View style={styles.bookingDetailsBox}>
                    <Text style={styles.bookingDetailLine}>
                      <Text style={{ fontWeight: '700' }}>App #: </Text>
                      {result.booking.applicationNumber}
                    </Text>
                    <Text style={styles.bookingDetailLine}>
                      <Text style={{ fontWeight: '700' }}>Name: </Text>
                      {result.booking.beneficiaryName}
                    </Text>
                    <Text style={styles.bookingDetailLine}>
                      <Text style={{ fontWeight: '700' }}>Category: </Text>
                      {result.booking.category}
                    </Text>
                  </View>
                )}

                <Pressable
                  onPress={handleResetScan}
                  style={[
                    styles.scanAgainBtn,
                    { backgroundColor: result.success ? '#059669' : '#DC2626' },
                  ]}
                >
                  <Text style={styles.scanAgainBtnText}>
                    {lang === 'te' ? 'మరొకటి స్కాన్ చేయండి' : 'Scan Next Pass'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* 3. Manual Entry Input (Always available as fallback) */}
            <View style={[styles.manualSection, { borderTopColor: colors.border }]}>
              <Text style={[styles.manualLabel, { color: colors.textSecondary }]}>
                {lang === 'te'
                  ? 'లేదా దరఖాస్తు సంఖ్య / టోకెన్ మాన్యువల్‌గా నమోదు చేయండి:'
                  : 'Or enter application reference / QR token manually:'}
              </Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={manualInput}
                  onChangeText={setManualInput}
                  placeholder="PB-2027-XXXX or Token..."
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.secondary,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                />
                <Pressable
                  onPress={handleManualSubmit}
                  disabled={!manualInput.trim() || verifying}
                  style={[
                    styles.submitBtn,
                    {
                      backgroundColor: manualInput.trim() ? colors.primary : colors.border,
                      opacity: manualInput.trim() ? 1 : 0.6,
                    },
                  ]}
                >
                  <Text style={styles.submitBtnText}>
                    {lang === 'te' ? 'ధృవీకరించండి' : 'Verify'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
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
  body: {
    padding: Spacing.four,
    gap: 16,
  },
  cameraBox: {
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  viewfinderOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  scanTarget: {
    width: 160,
    height: 160,
    borderWidth: 2,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scanHint: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  cameraFallback: {
    height: 140,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  fallbackTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  grantBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  grantBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  verifyingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
  },
  verifyingText: {
    fontSize: 13,
    fontWeight: '700',
  },
  resultCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  resultBody: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  bookingDetailsBox: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
    gap: 2,
  },
  bookingDetailLine: {
    fontSize: 11,
    color: '#1F2937',
  },
  scanAgainBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  scanAgainBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  manualSection: {
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 8,
  },
  manualLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  textInput: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  submitBtn: {
    paddingHorizontal: 16,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
