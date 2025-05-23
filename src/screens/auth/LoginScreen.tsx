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
} from 'react-native';
import { TextInput, ActivityIndicator } from 'react-native-paper';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { supabase } from '../../services/supabase';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthStack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

// Color constants
const COLORS = {
  primary: '#22c55e',         // Kitch Green
  background: '#FAF7F0',      // Light warm background
  white: '#FFFFFF',
  text: '#374151',            // Dark text
  textLight: '#6b7280',       // Muted gray text
  textMedium: '#556373',      // Medium gray text
  border: '#d1d5db',          // Border gray
  borderLight: '#E5E7EB',     // Lighter border
  error: '#ef4444',           // Error red
};

export default function LoginScreen() {
  const nav = useNavigation<Nav>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [secureTextEntry, setSecureTextEntry] = useState(true);
  const videoRef = useRef<Video>(null);
  const [videoStatus, setVideoStatus] = useState({
    isPlaying: false,
    isLoaded: false,
    error: null as string | null,
  });

  // Set up video to play when loaded
  useEffect(() => {
    if (videoRef.current && videoStatus.isLoaded) {
      videoRef.current.playAsync().catch(error => {
        console.error('Error playing video:', error);
      });
    }
  }, [videoStatus.isLoaded]);

  const onLogin = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);

    if (error) {
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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Background Video */}
      <View style={styles.videoContainer}>
        <Video
          ref={videoRef}
          source={{ uri: 'https://stream.mux.com/N02BoIP01zPNboqHJ6TuTDaQBVAkWoEL6aF4fLPk00EKNM.m3u8' }}
          style={styles.backgroundVideo}
          resizeMode={ResizeMode.COVER}
          shouldPlay={false} // Will be played once loaded via useEffect
          isLooping
          isMuted
          onLoad={handleVideoLoad}
          onError={(error) => {
            console.error('Video error event:', error);
            setVideoStatus({
              isLoaded: false,
              isPlaying: false,
              error: 'Error playing video',
            });
          }}
        />
        <View style={styles.overlay} />
      </View>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.cardContainer}>
            {/* Branding */}
            <View style={styles.brandingContainer}>
              <Text style={styles.welcomeText}>Welcome back to</Text>
              <Text style={styles.brandText}>Kitch</Text>
              <Text style={styles.taglineText}>AI-powered cooking made personal.</Text>
            </View>
            
            {/* Form Fields */}
            <View style={styles.formContainer}>
              {/* Email Input */}
              <View style={styles.inputContainer}>
                <MaterialCommunityIcons name="email-outline" size={22} color={COLORS.textLight} style={styles.inputIcon} />
                <TextInput
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  mode="flat"
                  style={styles.input}
                  underlineColor={COLORS.borderLight}
                  activeUnderlineColor={COLORS.primary}
                  theme={{ 
                    colors: { 
                      primary: COLORS.primary,
                      text: COLORS.text,
                      placeholder: COLORS.textLight,
                      background: COLORS.white,
                    },
                  }}
                />
              </View>
              
              {/* Password Input */}
              <View style={styles.inputContainer}>
                <MaterialCommunityIcons name="lock-outline" size={22} color={COLORS.textLight} style={styles.inputIcon} />
                <TextInput
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={secureTextEntry}
                  mode="flat"
                  style={styles.input}
                  underlineColor={COLORS.borderLight}
                  activeUnderlineColor={COLORS.primary}
                  right={<TextInput.Icon icon={secureTextEntry ? "eye" : "eye-off"} onPress={toggleSecureEntry} />}
                  theme={{ 
                    colors: { 
                      primary: COLORS.primary,
                      text: COLORS.text,
                      placeholder: COLORS.textLight,
                      background: COLORS.white,
                    },
                  }}
                />
              </View>
              
              {/* Forgot Password */}
              <TouchableOpacity 
                style={styles.forgotPasswordContainer}
                onPress={() => Alert.alert("Forgot Password", "Password reset functionality coming soon.")}
              >
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>
              
              {/* Login Button */}
              <TouchableOpacity 
                style={[styles.loginButton, (!email || !password || isLoading) && styles.loginButtonDisabled]}
                onPress={onLogin}
                disabled={!email || !password || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.loginButtonText}>Log in</Text>
                )}
              </TouchableOpacity>
              
              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>
              
              {/* Google Button */}
              <TouchableOpacity 
                style={styles.googleButton}
                onPress={() => Alert.alert("Google Sign-In", "Coming soon!")}
              >
                <View style={styles.googleButtonContent}>
                  <View style={styles.googleIconContainer}>
                    <Text style={styles.googleIcon}>G</Text>
                  </View>
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </View>
              </TouchableOpacity>
              
              {/* Sign Up Link */}
              <View style={styles.signupContainer}>
                <Text style={styles.signupText}>Don't have an account?</Text>
                <TouchableOpacity 
                  onPress={() => !isLoading && nav.replace('Signup')}
                  style={styles.signupButton}
                >
                  <Text style={styles.signupButtonText}>Sign up</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
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
    height: height,
    width: width,
  },
  backgroundVideo: {
    ...StyleSheet.absoluteFillObject,
    height: height,
    width: width,
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
    marginBottom: 20,
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
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: 4,
    marginBottom: 24,
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
  loginButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
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
  googleIcon: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4285F4', // Google blue
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