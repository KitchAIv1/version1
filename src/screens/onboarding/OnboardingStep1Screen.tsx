import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MainStackParamList } from '../../navigation/types';
import { useAuth } from '../../providers/AuthProvider';
import { supabase } from '../../services/supabase';
import { COLORS, SIZES } from '../../constants/theme';
import OnboardingProgress from '../../components/onboarding/OnboardingProgress';

const { width, height } = Dimensions.get('window');

// TODO: Define navigation props if needed
// type OnboardingStep1ScreenNavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'OnboardingStep1'>;

function OnboardingStep1Screen() {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<MainStackParamList, 'OnboardingStep1'>
    >();
  const { user, updateProfile, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  // Animation values
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);
  const logoScale = new Animated.Value(0.8);
  const buttonScale1 = new Animated.Value(0.95);
  const buttonScale2 = new Animated.Value(0.95);

  useEffect(() => {
    console.log('🎬 OnboardingStep1: Starting animations');
    
    // Entrance animations
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
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start((finished) => {
      console.log('🎬 OnboardingStep1 animations finished:', finished);
    });

    // 🚨 CRITICAL FIX: Failsafe to ensure content is visible (shorter timeout, less intrusive)
    const failsafeTimeout = setTimeout(() => {
      console.log('🚨 OnboardingStep1 FAILSAFE: Ensuring content visibility');
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      logoScale.setValue(1);
    }, 1000); // Reduced from 2000ms to 1000ms

    return () => clearTimeout(failsafeTimeout);
  }, []);

  const animateButton = (scaleValue: Animated.Value) => {
    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 0.98,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleValue, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleSelectRole = async (selectedRole: 'user' | 'creator') => {
    if (!user) {
      Alert.alert('Error', 'User not authenticated. Please try again.');
      return;
    }
    setIsLoading(true);
    try {
      console.log(
        `[OnboardingStep1] Attempting to set role for user ID: ${user.id} to: ${selectedRole}`,
      );

      // Step 2.4: Update Frontend to Handle Missing Profiles (User's new logic)
      // Fetch the existing profile to ensure it exists
      console.log('Fetching profile for id:', user.id);
      let { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id) // Using 'id' as per user's snippet
        .maybeSingle();

      if (fetchError) {
        console.error('Failed to fetch profile:', fetchError);
        Alert.alert('Error fetching profile. Please try again.');
        setIsLoading(false); // Ensure loading is stopped
        return;
      }

      if (!existingProfile) {
        console.log('Profile not found for id:', user.id, 'creating a new one');
        // Generate a unique username to avoid duplicates
        const baseUsername = user.email?.split('@')[0] || 'user';
        const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
        const uniqueUsername = `${baseUsername}_${timestamp}`;

        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id, // Assuming user.id is the UUID for profiles.id
            username: uniqueUsername,
            bio: 'Welcome to KitchHub!', // Default bio
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            role: null, // Will be updated shortly
            onboarded: false, // Will be updated shortly
            free_ai_generations_used: 0,
            free_scans_used: 0,
          })
          .select('id') // Select 'id' or enough fields to satisfy 'existingProfile'
          .single();

        if (createError) {
          console.error('Failed to create profile:', createError);
          Alert.alert('Failed to create profile. Please try again.');
          setIsLoading(false); // Ensure loading is stopped
          return;
        }
        existingProfile = newProfile; // Assign the newly created profile
        console.log('Profile created successfully:', existingProfile);
      }

      // Update the existing profile using RPC function (ensures proper tier assignment)
      // 🚨 CRITICAL FIX: Don't set onboarded=true yet! Only set role for now
      console.log(
        'Updating profile with role:',
        selectedRole,
        'onboarded: KEEPING FALSE (will be set in final step)',
        'for user ID:',
        user.id,
      );
      const { data: updateData, error: updateError } = await supabase.rpc(
        'update_profile',
        {
          p_user_id: user.id,
          p_role: selectedRole,
          // p_onboarded: true,  // ❌ REMOVED - Don't set onboarded yet!
          // Don't set p_username - let it keep the existing username from signup
        }
      );

      if (updateError) {
        console.error('Failed to update profile (1st attempt):', updateError);
        let retries = 0;
        const maxRetries = 2;
        let success = false;
        // Ensure finalUpdateData can hold either an array or null
        let finalUpdateData: any[] | null = updateData;

        while (retries < maxRetries && !success) {
          retries++;
          console.log(`Retrying profile update (${retries}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          const { data: retryData, error: retryError } = await supabase.rpc(
            'update_profile',
            {
              p_user_id: user.id,
              p_role: selectedRole,
              // p_onboarded: true,  // ❌ REMOVED - Don't set onboarded yet!
              // Don't set p_username - let it keep the existing username from signup
            }
          );

          if (retryError) {
            console.error(`Retry ${retries} failed:`, retryError);
            if (retries === maxRetries) {
              Alert.alert(
                'Failed to complete onboarding after retries. Please try again later.',
              );
            }
          } else {
            console.log('Profile updated successfully after retry:', retryData);
            finalUpdateData = retryData;
            success = true;
            break;
          }
        }
        if (!success) {
          setIsLoading(false); // Ensure loading is stopped
          return; // Exit if all retries failed
        }
        // Use finalUpdateData for logging if needed, e.g. console.log('Final update data:', finalUpdateData);
      } else {
        console.log('Profile updated successfully (1st attempt):', updateData);
      }

      // 3. Update local AuthContext state - BUT DON'T REFRESH YET!
      // 🚨 CRITICAL FIX: Don't call refreshProfile here as it causes AppNavigator to re-route
      // We'll refresh the profile only in the final onboarding step
      console.log('[OnboardingStep1] Skipping refreshProfile to prevent routing loop.');
      console.log('[OnboardingStep1] Profile will be refreshed in OnboardingFinalScreen.');
      
      // Update local state only to show the role selection worked
      if (updateProfile) {
        updateProfile({
          role: selectedRole,
          // Don't update onboarded - keep it false until final step
        });
      }

      // 4. Navigate
      if (selectedRole === 'user') {
        navigation.navigate('OnboardingStep2User');
      } else {
        navigation.navigate('OnboardingStep2Creator');
      }
    } catch (e: any) {
      console.error('[OnboardingStep1] Generic error in handleSelectRole:', e);
      if (
        !e.message?.includes('Could not save your role choice') &&
        !e.message?.includes('Could not verify your profile') &&
        !e.message?.includes('Your profile setup is incomplete')
      ) {
        Alert.alert(
          'An Unexpected Error Occurred',
          e.message || 'There was an issue selecting your role.',
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Background Gradient */}
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark, '#2E7D32']}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <OnboardingProgress currentStep={1} totalSteps={3} />
      </View>

      {/* Main Content */}
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Logo and Welcome */}
        <Animated.View 
          style={[
            styles.heroSection,
            { transform: [{ scale: logoScale }] },
          ]}
        >
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>🍳</Text>
          </View>
          <Text style={styles.welcomeTitle}>Welcome to</Text>
          <Text style={styles.brandTitle}>KitchAI</Text>
          <Text style={styles.subtitle}>Your AI-powered cooking companion</Text>
        </Animated.View>

        {/* Role Selection */}
        <View style={styles.roleSection}>
          <Text style={styles.roleQuestion}>What brings you here?</Text>
          
          {/* User Role Button */}
          <Animated.View style={{ transform: [{ scale: buttonScale1 }] }}>
            <TouchableOpacity
              style={[styles.roleButton, styles.userButton]}
              onPress={() => {
                animateButton(buttonScale1);
                handleSelectRole('user');
              }}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#FFFFFF', '#F8F9FA']}
                style={styles.buttonGradient}
              >
                <View style={styles.buttonContent}>
                  <View style={styles.iconContainer}>
                    <Ionicons name="restaurant" size={32} color={COLORS.primary} />
                  </View>
                  <View style={styles.buttonTextContainer}>
                    <Text style={styles.roleTitle}>I'm here to cook!</Text>
                    <Text style={styles.roleDescription}>
                      Discover recipes, scan ingredients, and get AI meal plans
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color={COLORS.gray} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Creator Role Button */}
          <Animated.View style={{ transform: [{ scale: buttonScale2 }] }}>
            <TouchableOpacity
              style={[styles.roleButton, styles.creatorButton]}
              onPress={() => {
                animateButton(buttonScale2);
                handleSelectRole('creator');
              }}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#FFFFFF', '#F8F9FA']}
                style={styles.buttonGradient}
              >
                <View style={styles.buttonContent}>
                  <View style={styles.iconContainer}>
                    <Ionicons name="videocam" size={32} color={COLORS.primary} />
                  </View>
                  <View style={styles.buttonTextContainer}>
                    <Text style={styles.roleTitle}>I'm here to create!</Text>
                    <Text style={styles.roleDescription}>
                      Share recipes, build following, and inspire others
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={24} color={COLORS.gray} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Loading Overlay */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.white} />
              <Text style={styles.loadingText}>Setting up your kitchen...</Text>
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  backgroundGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: height,
  },
  progressContainer: {
    marginTop: 60,
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoText: {
    fontSize: 40,
  },
  welcomeTitle: {
    fontSize: 24,
    color: COLORS.white,
    marginBottom: 8,
    opacity: 0.9,
  },
  brandTitle: {
    fontSize: 42,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    color: COLORS.white,
    textAlign: 'center',
    opacity: 0.8,
    lineHeight: 24,
  },
  roleSection: {
    marginBottom: 40,
  },
  roleQuestion: {
    fontSize: 22,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: 32,
  },
  roleButton: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  userButton: {},
  creatorButton: {},
  buttonGradient: {
    padding: 24,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  buttonTextContainer: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 6,
  },
  roleDescription: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.white,
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
});

export default OnboardingStep1Screen;
