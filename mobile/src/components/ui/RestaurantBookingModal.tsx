import React, { useState } from 'react';
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
import { createRestaurantBooking } from '../../services/api';
import { ListingItem } from '../../types';

export interface RestaurantBookingModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (bookingId?: string) => void;
  listing?: ListingItem | null;
}

const TIME_SLOTS = [
  '12:00 PM - 01:00 PM',
  '01:00 PM - 02:00 PM',
  '02:00 PM - 03:00 PM',
  '07:00 PM - 08:00 PM',
  '08:00 PM - 09:00 PM',
  '09:00 PM - 10:00 PM',
];

export function RestaurantBookingModal({
  visible,
  onClose,
  onSuccess,
  listing,
}: RestaurantBookingModalProps) {
  const { lang, colors, isDark, t, user } = useApp();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [bookingDate, setBookingDate] = useState('2027-07-15');
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[0]);
  const [peopleCount, setPeopleCount] = useState(2);
  const [specialRequest, setSpecialRequest] = useState('');

  if (!listing) return null;

  const handleSubmit = async () => {
    setErrorMessage(null);

    if (!bookingDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      setErrorMessage(
        lang === 'te'
          ? 'తేదీ YYYY-MM-DD ఫార్మాట్‌లో ఉండాలి (ఉదా. 2027-07-15)'
          : 'Booking date must be in YYYY-MM-DD format (e.g. 2027-07-15)'
      );
      return;
    }

    if (peopleCount < 1 || peopleCount > 30) {
      setErrorMessage(
        lang === 'te'
          ? 'వ్యక్తుల సంఖ్య 1 నుండి 30 మధ్య ఉండాలి'
          : 'Guest count must be between 1 and 30'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await createRestaurantBooking({
        listingId: listing.id,
        bookingDate,
        timeSlot,
        peopleCount,
        specialRequest: specialRequest.trim() || undefined,
      });

      if (res.data) {
        onSuccess(res.data.id);
        onClose();
      } else {
        setErrorMessage(res.error || 'Failed to submit restaurant reservation');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error submitting reservation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitleCol}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {lang === 'te' ? 'టేబుల్ రిజర్వేషన్' : 'Reserve a Table'}
              </Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {listing.name}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton} hitSlop={8}>
              <AppIcon name={{ ios: 'xmark', android: 'close', web: 'times' }} size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            {errorMessage && (
              <View style={[styles.errorBox, { backgroundColor: isDark ? '#3E1F24' : '#FEE2E2', borderColor: '#FCA5A5' }]}>
                <AppIcon name={{ ios: 'exclamationmark.triangle.fill', android: 'error', web: 'exclamation-circle' }} size={16} color="#DC2626" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Date Input */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>
                {lang === 'te' ? 'రిజర్వేషన్ తేదీ (YYYY-MM-DD)' : 'Reservation Date (YYYY-MM-DD)'}
              </Text>
              <TextInput
                value={bookingDate}
                onChangeText={setBookingDate}
                placeholder="2027-07-15"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { backgroundColor: colors.secondary, color: colors.text, borderColor: colors.border }]}
              />
            </View>

            {/* Time Slot Selection */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>
                {lang === 'te' ? 'సమయ స్లాట్' : 'Select Time Slot'}
              </Text>
              <View style={styles.slotGrid}>
                {TIME_SLOTS.map((slot) => {
                  const isSelected = slot === timeSlot;
                  return (
                    <Pressable
                      key={slot}
                      onPress={() => setTimeSlot(slot)}
                      style={[
                        styles.slotPill,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.secondary,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.slotText,
                          { color: isSelected ? '#FFFFFF' : colors.text },
                        ]}
                      >
                        {slot}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* People Count */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>
                {lang === 'te' ? 'వ్యక్తుల సంఖ్య' : 'Number of Guests'}
              </Text>
              <View style={styles.counterRow}>
                {[1, 2, 4, 6, 8, 10].map((num) => {
                  const isSelected = peopleCount === num;
                  return (
                    <Pressable
                      key={num}
                      onPress={() => setPeopleCount(num)}
                      style={[
                        styles.counterPill,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.secondary,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.counterText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                        {num}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Special Request */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>
                {lang === 'te' ? 'ప్రత్యేక అభ్యర్థనలు (ఐచ్ఛికం)' : 'Special Requests (Optional)'}
              </Text>
              <TextInput
                value={specialRequest}
                onChangeText={setSpecialRequest}
                placeholder={lang === 'te' ? 'ఉదా. కుటుంబ భోజనం లేదా స్వచ్ఛమైన శాకాహారం' : 'e.g. Vegetarian preference, baby high-chair'}
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                style={[styles.textArea, { backgroundColor: colors.secondary, color: colors.text, borderColor: colors.border }]}
              />
            </View>
          </ScrollView>

          {/* Footer Submit */}
          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              style={[
                styles.submitButton,
                { backgroundColor: colors.primary },
                loading && { opacity: 0.7 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {lang === 'te' ? 'రిజర్వేషన్ ధృవీకరించండి' : 'Confirm Table Reservation'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  headerTitleCol: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
  },
  formScroll: {
    padding: Spacing.four,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: Spacing.three,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    flex: 1,
    fontWeight: '600',
  },
  fieldGroup: {
    marginBottom: Spacing.three,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textArea: {
    minHeight: 70,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  slotText: {
    fontSize: 12,
    fontWeight: '600',
  },
  counterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  counterPill: {
    width: 44,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalFooter: {
    padding: Spacing.four,
    borderTopWidth: 1,
  },
  submitButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
