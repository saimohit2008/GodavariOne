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
import {
  loginWithPhone,
  registerWithPhone,
  requestEmailOtp,
  verifyEmailOtp,
} from '../../services/api';

export interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialMode?: 'LOGIN' | 'EMAIL_OTP' | 'REGISTER';
}

export function AuthModal({
  visible,
  onClose,
  onSuccess,
  initialMode = 'LOGIN',
}: AuthModalProps) {
  const { lang, colors, isDark, t, setUser } = useApp();

  const [mode, setMode] = useState<'LOGIN' | 'EMAIL_OTP' | 'REGISTER'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setOtpCode('');
    setOtpSent(false);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSendOtp = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage(
        lang === 'te'
          ? 'దయచేసి సరైన ఈమెయిల్ చిరునామాను నమోదు చేయండి'
          : 'Please enter a valid email address'
      );
      return;
    }
    setLoading(true);
    try {
      const res = await requestEmailOtp(cleanEmail);
      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setOtpSent(true);
        setSuccessMessage(
          lang === 'te'
            ? 'ధృవీకరణ కోడ్ మీ ఈమెయిల్‌కు పంపబడింది'
            : 'Verification code sent to your email'
        );
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to send OTP code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length < 4) {
      setErrorMessage(
        lang === 'te'
          ? 'దయచేసి 6 అంకెల కోడ్‌ను నమోదు చేయండి'
          : 'Please enter the verification code'
      );
      return;
    }
    setLoading(true);
    try {
      const res = await verifyEmailOtp(cleanEmail, cleanCode);
      if (res.data) {
        setUser(res.data);
        setSuccessMessage(t('signInSuccessful'));
        setTimeout(() => {
          handleClose();
          onSuccess?.();
        }, 600);
      } else {
        setErrorMessage(res.error || 'Invalid verification code');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanPhone = phone.trim();
    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMessage(
        lang === 'te'
          ? 'దయచేసి సరైన 10 అంకెల మొబైల్ సంఖ్యను నమోదు చేయండి'
          : 'Please enter a valid 10-digit mobile number'
      );
      return;
    }

    if (!password || password.length < 8) {
      setErrorMessage(
        lang === 'te'
          ? 'పాస్‌వర్డ్ కనీసం 8 అక్షరాలు ఉండాలి'
          : 'Password must be at least 8 characters'
      );
      return;
    }

    if (mode === 'REGISTER') {
      if (password !== confirmPassword) {
        setErrorMessage(
          lang === 'te'
            ? 'పాస్‌వర్డ్‌లు సరిపోలడం లేదు'
            : 'Passwords do not match'
        );
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'LOGIN') {
        const res = await loginWithPhone(cleanPhone, password);
        if (res.data) {
          setUser(res.data);
          setSuccessMessage(t('signInSuccessful'));
          setTimeout(() => {
            handleClose();
            onSuccess?.();
          }, 600);
        } else {
          setErrorMessage(res.error || 'Login failed. Please check credentials.');
        }
      } else {
        const res = await registerWithPhone({
          phone: cleanPhone,
          password,
          confirmPassword,
          name: name.trim() || undefined,
          email: email.trim() || undefined,
        });
        if (res.data) {
          setUser(res.data);
          setSuccessMessage(t('registeredSuccessful'));
          setTimeout(() => {
            handleClose();
            onSuccess?.();
          }, 600);
        } else {
          setErrorMessage(res.error || 'Registration failed.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error. Please try again.');
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
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.backdropPressable} onPress={handleClose} />

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
              <View style={[styles.brandIconCircle, { backgroundColor: colors.primaryLight }]}>
                <AppIcon
                  name={{ ios: 'person.badge.shield.checkmark.fill', android: 'verified_user', web: 'shield' }}
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.text }]}>
                  {mode === 'LOGIN' ? t('signIn') : t('register')}
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  {lang === 'te'
                    ? 'గోదావరి పుష్కరాలు 2027 అధికారిక ఖాతా'
                    : 'Godavari Pushkaralu 2027 Pilgrim Account'}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={handleClose}
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

          {/* Mode Switch Tabs */}
          <View style={[styles.tabBar, { backgroundColor: colors.secondary }]}>
            <Pressable
              onPress={() => {
                setMode('LOGIN');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              style={[
                styles.tabButton,
                mode === 'LOGIN' && [styles.activeTab, { backgroundColor: colors.card }],
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: mode === 'LOGIN' ? colors.primary : colors.textSecondary },
                  mode === 'LOGIN' && styles.activeTabText,
                ]}
              >
                {t('signIn')}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setMode('EMAIL_OTP');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              style={[
                styles.tabButton,
                mode === 'EMAIL_OTP' && [styles.activeTab, { backgroundColor: colors.card }],
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: mode === 'EMAIL_OTP' ? colors.primary : colors.textSecondary },
                  mode === 'EMAIL_OTP' && styles.activeTabText,
                ]}
              >
                {lang === 'te' ? 'ఈమెయిల్ OTP' : 'Email OTP'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setMode('REGISTER');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              style={[
                styles.tabButton,
                mode === 'REGISTER' && [styles.activeTab, { backgroundColor: colors.card }],
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: mode === 'REGISTER' ? colors.primary : colors.textSecondary },
                  mode === 'REGISTER' && styles.activeTabText,
                ]}
              >
                {t('register')}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.formContainer}
          >
            {/* Feedback messages */}
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

            {successMessage && (
              <View style={[styles.alertBox, { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' }]}>
                <AppIcon
                  name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check-circle' }}
                  size={15}
                  color="#059669"
                />
                <Text style={styles.successAlertText}>{successMessage}</Text>
              </View>
            )}

            {/* EMAIL OTP FLOW */}
            {mode === 'EMAIL_OTP' ? (
              <>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    {t('emailAddress')}
                  </Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="name@example.com"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!otpSent}
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.secondary,
                        color: colors.text,
                        borderColor: colors.border,
                        opacity: otpSent ? 0.8 : 1,
                      },
                    ]}
                  />
                </View>

                {otpSent ? (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                        {lang === 'te' ? '6-అంకెల ధృవీకరణ కోడ్' : '6-Digit Verification Code'}
                      </Text>
                      <TextInput
                        value={otpCode}
                        onChangeText={setOtpCode}
                        placeholder="123456"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="number-pad"
                        maxLength={8}
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.secondary,
                            color: colors.text,
                            borderColor: colors.border,
                            letterSpacing: 4,
                            fontWeight: '700',
                            textAlign: 'center',
                          },
                        ]}
                      />
                    </View>

                    <Pressable
                      onPress={handleVerifyOtp}
                      disabled={loading}
                      accessibilityRole="button"
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
                        <Text style={styles.submitButtonText}>
                          {lang === 'te' ? 'కోడ్ ధృవీకరించండి & లాగిన్' : 'Verify Code & Sign In'}
                        </Text>
                      )}
                    </Pressable>

                    <Pressable
                      onPress={handleSendOtp}
                      disabled={loading}
                      style={styles.resendBtn}
                    >
                      <Text style={[styles.resendBtnText, { color: colors.primary }]}>
                        {lang === 'te' ? 'మళ్లీ కోడ్ పంపండి' : 'Resend Code'}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    onPress={handleSendOtp}
                    disabled={loading}
                    accessibilityRole="button"
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
                      <Text style={styles.submitButtonText}>
                        {lang === 'te' ? 'OTP కోడ్ పంపండి' : 'Send Verification Code'}
                      </Text>
                    )}
                  </Pressable>
                )}
              </>
            ) : (
              <>
                {/* Registration-only fields */}
                {mode === 'REGISTER' && (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                      {t('fullName')}
                    </Text>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder={lang === 'te' ? 'ఉదా. రమేష్ కుమార్' : 'e.g. Ramesh Kumar'}
                      placeholderTextColor={colors.textMuted}
                      style={[styles.input, { backgroundColor: colors.secondary, color: colors.text, borderColor: colors.border }]}
                    />
                  </View>
                )}

                {/* Mobile number */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    {t('phoneNumber')}
                  </Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder={lang === 'te' ? '10 అంకెల మొబైల్ సంఖ్య' : '9876543210'}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    maxLength={13}
                    style={[styles.input, { backgroundColor: colors.secondary, color: colors.text, borderColor: colors.border }]}
                  />
                </View>

                {/* Email (Optional in Registration) */}
                {mode === 'REGISTER' && (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                      {t('emailAddress')}
                    </Text>
                    <TextInput
                      value={email}
                      onChangeText={setEmail}
                      placeholder="name@example.com"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      style={[styles.input, { backgroundColor: colors.secondary, color: colors.text, borderColor: colors.border }]}
                    />
                  </View>
                )}

                {/* Password */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                    {t('password')}
                  </Text>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry
                    style={[styles.input, { backgroundColor: colors.secondary, color: colors.text, borderColor: colors.border }]}
                  />
                </View>

                {/* Confirm Password (Registration only) */}
                {mode === 'REGISTER' && (
                  <View style={styles.inputGroup}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                      {t('confirmPassword')}
                    </Text>
                    <TextInput
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="••••••••"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry
                      style={[styles.input, { backgroundColor: colors.secondary, color: colors.text, borderColor: colors.border }]}
                    />
                  </View>
                )}

                {/* Submit Button */}
                <Pressable
                  onPress={handleSubmit}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel={mode === 'LOGIN' ? 'Log in' : 'Create account'}
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
                    <Text style={styles.submitButtonText}>
                      {mode === 'LOGIN' ? t('signIn') : t('register')}
                    </Text>
                  )}
                </Pressable>
              </>
            )}

            {/* Privacy notice */}
            <Text style={[styles.footerNotice, { color: colors.textMuted }]}>
              {lang === 'te'
                ? 'మీ వ్యక్తిగత సమాచారం సురక్షితంగా రక్షించబడుతుంది. గోదావరి పుష్కరాలు 2027 యాత్రికుల రక్షణ నిబంధనలకు కట్టుబడి ఉన్నాము.'
                : 'Your contact credentials are securely protected under Godavari One Pilgrim Safety standards.'}
            </Text>
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
    maxHeight: '90%',
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
  brandIconCircle: {
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
  tabBar: {
    flexDirection: 'row',
    margin: Spacing.four,
    borderRadius: 12,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 9,
  },
  activeTab: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  activeTabText: {
    fontWeight: '800',
  },
  formContainer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
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
  successAlertText: {
    color: '#065F46',
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
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  submitButton: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  resendBtn: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resendBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  footerNotice: {
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 6,
  },
});
