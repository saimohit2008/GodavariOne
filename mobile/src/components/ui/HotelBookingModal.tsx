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
import { createHotelBooking } from '../../services/api';
import { ListingItem } from '../../types';

export interface HotelBookingModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (bookingId?: string) => void;
  listing?: ListingItem | null;
}

export function HotelBookingModal({
  visible,
  onClose,
  onSuccess,
  listing,
}: HotelBookingModalProps) {
  const { lang, colors, isDark, t } = useApp();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [checkIn, setCheckIn] = useState('2027-07-15');
  const [checkOut, setCheckOut] = useState('2027-07-17');
  const [guests, setGuests] = useState(2);
  const [rooms, setRooms] = useState(1);
  const [specialRequest, setSpecialRequest] = useState('');

  if (!listing) return null;

  const handleSubmit = async () => {
    setErrorMessage(null);

    if (!checkIn.match(/^\d{4}-\d{2}-\d{2}$/) || !checkOut.match(/^\d{4}-\d{2}-\d{2}$/)) {
      setErrorMessage(
        lang === 'te'
          ? 'తేదీలు YYYY-MM-DD ఫార్మాట్‌లో ఉండాలి'
          : 'Dates must be in YYYY-MM-DD format (e.g. 2027-07-15)'
      );
      return;
    }

    const cin = new Date(checkIn);
    const cout = new Date(checkOut);
    if (isNaN(cin.getTime()) || isNaN(cout.getTime()) || cout <= cin) {
      setErrorMessage(
        lang === 'te'
          ? 'చెక్‌అవుట్ తేదీ చెక్‌ఇన్ తేదీ తర్వాత ఉండాలి'
          : 'Check-out date must be strictly after check-in date'
      );
      return;
    }

    if (guests < 1 || guests > 20) {
      setErrorMessage(
        lang === 'te'
          ? 'అతిథుల సంఖ్య 1 నుండి 20 మధ్య ఉండాలి'
          : 'Guest count must be between 1 and 20'
      );
      return;
    }

    setLoading(true);
    try {
      const res = await createHotelBooking({
        listingId: listing.id,
        checkIn,
        checkOut,
        guests,
        rooms,
        specialRequest: specialRequest.trim() || undefined,
      });

      if (res.data) {
        onSuccess(res.data.id);
        onClose();
      } else {
        setErrorMessage(res.error || 'Failed to submit hotel reservation');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error submitting hotel booking');
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
                {lang === 'te' ? 'హోటల్ గది బుకింగ్' : 'Book Hotel Room'}
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

            {/* Dates Row */}
            <View style={styles.datesRow}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>
                  {lang === 'te' ? 'చెక్‌ఇన్ తేదీ' : 'Check-In Date'}
                </Text>
                <TextInput
                  value={checkIn}
                  onChangeText={setCheckIn}
                  placeholder="2027-07-15"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { backgroundColor: colors.secondary, color: colors.text, borderColor: colors.border }]}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>
                  {lang === 'te' ? 'చెక్‌అవుట్ తేదీ' : 'Check-Out Date'}
                </Text>
                <TextInput
                  value={checkOut}
                  onChangeText={setCheckOut}
                  placeholder="2027-07-17"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, { backgroundColor: colors.secondary, color: colors.text, borderColor: colors.border }]}
                />
              </View>
            </View>

            {/* Guests & Rooms Row */}
            <View style={styles.datesRow}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>
                  {lang === 'te' ? 'అతిథులు' : 'Guests'}
                </Text>
                <View style={styles.counterRow}>
                  {[1, 2, 3, 4, 6].map((num) => {
                    const isSelected = guests === num;
                    return (
                      <Pressable
                        key={num}
                        onPress={() => setGuests(num)}
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

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>
                  {lang === 'te' ? 'గదులు' : 'Rooms'}
                </Text>
                <View style={styles.counterRow}>
                  {[1, 2, 3].map((num) => {
                    const isSelected = rooms === num;
                    return (
                      <Pressable
                        key={num}
                        onPress={() => setRooms(num)}
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
            </View>

            {/* Special Requests */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>
                {lang === 'te' ? 'ప్రత్యేక అవసరాలు (ఐచ్ఛికం)' : 'Special Requests (Optional)'}
              </Text>
              <TextInput
                value={specialRequest}
                onChangeText={setSpecialRequest}
                placeholder={lang === 'te' ? 'ఉదా. గ్రౌండ్ ఫ్లోర్ రూమ్ లేదా లేట్ చెక్‌ఇన్' : 'e.g. Ground floor preferred, late check-in'}
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
                  {lang === 'te' ? 'గది బుకింగ్ ధృవీకరించండి' : 'Confirm Hotel Booking'}
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
  datesRow: {
    flexDirection: 'row',
    gap: 12,
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
  counterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  counterPill: {
    width: 38,
    height: 38,
    borderRadius: 8,
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
