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

const tools = [
  {
    title: '🎥 Video Recipe Studio',
    description: 'Upload and share stunning recipe videos with our Instagram-style player',
    icon: 'videocam',
    color: '#E74C3C',
    benefit: 'Professional video tools included!',
  },
  {
    title: '🏷️ Smart Tagging System',
    description: 'Tag ingredients, diets, and cuisines to help users discover your recipes',
    icon: 'pricetag',
    color: '#9B59B6',
    benefit: 'Boost your recipe visibility!',
  },
  {
    title: '👥 Build Your Following',
    description: 'Connect with food lovers and grow your culinary community',
    icon: 'people',
    color: '#3498DB',
    benefit: 'Unlimited follower potential!',
  },
  {
    title: '📊 Creator Analytics',
    description: 'Track views, engagement, and follower growth with detailed insights',
    icon: 'bar-chart',
    color: '#27AE60',
    benefit: 'Coming soon - Advanced metrics!',
  },
];

function OnboardingStep2CreatorScreen() {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<MainStackParamList, 'OnboardingStep2Creator'>
    >();

  // Animation values
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(30);
  const toolAnims = tools.map(() => new Animated.Value(0));
  const buttonScale = new Animated.Value(0.95);
  const sparkleAnim = new Animated.Value(0);

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

    // Staggered tool animations
    const toolAnimations = toolAnims.map((anim, index) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 400,
        delay: 200 + index * 150,
        useNativeDriver: true,
      })
    );

    Animated.stagger(100, toolAnimations).start();

    // Sparkle animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(sparkleAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
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
    console.log('Proceeding to OnboardingFinalScreen from Creator flow');
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
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryDark]}
              style={styles.iconGradient}
            >
              <Ionicons name="videocam" size={40} color={COLORS.white} />
              <Animated.View 
                style={[
                  styles.sparkle,
                  {
                    opacity: sparkleAnim,
                    transform: [
                      {
                        scale: sparkleAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 1.2],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Text style={styles.sparkleText}>✨</Text>
              </Animated.View>
            </LinearGradient>
          </View>
          <Text style={styles.header}>Unleash Your Creativity!</Text>
          <Text style={styles.subHeader}>
            Professional tools to share your culinary passion with the world
          </Text>
        </Animated.View>

        {/* Tools Grid */}
        <View style={styles.toolsContainer}>
          {tools.map((tool, index) => (
            <Animated.View
              key={index}
              style={[
                styles.toolCardWrapper,
                {
                  opacity: toolAnims[index],
                  transform: [
                    {
                      translateY: toolAnims[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.toolCard}>
                <LinearGradient
                  colors={[tool.color + '15', tool.color + '05']}
                  style={styles.cardGradient}
                >
                  <View style={[styles.toolIconContainer, { backgroundColor: tool.color + '20' }]}>
                    <Ionicons name={tool.icon as any} size={28} color={tool.color} />
                  </View>
                  
                  <View style={styles.toolContent}>
                    <Text style={styles.toolTitle}>{tool.title}</Text>
                    <Text style={styles.toolDescription}>{tool.description}</Text>
                    
                    <View style={styles.benefitContainer}>
                      <Ionicons 
                        name={tool.benefit.includes('Coming soon') ? 'time' : 'rocket'} 
                        size={16} 
                        color={tool.benefit.includes('Coming soon') ? COLORS.gray : COLORS.primary} 
                      />
                      <Text style={[
                        styles.benefitText,
                        { color: tool.benefit.includes('Coming soon') ? COLORS.gray : COLORS.primary }
                      ]}>
                        {tool.benefit}
                      </Text>
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
              colors={['#E74C3C', '#C0392B']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.nextButtonText}>Start Creating!</Text>
              <Ionicons name="create" size={20} color={COLORS.white} />
            </LinearGradient>
          </TouchableOpacity>
          
          <Text style={styles.encouragementText}>
            Your culinary stories are waiting to inspire others! 🎬
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
    marginBottom: 20,
    position: 'relative',
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sparkle: {
    position: 'absolute',
    top: -5,
    right: -5,
  },
  sparkleText: {
    fontSize: 20,
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
  toolsContainer: {
    marginBottom: 40,
  },
  toolCardWrapper: {
    marginBottom: 16,
  },
  toolCard: {
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
  toolIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  toolContent: {
    flex: 1,
  },
  toolTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  toolDescription: {
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

export default OnboardingStep2CreatorScreen;
