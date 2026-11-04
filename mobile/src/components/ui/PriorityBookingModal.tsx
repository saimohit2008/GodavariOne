import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useApp } from '../../context/app-context';
import { Spacing, Shadows } from '../../constants/theme';
import { AppIcon } from './AppIcon';
import { getGhats, submitPriorityBooking } from '../../services/api';
import { ListingItem } from '../../types';

export interface PriorityBookingModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (applicationNumber: string) => void;
  preselectedGhatId?: string;
}

export function PriorityBookingModal({
  visible,
  onClose,
  onSuccess,
  preselectedGhatId,
}: PriorityBookingModalProps) {
  const { lang, colors, isDark, t, user } = useApp();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ghats, setGhats] = useState<ListingItem[]>([]);

  // Form fields
  const [category, setCategory] = useState<'SENIOR_CITIZEN' | 'PERSON_WITH_DISABILITY'>('SENIOR_CITIZEN');
  const [ghatId, setGhatId] = useState(preselectedGhatId || '');
  const [beneficiaryName, setBeneficiaryName] = useState(user?.name || '');
  const [beneficiaryDob, setBeneficiaryDob] = useState('1958-05-15');
  const [beneficiaryPhone, setBeneficiaryPhone] = useState(user?.phone || '');
  const [visitDate, setVisitDate] = useState('2027-07-15');
  const [accompanyingCount, setAccompanyingCount] = useState<number>(1);
  const [accessibilityNeeds, setAccessibilityNeeds] = useState('');
  const [consentGiven, setConsentGiven] = useState(true);

  useEffect(() => {
    if (visible) {
      getGhats().then((res) => {
        setGhats(res.data);
        if (!ghatId && res.data.length > 0) {
          setGhatId(res.data[0].id);
        }
      });
      if (user?.name && !beneficiaryName) setBeneficiaryName(user.name);
      if (user?.phone && !beneficiaryPhone) setBeneficiaryPhone(user.phone);
    }
  }, [visible, user]);

  const handleSubmit = async () => {
    setErrorMessage(null);

    if (!beneficiaryName.trim() || beneficiaryName.trim().length < 2) {
      setErrorMessage(
        lang === 'te'
          ? 'దయచేసి లబ్ధిదారుని పూర్తి పేరు నమోదు చేయండి'
          : 'Please enter the beneficiary full name'
      );
      return;
    }

    const cleanPhone = beneficiaryPhone.trim().replace(/[\s-]/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMessage(
        lang === 'te'
          ? 'దయచేసి సరైన 10 అంకెల మొబైల్ సంఖ్యను నమోదు చేయండి'
          : 'Please enter a valid 10-digit contact mobile number'
      );
      return;
    }

    if (!ghatId) {
      setErrorMessage(
        lang === 'te'
          ? 'దయచేసి ఒక ఘాట్‌ను ఎంచుకోండి'
          : 'Please select a destination pushkar ghat'
      );
      return;
    }

    if (!visitDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      setErrorMessage(
        lang === 'te'
          ? 'దర్శన తేదీ YYYY-MM-DD ఫార్మాట్‌లో ఉండాలి (ఉదా. 2027-07-15)'
          : 'Visit date must be in YYYY-MM-DD format (e.g. 2027-07-15)'
      );
      return;
    }

    if (category === 'SENIOR_CITIZEN') {
      if (!beneficiaryDob.match(/^\d{4}-\d{2}-\d{2}$/)) {
        setErrorMessage(
          lang === 'te'
            ? 'పుట్టిన తేదీ YYYY-MM-DD ఫార్మాట్‌లో ఉండాలి (ఉదా. 1958-05-15)'
            : 'Date of birth must be in YYYY-MM-DD format'
        );
        return;
      }
    }

    if (!consentGiven) {
      setErrorMessage(
        lang === 'te'
          ? 'దయచేసి నిబంధనలను ధృవీకరించండి'
          : 'Please accept the pilgrim declaration to proceed'
      );
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('category', category);
      formData.append('beneficiaryName', beneficiaryName.trim());
      formData.append('beneficiaryPhone', cleanPhone);
      formData.append('ghatId', ghatId);
      formData.append('visitDate', visitDate.trim());
      formData.append('accompanyingCount', String(accompanyingCount));
      formData.append('applicantDeclaration', 'true');
      formData.append('consentGiven', 'true');

      if (category === 'SENIOR_CITIZEN') {
        formData.append('beneficiaryDob', beneficiaryDob.trim());
      }
      if (accessibilityNeeds.trim()) {
        formData.append('accessibilityNeeds', accessibilityNeeds.trim());
      }
      if (user?.email) {
        formData.append('beneficiaryEmail', user.email);
      }

      const res = await submitPriorityBooking(formData);
      if (res.data && res.data.success) {
        onSuccess(res.data.applicationNumber);
        onClose();
      } else {
        setErrorMessage(
          res.error || 'Booking submission failed. Please ensure all details are accurate.'
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error while submitting priority booking');
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.backdropPressable} onPress={onClose} />

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
          {/* Header Row */}
          <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.passIconCircle, { backgroundColor: '#FDE68A' }]}>
                <AppIcon
                  name={{ ios: 'star.circle.fill', android: 'military_tech', web: 'star' }}
                  size={18}
                  color="#B45309"
                />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.text }]}>
                  {t('priorityGhatBooking')}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {lang === 'te'
                    ? 'ఉచిత ప్రాధాన్యత స్నాన సమయం & సహాయం'
                    : 'Fast-Track Slot & Ramp Assistance Passes'}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
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
            contentContainerStyle={styles.formContainer}
          >
            {/* Error Message */}
            {errorMessage && (
              <View style={[styles.alertBox, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
                <AppIcon
                  name={{ ios: 'exclamationmark.circle.fill', android: 'error', web: 'exclamation-circle' }}
                  size={15}
                  color="#DC2626"
                />
                <Text style={styles.errorAlertText}>{errorMessage}</Text>
              </View>
            )}

            {/* Category Selector */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {lang === 'te' ? 'అర్హత విభాగం' : 'Eligibility Category'}
              </Text>
              <View style={styles.categoryPillRow}>
                <Pressable
                  onPress={() => setCategory('SENIOR_CITIZEN')}
                  style={[
                    styles.categoryPill,
                    {
                      backgroundColor: category === 'SENIOR_CITIZEN' ? colors.primary : colors.secondary,
                      borderColor: category === 'SENIOR_CITIZEN' ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryPillText,
                      { color: category === 'SENIOR_CITIZEN' ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    {lang === 'te' ? 'సీనియర్ సిటిజన్ (65+)' : 'Senior Citizen (65+)'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setCategory('PERSON_WITH_DISABILITY')}
                  style={[
                    styles.categoryPill,
                    {
                      backgroundColor: category === 'PERSON_WITH_DISABILITY' ? colors.primary : colors.secondary,
                      borderColor: category === 'PERSON_WITH_DISABILITY' ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryPillText,
                      { color: category === 'PERSON_WITH_DISABILITY' ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    {lang === 'te' ? 'దివ్యాంగులు (PWD)' : 'Person with Disability'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Destination Ghat Selector */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {t('selectGhat')}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ghatChipScroll}>
                {ghats.map((g) => {
                  const isSelected = ghatId === g.id;
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => setGhatId(g.id)}
                      style={[
                        styles.ghatChip,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.secondary,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.ghatChipText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                        {g.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Beneficiary Name */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {t('beneficiaryName')}
              </Text>
              <TextInput
                value={beneficiaryName}
                onChangeText={setBeneficiaryName}
                placeholder={lang === 'te' ? 'లబ్ధిదారుని పూర్తి పేరు' : 'Full Name'}
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { backgroundColor: colors.secondary, color: colors.text, borderColor: colors.border }]}
              />
            </View>

            {/* Date of Birth (Senior Citizen only) */}
            {category === 'SENIOR_CITIZEN' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  {t('beneficiaryDob')}
                </Text>
                <TextInput
                  value={beneficiaryDob}
                  onChangeText={setBeneficiaryDob}
                  placeholder="1958-05-15"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { backgroundColor: colors.secondary, color: colors.text, borderColor: colors.border }]}
                />
              </View>
            )}

            {/* Contact Phone */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {t('beneficiaryPhone')}
              </Text>
              <TextInput
                value={beneficiaryPhone}
                onChangeText={setBeneficiaryPhone}
                placeholder="9876543210"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                maxLength={13}
                style={[styles.input, { backgroundColor: colors.secondary, color: colors.text, borderColor: colors.border }]}
              />
            </View>

            {/* Proposed Visit Date */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {t('visitDate')}
              </Text>
              <TextInput
                value={visitDate}
                onChangeText={setVisitDate}
                placeholder="2027-07-15"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { backgroundColor: colors.secondary, color: colors.text, borderColor: colors.border }]}
              />
            </View>

            {/* Accompanying Attendants */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {t('accompanyingCount')}
              </Text>
              <View style={styles.attendantsRow}>
                {[0, 1, 2].map((num) => {
                  const isSelected = accompanyingCount === num;
                  return (
                    <Pressable
                      key={num}
                      onPress={() => setAccompanyingCount(num)}
                      style={[
                        styles.attendantBtn,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.secondary,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.attendantBtnText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                        {num === 0
                          ? lang === 'te' ? 'ఒంటరిగా (0)' : 'Alone (0)'
                          : lang === 'te' ? `${num} సహాయకుడు` : `+${num} Attendant`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Accessibility Needs */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                {t('accessibilityNeeds')}
              </Text>
              <TextInput
                value={accessibilityNeeds}
                onChangeText={setAccessibilityNeeds}
                placeholder={lang === 'te' ? 'ఉదా. వీల్‌చైర్ ర్యాంప్, బ్యాటరీ కార్ట్ సేవ' : 'e.g. Wheelchair ramp, battery cart assistance'}
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { backgroundColor: colors.secondary, color: colors.text, borderColor: colors.border }]}
              />
            </View>

            {/* Declaration Checkbox */}
            <Pressable
              onPress={() => setConsentGiven(!consentGiven)}
              style={styles.consentRow}
            >
              <View style={[styles.checkboxBox, { borderColor: consentGiven ? colors.primary : colors.border, backgroundColor: consentGiven ? colors.primary : 'transparent' }]}>
                {consentGiven && <Text style={styles.checkmarkText}>✓</Text>}
              </View>
              <Text style={[styles.consentText, { color: colors.textSecondary }]}>
                {t('acceptDeclaration')}
              </Text>
            </Pressable>

            {/* Submit Button */}
            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Submit priority booking"
              style={({ pressed }) => [
                styles.submitButton,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.85 },
                loading && { opacity: 0.6 },
              ]}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>{t('submitApplication')}</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  passIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
  formContainer: {
    padding: Spacing.four,
    gap: 12,
  },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorAlertText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  inputGroup: {
    gap: 5,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  categoryPillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryPill: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  ghatChipScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  ghatChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  ghatChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  attendantsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  attendantBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendantBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  consentText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  submitButton: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
