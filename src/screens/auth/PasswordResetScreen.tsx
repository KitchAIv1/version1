import React, { useState } from 'react';
import {
  View,
  Text,
  Alert,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { TextInput, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthStack';
import { supabase } from '../../services/supabase';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'PasswordReset'>;

// Color constants
const COLORS = {
  primary: '#22c55e',
  primaryDark: '#16a34a',
  white: '#FFFFFF',
  text: '#374151',
  textLight: '#6b7280',
  border: '#d1d5db',
  borderLight: '#E5E7EB',
  error: '#ef4444',
  success: '#10b981',
  background: '#FAF7F0',
};

export default function PasswordResetScreen() {
  const navigation = useNavigation<Nav>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [secureConfirmEntry, setSecureConfirmEntry] = useState(true);
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  // Password validation
  const validatePassword = (password: string) => {
    if (!password) {
      setPasswordError('Password is required');
      return false;
    }
    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return false;
    }
    setPasswordError('');
    return true;
  };

  // Confirm password validation
  const validateConfirmPassword = (confirm: string) => {
    if (!confirm) {
      setConfirmError('Please confirm your password');
      return false;
    }
    if (confirm !== password) {
      setConfirmError('Passwords do not match');
      return false;
    }
    setConfirmError('');
    return true;
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (passwordError && text) {
      validatePassword(text);
    }
    // Re-validate confirm password if it exists
    if (confirmPassword) {
      validateConfirmPassword(confirmPassword);
    }
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    if (confirmError && text) {
      validateConfirmPassword(text);
    }
  };

  const onResetPassword = async () => {
    const isPasswordValid = validatePassword(password);
    const isConfirmValid = validateConfirmPassword(confirmPassword);

    if (!isPasswordValid || !isConfirmValid) {
      return;
    }

    try {
      setIsLoading(true);

      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw error;
      }

      Alert.alert(
        'Password Updated! 🎉',
        'Your password has been successfully updated. You can now log in with your new password.',
        [
          {
            text: 'Continue to Login',
            onPress: () => navigation.replace('Login'),
          },
        ],
      );
    } catch (error: any) {
      Alert.alert(
        'Reset Failed',
        error.message || 'Unable to update password. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = password && confirmPassword && !passwordError && !confirmError;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidView}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <MaterialCommunityIcons name="lock-reset" size={64} color={COLORS.primary} />
            <Text style={styles.title}>Reset Your Password</Text>
            <Text style={styles.subtitle}>
              Enter your new password below. Make sure it's secure and easy to remember.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* New Password Input */}
            <View style={styles.inputContainer}>
              <TextInput
                label="New Password"
                value={password}
                onChangeText={handlePasswordChange}
                secureTextEntry={secureTextEntry}
                mode="outlined"
                style={styles.input}
                outlineColor={passwordError ? COLORS.error : COLORS.borderLight}
                activeOutlineColor={passwordError ? COLORS.error : COLORS.primary}
                error={!!passwordError}
                // Prevent autofill yellow background and lockout issues
                autoComplete="new-password"
                textContentType="newPassword"
                importantForAutofill="yes"
                right={
                  <TextInput.Icon
                    icon={secureTextEntry ? 'eye' : 'eye-off'}
                    onPress={() => setSecureTextEntry(!secureTextEntry)}
                  />
                }
                theme={{
                  colors: {
                    primary: passwordError ? COLORS.error : COLORS.primary,
                    text: COLORS.text,
                    placeholder: COLORS.textLight,
                    background: COLORS.white,
                    error: COLORS.error,
                  },
                }}
              />
              {passwordError ? (
                <Text style={styles.errorText}>{passwordError}</Text>
              ) : null}
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputContainer}>
              <TextInput
                label="Confirm New Password"
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                secureTextEntry={secureConfirmEntry}
                mode="outlined"
                style={styles.input}
                outlineColor={confirmError ? COLORS.error : COLORS.borderLight}
                activeOutlineColor={confirmError ? COLORS.error : COLORS.primary}
                error={!!confirmError}
                // Prevent autofill yellow background and lockout issues
                autoComplete="new-password"
                textContentType="newPassword"
                importantForAutofill="yes"
                right={
                  <TextInput.Icon
                    icon={secureConfirmEntry ? 'eye' : 'eye-off'}
                    onPress={() => setSecureConfirmEntry(!secureConfirmEntry)}
                  />
                }
                theme={{
                  colors: {
                    primary: confirmError ? COLORS.error : COLORS.primary,
                    text: COLORS.text,
                    placeholder: COLORS.textLight,
                    background: COLORS.white,
                    error: COLORS.error,
                  },
                }}
              />
              {confirmError ? (
                <Text style={styles.errorText}>{confirmError}</Text>
              ) : null}
            </View>

            {/* Update Password Button */}
            <TouchableOpacity
              style={[
                styles.updateButton,
                !isFormValid && styles.updateButtonDisabled,
              ]}
              onPress={onResetPassword}
              disabled={!isFormValid || isLoading}>
              {isLoading ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <>
                  <Text style={styles.updateButtonText}>Update Password</Text>
                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={20}
                    color={COLORS.white}
                    style={styles.updateButtonIcon}
                  />
                </>
              )}
            </TouchableOpacity>

            {/* Back to Login */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.replace('Login')}
              disabled={isLoading}>
              <Text style={styles.backButtonText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardAvoidView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 24,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: COLORS.white,
    height: 56,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  updateButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  updateButtonDisabled: {
    opacity: 0.7,
  },
  updateButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  updateButtonIcon: {
    marginLeft: 8,
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '500',
  },
}); 