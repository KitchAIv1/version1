import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Alert,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
  Animated,
  Vibration,
} from 'react-native';
import { TextInput, ActivityIndicator } from 'react-native-paper';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthStackParamList } from '../../navigation/AuthStack';
import { supabase } from '../../services/supabase';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

// Color constants
const COLORS = {
  primary: '#22c55e', // Kitch Green
  primaryDark: '#16a34a', // Darker green for gradients
  background: '#FAF7F0', // Light warm background
  white: '#FFFFFF',
  text: '#374151', // Dark text
  textLight: '#6b7280', // Muted gray text
  textMedium: '#556373', // Medium gray text
  border: '#d1d5db', // Border gray
  borderLight: '#E5E7EB', // Lighter border
  error: '#ef4444', // Error red
  success: '#10b981', // Success green
  warning: '#f59e0b', // Warning orange
};

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const nav = useNavigation<Nav>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const videoRef = useRef<Video>(null);
  const [videoStatus, setVideoStatus] = useState({
    isPlaying: false,
    isLoaded: false,
    error: null as string | null,
  });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  // Input refs for better UX flow
  const emailInputRef = useRef<any>(null);
  const passwordInputRef = useRef<any>(null);

  // Set up video to play when loaded
  useEffect(() => {
    if (videoRef.current && videoStatus.isLoaded) {
      videoRef.current.playAsync().catch(error => {
        console.error('Error playing video:', error);
      });
    }
  }, [videoStatus.isLoaded]);

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Email validation
  const validateEmail = (email: string) => {
    if (!email) {
      setEmailError('Email is required');
      return false;
    }
    if (!EMAIL_REGEX.test(email)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError('');
    return true;
  };

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

  // Enhanced login with validation
  const onLogin = async () => {
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      Vibration.vibrate(100); // Haptic feedback for errors
      return;
    }

    setIsLoading(true);

    // Button press animation
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setIsLoading(false);

    if (error) {
      Vibration.vibrate(200); // Longer vibration for login error
      return Alert.alert('Login failed', error.message);
    }
    // Successful login handled by AuthProvider
  };

  const toggleSecureEntry = () => {
    setSecureTextEntry(!secureTextEntry);
  };

  const handleVideoLoad = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setVideoStatus({
        isLoaded: true,
        isPlaying: true,
        error: null,
      });
    } else if (status.error) {
      console.error('Video load error:', status.error);
      setVideoStatus({
        isLoaded: false,
        isPlaying: false,
        error: 'Failed to load video',
      });
    }
  };

  // Enhanced input handlers
  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (emailError && text) {
      validateEmail(text);
    }
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (passwordError && text) {
      validatePassword(text);
    }
  };

  const handleEmailSubmit = () => {
    validateEmail(email);
    passwordInputRef.current?.focus();
  };

  const handlePasswordSubmit = () => {
    if (validatePassword(password) && validateEmail(email)) {
      onLogin();
    }
  };

  const isFormValid = email && password && !emailError && !passwordError;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      {/* Background Video with Fallback */}
      <View style={styles.videoContainer}>
        {!videoStatus.error ? (
          <Video
            ref={videoRef}
            source={{
              uri: 'https://stream.mux.com/N02BoIP01zPNboqHJ6TuTDaQBVAkWoEL6aF4fLPk00EKNM.m3u8',
            }}
            style={styles.backgroundVideo}
            resizeMode={ResizeMode.COVER}
            shouldPlay={false}
            isLooping
            isMuted
            onLoad={handleVideoLoad}
            onError={error => {
              console.error('Video error event:', error);
              setVideoStatus({
                isLoaded: false,
                isPlaying: false,
                error: 'Error playing video',
              });
            }}
          />
        ) : (
          // Fallback gradient background
          <LinearGradient
            colors={['#16a34a', '#22c55e', '#34d399']}
            style={styles.backgroundVideo}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}
        <View style={styles.overlay} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Animated.View
            style={[
              styles.cardContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}>
            {/* Branding */}
            <View style={styles.brandingContainer}>
              <Text style={styles.welcomeText}>Welcome back to</Text>
              <Text style={styles.brandText}>Kitch</Text>
              <Text style={styles.taglineText}>
                AI-powered cooking made personal.
              </Text>
            </View>

            {/* Form Fields */}
            <View style={styles.formContainer}>
              {/* Email Input */}
              <View style={styles.inputContainer}>
                <MaterialCommunityIcons
                  name="email-outline"
                  size={22}
                  color={emailError ? COLORS.error : COLORS.textLight}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={emailInputRef}
                  label="Email"
                  value={email}
                  onChangeText={handleEmailChange}
                  onSubmitEditing={handleEmailSubmit}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                  mode="flat"
                  style={[styles.input, emailError && styles.inputError]}
                  underlineColor={
                    emailError ? COLORS.error : COLORS.borderLight
                  }
                  activeUnderlineColor={
                    emailError ? COLORS.error : COLORS.primary
                  }
                  error={!!emailError}
                  theme={{
                    colors: {
                      primary: emailError ? COLORS.error : COLORS.primary,
                      text: COLORS.text,
                      placeholder: COLORS.textLight,
                      background: COLORS.white,
                      error: COLORS.error,
                    },
                  }}
                />
                {emailError ? (
                  <Text style={styles.errorText}>{emailError}</Text>
                ) : null}
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <MaterialCommunityIcons
                  name="lock-outline"
                  size={22}
                  color={passwordError ? COLORS.error : COLORS.textLight}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordInputRef}
                  label="Password"
                  value={password}
                  onChangeText={handlePasswordChange}
                  onSubmitEditing={handlePasswordSubmit}
                  secureTextEntry={secureTextEntry}
                  returnKeyType="done"
                  mode="flat"
                  style={[styles.input, passwordError && styles.inputError]}
                  underlineColor={
                    passwordError ? COLORS.error : COLORS.borderLight
                  }
                  activeUnderlineColor={
                    passwordError ? COLORS.error : COLORS.primary
                  }
                  error={!!passwordError}
                  right={
                    <TextInput.Icon
                      icon={secureTextEntry ? 'eye' : 'eye-off'}
                      onPress={toggleSecureEntry}
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

              {/* Remember Me & Forgot Password Row */}
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.rememberMeContainer}
                  onPress={() => setRememberMe(!rememberMe)}>
                  <MaterialCommunityIcons
                    name={
                      rememberMe ? 'checkbox-marked' : 'checkbox-blank-outline'
                    }
                    size={20}
                    color={rememberMe ? COLORS.primary : COLORS.textLight}
                  />
                  <Text style={styles.rememberMeText}>Remember me</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.forgotPasswordContainer}
                  onPress={() =>
                    Alert.alert(
                      'Forgot Password',
                      'Password reset functionality coming soon.',
                    )
                  }>
                  <Text style={styles.forgotPasswordText}>
                    Forgot password?
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                  style={[
                    styles.loginButton,
                    !isFormValid && styles.loginButtonDisabled,
                    isFormValid && styles.loginButtonActive,
                  ]}
                  onPress={onLogin}
                  disabled={!isFormValid || isLoading}>
                  {isLoading ? (
                    <ActivityIndicator color={COLORS.white} size="small" />
                  ) : (
                    <>
                      <Text style={styles.loginButtonText}>Log in</Text>
                      <MaterialCommunityIcons
                        name="arrow-right"
                        size={20}
                        color={COLORS.white}
                        style={styles.loginButtonIcon}
                      />
                    </>
                  )}
                </TouchableOpacity>
              </Animated.View>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Enhanced Google Button */}
              <TouchableOpacity
                style={styles.googleButton}
                onPress={() => Alert.alert('Google Sign-In', 'Coming soon!')}>
                <View style={styles.googleButtonContent}>
                  <View style={styles.googleIconContainer}>
                    <MaterialCommunityIcons
                      name="google"
                      size={20}
                      color="#4285F4"
                    />
                  </View>
                  <Text style={styles.googleButtonText}>
                    Continue with Google
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Sign Up Link */}
              <View style={styles.signupContainer}>
                <Text style={styles.signupText}>Don't have an account?</Text>
                <TouchableOpacity
                  onPress={() => !isLoading && nav.replace('Signup')}
                  style={styles.signupButton}>
                  <Text style={styles.signupButtonText}>Sign up</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const { width, height } = Dimensions.get('window');
