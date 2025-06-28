import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MainStackParamList } from '../../navigation/types';
import { COLORS, SIZES } from '../../constants/theme';
import OnboardingProgress from '../../components/onboarding/OnboardingProgress';

const { width, height } = Dimensions.get('window');

const features = [
  {
    title: '📸 Smart Pantry Scan',
    description: 'Instantly recognize ingredients with AI-powered camera scanning',
    icon: 'camera',
    color: '#FF6B35',
    benefit: '3 free scans to get started!',
  },
  {
    title: '🧠 AI Meal Planner',
    description: 'Get personalized meal plans tailored to your taste and ingredients',
    icon: 'bulb',
    color: '#4ECDC4',
    benefit: '10 free AI generations included!',
  },
  {
    title: '🛒 Smart Grocery Lists',
    description: 'Automatically convert missing ingredients into organized shopping lists',
    icon: 'basket',
    color: '#45B7D1',
    benefit: 'Never forget an ingredient again!',
  },
  {
    title: '🍽️ Recipe Discovery',
    description: 'Explore thousands of recipes from talented creators worldwide',
    icon: 'search',
    color: '#96CEB4',
    benefit: 'Unlimited recipe browsing!',
  },
];

function OnboardingStep2UserScreen() {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<MainStackParamList, 'OnboardingStep2User'>
    >();

  // Animation values
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(30);
  const featureAnims = features.map(() => new Animated.Value(0));
  const buttonScale = new Animated.Value(0.95);

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Staggered feature animations
    const featureAnimations = featureAnims.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        delay: 200 + index * 150,
        useNativeDriver: true,
      })
    );

    Animated.stagger(100, featureAnimations).start();
  }, []);

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.98,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleNext = () => {
    animateButton();
    console.log('Proceeding to OnboardingFinalScreen from User flow');
    navigation.navigate('OnboardingFinal');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
      
      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <OnboardingProgress currentStep={2} totalSteps={3} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <Animated.View 
          style={[
            styles.headerSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.headerIconContainer}>
            <Ionicons name="restaurant" size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.header}>Your Culinary Journey Begins!</Text>
          <Text style={styles.subHeader}>
            Discover amazing features designed just for food lovers like you
          </Text>
        </Animated.View>

        {/* Features Grid */}
        <View style={styles.featuresContainer}>
          {features.map((feature, index) => (
            <Animated.View
              key={index}
              style={[
                styles.featureCardWrapper,
                {
                  opacity: featureAnims[index],
                  transform: [
                    {
                      translateY: featureAnims[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.featureCard}>
                <LinearGradient
                  colors={[feature.color + '15', feature.color + '05']}
                  style={styles.cardGradient}
                >
                  <View style={[styles.featureIconContainer, { backgroundColor: feature.color + '20' }]}>
                    <Ionicons name={feature.icon as any} size={28} color={feature.color} />
                  </View>
                  
                  <View style={styles.featureContent}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureDescription}>{feature.description}</Text>
                    
                    <View style={styles.benefitContainer}>
                      <Ionicons name="star" size={16} color={COLORS.primary} />
                      <Text style={styles.benefitText}>{feature.benefit}</Text>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* Call to Action */}
        <Animated.View 
          style={[
            styles.ctaSection,
            { transform: [{ scale: buttonScale }] },
          ]}
        >
          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryDark]}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.nextButtonText}>Let's Start Cooking!</Text>
              <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
            </LinearGradient>
          </TouchableOpacity>
          
          <Text style={styles.encouragementText}>
            Your kitchen adventure is just getting started! ✨
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  progressContainer: {
    marginTop: 60,
    paddingHorizontal: 20,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 40,
  },
  headerIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${COLORS.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  subHeader: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  featuresContainer: {
    marginBottom: 40,
  },
  featureCardWrapper: {
    marginBottom: 16,
  },
  featureCard: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardGradient: {
    padding: 20,
    backgroundColor: COLORS.white,
  },
  featureIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: 12,
  },
  benefitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}10`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  benefitText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 6,
  },
  ctaSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  nextButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    marginBottom: 16,
  },
  buttonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  encouragementText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default OnboardingStep2UserScreen;
