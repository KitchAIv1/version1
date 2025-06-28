import React, { useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Animated, 
  Dimensions,
  StatusBar,
  ScrollView,
  SafeAreaView,
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

// TODO: Define navigation props
// type OnboardingFinalScreenNavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'OnboardingFinal'>;

function OnboardingFinalScreen() {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<MainStackParamList, 'OnboardingFinal'>
    >();
  const { user, refreshProfile } = useAuth();

  // Animation values
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(30);
  const confettiAnim = new Animated.Value(0);
  const pulseAnim = new Animated.Value(1);
  const buttonScale = new Animated.Value(0.95);

  useEffect(() => {
    // Enhanced entrance animations for smoother experience
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000, // Slightly longer for smoother feel
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800, // Longer duration for smoother slide
        useNativeDriver: true,
      }),
    ]).start();

    // Smoother confetti celebration animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(confettiAnim, {
          toValue: 1,
          duration: 4000, // Slower for more graceful movement
          useNativeDriver: true,
        }),
        Animated.timing(confettiAnim, {
          toValue: 0,
          duration: 1500, // Smoother fade out
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Gentler pulse animation for success icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05, // Reduced from 1.1 for subtler effect
          duration: 1500, // Slower pulse
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500, // Slower pulse
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.97, // Slightly less aggressive scale
        duration: 150, // Longer duration for smoother feel
        useNativeDriver: true,
      }),
      Animated.spring(buttonScale, {
        toValue: 1,
        tension: 100, // Smooth spring back
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleProceedToApp = async () => {
    animateButton();
    
    // 🚨 CRITICAL FIX: Set onboarded: true when completing onboarding
    if (user && refreshProfile) {
      try {
        console.log('Setting onboarded: true for user:', user.id);
        
        const { error } = await supabase.rpc('update_profile', {
          p_user_id: user.id,
          p_onboarded: true,
        });
        
        if (error) {
          console.error('Failed to set onboarded: true:', error);
        } else {
          console.log('Successfully set onboarded: true');
          // Refresh the profile in AuthProvider
          await refreshProfile(user.id);
        }
      } catch (error) {
        console.error('Error setting onboarded status:', error);
      }
    }
    
    console.log('Proceeding to app (MainTabs) by resetting navigation stack.');
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
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

      {/* Confetti Animation - Enhanced with full-width coverage */}
      <Animated.View 
        style={[
          styles.confettiContainer,
          {
            opacity: confettiAnim,
            transform: [
              {
                translateY: confettiAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-50, height + 100],
                }),
              },
            ],
          },
        ]}
        pointerEvents="none"
      >
        {/* Row 1 - Top confetti - Distributed across screen width */}
        <Text style={[styles.confetti, { left: width * 0.05, top: 0 }]}>🎉</Text>
        <Text style={[styles.confetti, { left: width * 0.2, top: -20 }]}>✨</Text>
        <Text style={[styles.confetti, { left: width * 0.35, top: -10 }]}>🍳</Text>
        <Text style={[styles.confetti, { left: width * 0.5, top: -30 }]}>🎊</Text>
        <Text style={[styles.confetti, { left: width * 0.65, top: -5 }]}>⭐</Text>
        <Text style={[styles.confetti, { left: width * 0.8, top: -25 }]}>🌟</Text>
        <Text style={[styles.confetti, { left: width * 0.95, top: -15 }]}>🎉</Text>
        
        {/* Row 2 - Middle confetti */}
        <Text style={[styles.confetti, { left: width * 0.1, top: 100 }]}>🥘</Text>
        <Text style={[styles.confetti, { left: width * 0.25, top: 80 }]}>🎈</Text>
        <Text style={[styles.confetti, { left: width * 0.4, top: 90 }]}>🍽️</Text>
        <Text style={[styles.confetti, { left: width * 0.55, top: 70 }]}>💫</Text>
        <Text style={[styles.confetti, { left: width * 0.7, top: 95 }]}>🥄</Text>
        <Text style={[styles.confetti, { left: width * 0.85, top: 75 }]}>🎊</Text>
        
        {/* Row 3 - Bottom confetti */}
        <Text style={[styles.confetti, { left: width * 0.02, top: 200 }]}>🌟</Text>
        <Text style={[styles.confetti, { left: width * 0.18, top: 180 }]}>🎉</Text>
        <Text style={[styles.confetti, { left: width * 0.33, top: 190 }]}>✨</Text>
        <Text style={[styles.confetti, { left: width * 0.48, top: 170 }]}>🍴</Text>
        <Text style={[styles.confetti, { left: width * 0.63, top: 195 }]}>⭐</Text>
        <Text style={[styles.confetti, { left: width * 0.78, top: 175 }]}>🎈</Text>
        <Text style={[styles.confetti, { left: width * 0.93, top: 185 }]}>🎊</Text>
        
        {/* Row 4 - Extra sparkles with smaller size */}
        <Text style={[styles.confetti, { left: width * 0.15, top: 300, fontSize: 20 }]}>✨</Text>
        <Text style={[styles.confetti, { left: width * 0.3, top: 280, fontSize: 20 }]}>💫</Text>
        <Text style={[styles.confetti, { left: width * 0.45, top: 290, fontSize: 20 }]}>⭐</Text>
        <Text style={[styles.confetti, { left: width * 0.6, top: 270, fontSize: 20 }]}>🌟</Text>
        <Text style={[styles.confetti, { left: width * 0.75, top: 295, fontSize: 20 }]}>✨</Text>
        <Text style={[styles.confetti, { left: width * 0.9, top: 275, fontSize: 20 }]}>💫</Text>
        
        {/* Row 5 - Additional cooking-themed confetti */}
        <Text style={[styles.confetti, { left: width * 0.08, top: 400, fontSize: 25 }]}>👨‍🍳</Text>
        <Text style={[styles.confetti, { left: width * 0.22, top: 380, fontSize: 25 }]}>🧑‍🍳</Text>
        <Text style={[styles.confetti, { left: width * 0.38, top: 390, fontSize: 25 }]}>🍳</Text>
        <Text style={[styles.confetti, { left: width * 0.52, top: 370, fontSize: 25 }]}>🥘</Text>
        <Text style={[styles.confetti, { left: width * 0.68, top: 395, fontSize: 25 }]}>🍽️</Text>
        <Text style={[styles.confetti, { left: width * 0.82, top: 375, fontSize: 25 }]}>🥄</Text>
        <Text style={[styles.confetti, { left: width * 0.97, top: 385, fontSize: 25 }]}>🍴</Text>
      </Animated.View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <OnboardingProgress currentStep={3} totalSteps={3} />
      </View>

      {/* Main Content - Enhanced ScrollView for Smoothest Experience */}
      <SafeAreaView style={styles.safeArea}>
        <ScrollView 
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          bounces={true}
          alwaysBounceVertical={false}
          decelerationRate="normal"
          scrollEventThrottle={16}
          removeClippedSubviews={false}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          overScrollMode="auto"
          nestedScrollEnabled={true}
          directionalLockEnabled={true}
          canCancelContentTouches={true}
          maximumZoomScale={1}
          minimumZoomScale={1}
          centerContent={false}
          indicatorStyle="white"
          snapToAlignment="start"
          snapToInterval={0}
          // Enhanced momentum and smoothness
          scrollEnabled={true}
          pagingEnabled={false}
          automaticallyAdjustContentInsets={false}
          maintainVisibleContentPosition={null}
          // Performance optimizations
          disableIntervalMomentum={false}
          disableScrollViewPanResponder={false}
          // Smooth deceleration
          scrollsToTop={true}
        >
          <Animated.View 
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Success Icon */}
            <Animated.View 
              style={[
                styles.successSection,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <View style={styles.successIconContainer}>
                <LinearGradient
                  colors={['#FFFFFF', '#F8F9FA']}
                  style={styles.successIconGradient}
                >
                  <Ionicons name="checkmark-circle" size={60} color={COLORS.primary} />
                </LinearGradient>
              </View>
              <Text style={styles.successTitle}>You're All Set!</Text>
              <Text style={styles.successSubtitle}>Welcome to your culinary adventure</Text>
            </Animated.View>

            {/* Features Summary */}
            <View style={styles.featuresSection}>
              <Text style={styles.featuresTitle}>Your Starter Pack Includes:</Text>
              
              <View style={styles.featuresList}>
                <View style={styles.featureItem}>
                  <View style={styles.featureIcon}>
                    <Ionicons name="camera" size={20} color={COLORS.primary} />
                  </View>
                  <Text style={styles.featureText}>
                    <Text style={styles.featureBold}>3 AI Pantry Scans</Text> to get you started
                  </Text>
                </View>
                
                <View style={styles.featureItem}>
                  <View style={styles.featureIcon}>
                    <Ionicons name="bulb" size={20} color={COLORS.primary} />
                  </View>
                  <Text style={styles.featureText}>
                    <Text style={styles.featureBold}>10 AI Meal Plans</Text> personalized for you
                  </Text>
                </View>
                
                <View style={styles.featureItem}>
                  <View style={styles.featureIcon}>
                    <Ionicons name="infinite" size={20} color={COLORS.primary} />
                  </View>
                  <Text style={styles.featureText}>
                    <Text style={styles.featureBold}>Unlimited</Text> recipe discovery & social features
                  </Text>
                </View>
              </View>

              <View style={styles.encouragementContainer}>
                <Text style={styles.encouragementText}>
                  These free features help you explore KitchAI and discover amazing recipes! 
                  As you cook and create, you'll unlock even more possibilities.
                </Text>
              </View>
            </View>

            {/* Call to Action */}
            <Animated.View 
              style={[
                styles.ctaSection,
                { transform: [{ scale: buttonScale }] },
              ]}
            >
              <TouchableOpacity style={styles.startButton} onPress={handleProceedToApp}>
                <LinearGradient
                  colors={['#FFFFFF', '#F8F9FA']}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.startButtonText}>Start Cooking!</Text>
                  <Ionicons name="rocket" size={24} color={COLORS.primary} />
                </LinearGradient>
              </TouchableOpacity>
              
              <Text style={styles.finalEncouragement}>
                Your kitchen adventure begins now! ✨
              </Text>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
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
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height,
    zIndex: 0,
  },
  confetti: {
    position: 'absolute',
    fontSize: 30,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  progressContainer: {
    marginTop: 60,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  safeArea: {
    flex: 1,
    zIndex: 5,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40, // Ensure bottom spacing
  },
  content: {
    minHeight: height - 140, // Account for progress indicator and padding
    justifyContent: 'space-around', // Changed from space-between to space-around
    zIndex: 2,
  },
  successSection: {
    alignItems: 'center',
    marginTop: 20, // Reduced from 40
  },
  successIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  successIconGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 18,
    color: COLORS.white,
    opacity: 0.9,
    textAlign: 'center',
  },
  featuresSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 24,
    marginVertical: 16, // Reduced from 20
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 20,
    textAlign: 'center',
  },
  featuresList: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureText: {
    flex: 1,
    fontSize: 16,
    color: COLORS.white,
    lineHeight: 22,
  },
  featureBold: {
    fontWeight: 'bold',
  },
  encouragementContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
  },
  encouragementText: {
    fontSize: 15,
    color: COLORS.white,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.9,
  },
  ctaSection: {
    alignItems: 'center',
    marginTop: 20, // Reduced from marginBottom: 40
    paddingBottom: 20, // Added padding bottom instead
  },
  startButton: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    marginBottom: 16,
  },
  buttonGradient: {
    paddingVertical: 20,
    paddingHorizontal: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButtonText: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 12,
  },
  finalEncouragement: {
    fontSize: 18,
    color: COLORS.white,
    textAlign: 'center',
    fontStyle: 'italic',
    opacity: 0.9,
  },
});

export default OnboardingFinalScreen;
