import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  StyleSheet,
  Pressable,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/app-context';
import { Spacing } from '@/constants/theme';
import { CATEGORY_META, ListingCategory, CrowdStatus } from '@/constants/categories';
import { AppIcon } from './AppIcon';

export interface FilterState {
  category: string | null;
  town: string | null;
  verifiedOnly: boolean;
  accessibility: boolean;
  crowdStatus: CrowdStatus | 'ALL' | null;
  foodType: string | null;
  transportType: string | null;
  sortBy: 'name' | 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
}

export const INITIAL_FILTERS: FilterState = {
  category: null,
  town: null,
  verifiedOnly: false,
  accessibility: false,
  crowdStatus: null,
  foodType: null,
  transportType: null,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

export function countActiveFilters(filters: FilterState): number {
  let count = 0;
  if (filters.category && filters.category !== 'ALL') count++;
  if (filters.town && filters.town !== 'ALL') count++;
  if (filters.verifiedOnly) count++;
  if (filters.accessibility) count++;
  if (filters.crowdStatus && filters.crowdStatus !== 'ALL') count++;
  if (filters.foodType && filters.foodType !== 'ALL') count++;
  if (filters.transportType && filters.transportType !== 'ALL') count++;
  if (filters.sortBy !== 'createdAt' || filters.sortOrder !== 'desc') count++;
  return count;
}

export const AVAILABLE_TOWNS = [
  { id: 'ALL', label: 'All Locations', teLabel: 'అన్ని ప్రాంతాలు' },
  { id: 'Rajahmundry', label: 'Rajahmundry', teLabel: 'రాజమండ్రి' },
  { id: 'Kovvur', label: 'Kovvur', teLabel: 'కొవ్వూరు' },
  { id: 'Rajanagaram', label: 'Rajanagaram', teLabel: 'రాజానగరం' },
  { id: 'Dowleswaram', label: 'Dowleswaram', teLabel: 'ధవళేశ్వరం' },
  { id: 'Kotipalli', label: 'Kotipalli', teLabel: 'కోటిపల్లి' },
];

export const SORT_OPTIONS = [
  {
    sortBy: 'createdAt',
    sortOrder: 'desc',
    label: 'Newest First',
    teLabel: 'ఇటీవలివి మొదట',
  },
  {
    sortBy: 'name',
    sortOrder: 'asc',
    label: 'Name (A to Z)',
    teLabel: 'పేరు (A నుండి Z)',
  },
  {
    sortBy: 'name',
    sortOrder: 'desc',
    label: 'Name (Z to A)',
    teLabel: 'పేరు (Z నుండి A)',
  },
] as const;

export interface FilterSortModalProps {
  visible: boolean;
  onClose: () => void;
  filters: FilterState;
  onApply: (newFilters: FilterState) => void;
  onReset: () => void;
  hideCategoryFilter?: boolean;
}

export function FilterSortModal({
  visible,
  onClose,
  filters,
  onApply,
  onReset,
  hideCategoryFilter = false,
}: FilterSortModalProps) {
  const insets = useSafeAreaInsets();
  const { lang, colors, isDark, t } = useApp();

  const [draft, setDraft] = React.useState<FilterState>(filters);

  React.useEffect(() => {
    if (visible) {
      setDraft(filters);
    }
  }, [visible, filters]);

  const activeCount = countActiveFilters(draft);

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  const handleReset = () => {
    setDraft({
      ...INITIAL_FILTERS,
      category: hideCategoryFilter ? draft.category : null,
    });
    onReset();
  };

  const categories = Object.values(CATEGORY_META);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View
              style={[
                styles.sheetContainer,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  paddingBottom: Math.max(insets.bottom, 16) + 16,
                },
              ]}
            >
              {/* Modal Header */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <View style={styles.modalHeaderLeft}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>{t('filters')}</Text>
                  {activeCount > 0 && (
                    <View style={[styles.countPill, { backgroundColor: colors.secondary }]}>
                      <Text style={[styles.countPillText, { color: colors.primary }]}>
                        {activeCount} {lang === 'te' ? 'ఎంపిక చేయబడింది' : 'active'}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalHeaderActions}>
                  {activeCount > 0 && (
                    <Pressable
                      onPress={handleReset}
                      style={({ pressed }) => [styles.resetButton, pressed && { opacity: 0.6 }]}
                      hitSlop={6}
                    >
                      <Text style={[styles.resetButtonText, { color: colors.primary }]}>
                        {t('clearAll')}
                      </Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={onClose}
                    style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.7 }]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <AppIcon
                      name={{ ios: 'xmark', android: 'close', web: 'times' }}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                </View>
              </View>

              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* 1. Sort Options */}
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('sortBy')}</Text>
                  <View style={styles.chipRow}>
                    {SORT_OPTIONS.map((opt) => {
                      const isSelected =
                        draft.sortBy === opt.sortBy && draft.sortOrder === opt.sortOrder;
                      return (
                        <Pressable
                          key={`${opt.sortBy}-${opt.sortOrder}`}
                          onPress={() =>
                            setDraft((prev) => ({
                              ...prev,
                              sortBy: opt.sortBy as any,
                              sortOrder: opt.sortOrder as any,
                            }))
                          }
                          style={({ pressed }) => [
                            styles.chip,
                            {
                              backgroundColor: isSelected ? colors.primary : colors.background,
                              borderColor: isSelected ? colors.primary : colors.border,
                            },
                            pressed && { opacity: 0.8 },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: isSelected ? '#FFFFFF' : colors.text },
                            ]}
                          >
                            {lang === 'te' ? opt.teLabel : opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* 2. Category Filter (if not locked in a category screen) */}
                {!hideCategoryFilter && (
                  <View style={styles.sectionBlock}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      {t('categories')}
                    </Text>
                    <View style={styles.chipRow}>
                      <Pressable
                        onPress={() => setDraft((prev) => ({ ...prev, category: null }))}
                        style={({ pressed }) => [
                          styles.chip,
                          {
                            backgroundColor: !draft.category ? colors.primary : colors.background,
                            borderColor: !draft.category ? colors.primary : colors.border,
                          },
                          pressed && { opacity: 0.8 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: !draft.category ? '#FFFFFF' : colors.text },
                          ]}
                        >
                          {t('allCategories')}
                        </Text>
                      </Pressable>

                      {categories.map((cat) => {
                        const isSelected = draft.category === cat.id;
                        return (
                          <Pressable
                            key={cat.id}
                            onPress={() =>
                              setDraft((prev) => ({
                                ...prev,
                                category: isSelected ? null : cat.id,
                              }))
                            }
                            style={({ pressed }) => [
                              styles.chip,
                              {
                                backgroundColor: isSelected ? colors.primary : colors.background,
                                borderColor: isSelected ? colors.primary : colors.border,
                              },
                              pressed && { opacity: 0.8 },
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                { color: isSelected ? '#FFFFFF' : colors.text },
                              ]}
                            >
                              {lang === 'te' ? cat.teLabel : cat.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* 3. Town / Location Filter */}
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('filterByTown')}
                  </Text>
                  <View style={styles.chipRow}>
                    {AVAILABLE_TOWNS.map((tw) => {
                      const isSelected =
                        (!draft.town && tw.id === 'ALL') || draft.town === tw.id;
                      return (
                        <Pressable
                          key={tw.id}
                          onPress={() =>
                            setDraft((prev) => ({
                              ...prev,
                              town: tw.id === 'ALL' ? null : tw.id,
                            }))
                          }
                          style={({ pressed }) => [
                            styles.chip,
                            {
                              backgroundColor: isSelected ? colors.primary : colors.background,
                              borderColor: isSelected ? colors.primary : colors.border,
                            },
                            pressed && { opacity: 0.8 },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: isSelected ? '#FFFFFF' : colors.text },
                            ]}
                          >
                            {lang === 'te' ? tw.teLabel : tw.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* 4. Verified & Accessibility Toggles */}
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {lang === 'te' ? 'ప్రత్యేక ఎంపికలు' : 'Features & Facilities'}
                  </Text>
                  <View style={styles.toggleRow}>
                    <Pressable
                      onPress={() =>
                        setDraft((prev) => ({ ...prev, verifiedOnly: !prev.verifiedOnly }))
                      }
                      style={({ pressed }) => [
                        styles.togglePill,
                        {
                          backgroundColor: draft.verifiedOnly ? colors.secondary : colors.background,
                          borderColor: draft.verifiedOnly ? colors.primary : colors.border,
                        },
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <AppIcon
                        name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'check-circle' }}
                        size={16}
                        color={draft.verifiedOnly ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.togglePillText,
                          { color: draft.verifiedOnly ? colors.primary : colors.text },
                        ]}
                      >
                        {t('verifiedOnly')}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() =>
                        setDraft((prev) => ({ ...prev, accessibility: !prev.accessibility }))
                      }
                      style={({ pressed }) => [
                        styles.togglePill,
                        {
                          backgroundColor: draft.accessibility ? colors.secondary : colors.background,
                          borderColor: draft.accessibility ? colors.primary : colors.border,
                        },
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <AppIcon
                        name={{ ios: 'figure.roll', android: 'accessible', web: 'wheelchair' }}
                        size={16}
                        color={draft.accessibility ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.togglePillText,
                          { color: draft.accessibility ? colors.primary : colors.text },
                        ]}
                      >
                        {t('wheelchairAccess')}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* 5. Category-Specific: Restaurant Food Preference */}
                {(draft.category === 'RESTAURANT' || (!draft.category && !hideCategoryFilter)) && (
                  <View style={styles.sectionBlock}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      {t('foodPreference')}
                    </Text>
                    <View style={styles.chipRow}>
                      {[
                        { id: 'ALL', label: 'All', te: 'అన్నీ' },
                        { id: 'VEG', label: 'Pure Veg', te: 'శాకాహారం' },
                        { id: 'NON_VEG', label: 'Non-Veg', te: 'మాంసాహారం' },
                        { id: 'BOTH', label: 'Both', te: 'రెండూ' },
                      ].map((item) => {
                        const isSelected =
                          (!draft.foodType && item.id === 'ALL') || draft.foodType === item.id;
                        return (
                          <Pressable
                            key={item.id}
                            onPress={() =>
                              setDraft((prev) => ({
                                ...prev,
                                foodType: item.id === 'ALL' ? null : item.id,
                              }))
                            }
                            style={({ pressed }) => [
                              styles.chip,
                              {
                                backgroundColor: isSelected ? colors.primary : colors.background,
                                borderColor: isSelected ? colors.primary : colors.border,
                              },
                              pressed && { opacity: 0.8 },
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                { color: isSelected ? '#FFFFFF' : colors.text },
                              ]}
                            >
                              {lang === 'te' ? item.te : item.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* 6. Category-Specific: Ghat Crowd Level */}
                {(draft.category === 'GHAT' || (!draft.category && !hideCategoryFilter)) && (
                  <View style={styles.sectionBlock}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      {t('crowdLevelFilter')}
                    </Text>
                    <View style={styles.chipRow}>
                      {[
                        { id: 'ALL', label: 'All Levels', te: 'అన్ని స్థాయిలు' },
                        { id: 'FREE', label: 'Free / Low', te: 'తక్కువ రద్దీ' },
                        { id: 'MODERATE', label: 'Moderate', te: 'మధ్యస్థం' },
                        { id: 'CROWDED', label: 'Crowded', te: 'ఎక్కువ రద్దీ' },
                      ].map((item) => {
                        const isSelected =
                          (!draft.crowdStatus && item.id === 'ALL') ||
                          draft.crowdStatus === item.id;
                        return (
                          <Pressable
                            key={item.id}
                            onPress={() =>
                              setDraft((prev) => ({
                                ...prev,
                                crowdStatus: item.id === 'ALL' ? null : (item.id as any),
                              }))
                            }
                            style={({ pressed }) => [
                              styles.chip,
                              {
                                backgroundColor: isSelected ? colors.primary : colors.background,
                                borderColor: isSelected ? colors.primary : colors.border,
                              },
                              pressed && { opacity: 0.8 },
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                { color: isSelected ? '#FFFFFF' : colors.text },
                              ]}
                            >
                              {lang === 'te' ? item.te : item.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Action Footer */}
              <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
                <Pressable
                  onPress={handleApply}
                  style={({ pressed }) => [
                    styles.applyButton,
                    { backgroundColor: colors.primary },
                    pressed && { opacity: 0.85 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Apply Filters"
                >
                  <Text style={styles.applyButtonText}>
                    {t('applyFilters')} {activeCount > 0 ? `(${activeCount})` : ''}
                  </Text>
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resetButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  resetButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
  },
  modalScroll: {
    maxHeight: 460,
  },
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  sectionBlock: {
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  togglePillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalFooter: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    borderTopWidth: 1,
  },
  applyButton: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  applyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