// const isSmallDevice = height < 700; // Removed as it's not currently used

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black', // Fallback color if video fails
  },
  videoContainer: {
    ...StyleSheet.absoluteFillObject,
    height,
    width,
  },
  backgroundVideo: {
    ...StyleSheet.absoluteFillObject,
    height,
    width,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)', // Darkened overlay to improve readability over video
  },
  keyboardAvoidView: {
    flex: 1,
    justifyContent: 'flex-end', // Push content to bottom half
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end', // Push content to bottom
  },
  cardContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 32,
    paddingBottom: 48, // Extra padding at bottom
  },
  brandingContainer: {
    alignItems: 'center',
    marginBottom: 40,
    paddingHorizontal: 24,
  },
  welcomeText: {
    fontSize: 18,
    color: COLORS.textMedium,
    marginBottom: 4,
  },
  brandText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 8,
  },
  taglineText: {
    fontSize: 14,
    color: COLORS.textLight,
    letterSpacing: 0.2,
  },
  formContainer: {
    width: '100%',
    paddingHorizontal: 24,
  },
  inputContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 0,
    top: 28,
    zIndex: 1,
  },
  input: {
    backgroundColor: COLORS.white,
    paddingLeft: 32, // Space for icon
    height: 60,
  },
  inputError: {
    borderColor: COLORS.error,
    borderWidth: 1,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rememberMeText: {
    color: COLORS.textLight,
    fontSize: 14,
    marginLeft: 8,
  },
  forgotPasswordContainer: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  forgotPasswordText: {
    color: COLORS.primary,
    fontWeight: '500',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    // Shadow
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonActive: {
    backgroundColor: COLORS.primaryDark,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  loginButtonIcon: {
    marginLeft: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.borderLight,
  },
  dividerText: {
    paddingHorizontal: 16,
    color: COLORS.textLight,
    fontSize: 14,
  },
  googleButton: {
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    borderRadius: 28,
    height: 56,
    marginBottom: 32,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  googleIconContainer: {
    marginRight: 12,
  },
  googleButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  signupText: {
    color: COLORS.textLight,
    fontSize: 15,
  },
  signupButton: {
    marginLeft: 8,
  },
  signupButtonText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 15,
  },
});
