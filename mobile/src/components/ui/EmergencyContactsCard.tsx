import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { EMERGENCY_CONTACTS, EmergencyContact } from '../../constants/categories';
import { useApp } from '../../context/app-context';
import { Spacing, Shadows } from '../../constants/theme';
import { AppIcon } from './AppIcon';

export interface EmergencyContactsCardProps {
  limit?: number;
}

export function EmergencyContactsCard({ limit }: EmergencyContactsCardProps) {
  const { lang, colors } = useApp();

  const contacts = limit ? EMERGENCY_CONTACTS.slice(0, limit) : EMERGENCY_CONTACTS;

  const handleCall = (number: string) => {
    Linking.openURL(`tel:${number}`).catch(() => {});
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        Shadows.card,
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={[styles.alertIconBadge, { backgroundColor: colors.dangerLight }]}>
            <AppIcon
              name={{ ios: 'shield.lefthalf.filled.badge.checkmark', android: 'emergency', web: 'shield-alt' }}
              size={16}
              color={colors.danger}
            />
          </View>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>
              {lang === 'te' ? 'అత్యవసర సంప్రదింపులు' : 'Emergency Contacts'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {lang === 'te'
                ? 'తక్షణ సహాయం కోసం 24/7 అందుబాటులో ఉండే హెల్ప్‌లైన్ నంబర్లు'
                : '24/7 dedicated helpline numbers for immediate assistance'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.list}>
        {contacts.map((c) => (
          <Pressable
            key={c.number}
            onPress={() => handleCall(c.number)}
            style={({ pressed }) => [
              styles.contactRow,
              {
                backgroundColor: colors.secondary,
                borderColor: colors.border,
              },
              pressed && { opacity: 0.75, backgroundColor: colors.dangerLight },
            ]}
          >
            <View style={styles.contactInfo}>
              <View style={styles.nameWithIcon}>
                <AppIcon
                  name={{ ios: 'phone.fill', android: 'call', web: 'phone' }}
                  size={14}
                  color={colors.danger}
                />
                <Text style={[styles.contactName, { color: colors.text }]}>
                  {lang === 'te' ? c.teName : c.name}
                </Text>
              </View>
              <Text style={[styles.contactDesc, { color: colors.textMuted }]}>
                {lang === 'te' ? c.teDescription : c.description}
              </Text>
            </View>

            <View style={[styles.numberBadge, { backgroundColor: colors.card }]}>
              <Text style={[styles.numberText, { color: colors.danger }]}>{c.number}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.four,
    marginBottom: Spacing.four,
  },
  header: {
    marginBottom: Spacing.three,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  alertIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  list: {
    gap: 8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  contactInfo: {
    flex: 1,
    gap: 2,
    marginRight: 8,
  },
  nameWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactName: {
    fontSize: 13,
    fontWeight: '700',
  },
  contactDesc: {
    fontSize: 10,
    marginLeft: 20,
  },
  numberBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.2)',
  },
  numberText: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
});
