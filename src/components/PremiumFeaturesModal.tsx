import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Feather } from '@expo/vector-icons';
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInDown, 
  SlideOutDown,
  BounceIn,
} from 'react-native-reanimated';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PremiumFeaturesModalProps {
  visible: boolean;
  onClose: () => void;
  onBecomeCreator?: () => void;
  username?: string;
}

const FeatureCard: React.FC<{
  icon: string;
  title: string;
  description: string;
  status: string;
  delay: number;
}> = ({ icon, title, description, status, delay }) => (
  <Animated.View 
    entering={SlideInDown.delay(delay).duration(500)}
    style={styles.featureCard}>
    <View style={styles.featureIconContainer}>
      <Icon name={icon} size={24} color="#10b981" />
    </View>
    <View style={styles.featureContent}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
      <Text style={styles.featureStatus}>✅ {status}</Text>
    </View>
  </Animated.View>
);

export const PremiumFeaturesModal: React.FC<PremiumFeaturesModalProps> = ({
  visible,
  onClose,
  onBecomeCreator,
  username = 'Chef',
}) => {
  console.log('[PremiumFeaturesModal] Rendered with visible:', visible);

  const handleBecomeCreator = () => {
    onClose();
    onBecomeCreator?.();
  };

  const handleBackdropPress = () => {
    onClose();
  };

  const features = [
    {
      icon: 'camera-alt',
      title: 'Unlimited Pantry Scans',
      description: 'Scan your pantry as many times as you want',
      status: 'Active',
    },
    {
      icon: 'auto-awesome',
      title: 'Unlimited AI Recipes',
      description: 'Generate endless personalized recipes with AI',
      status: 'Active',
    },
    {
      icon: 'videocam',
      title: 'Recipe Video Creation',
      description: 'Create and share recipe videos with the community',
      status: 'Active',
    },
    {
      icon: 'headset',
      title: 'Priority Support',
      description: 'Get faster help when you need it',
      status: 'Active',
    },
    {
      icon: 'star',
      title: 'Early Access Features',
      description: 'Be first to try new features and updates',
      status: 'Active',
    },
    {
      icon: 'analytics',
      title: 'Recipe Analytics',
      description: 'Track your recipe performance and engagement',
      status: 'Coming Soon',
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent>
      
      {/* Backdrop with Semi-Transparent Effect */}
      <Animated.View 
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={styles.backdrop}>
        
        {/* Backdrop Touchable */}
        <TouchableOpacity 
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={handleBackdropPress}
        />
        
        {/* Modal Content */}
        <Animated.View
          entering={SlideInDown.duration(400).springify()}
          exiting={SlideOutDown.duration(300)}
          style={styles.modalContainer}>
          
          {/* Close Button */}
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="close" size={24} color="#666" />
          </TouchableOpacity>

          {/* Header with Premium Badge */}
          <View style={styles.header}>
            <Animated.View 
              entering={BounceIn.delay(200).duration(600)}
              style={styles.premiumBadge}>
              <Icon name="diamond" size={32} color="#10b981" />
              <Text style={styles.premiumText}>PREMIUM</Text>
            </Animated.View>
            
            <Text style={styles.title}>Welcome to Premium, {username}!</Text>
            <Text style={styles.subtitle}>
              You have unlimited access to all KitchAI features. Ready to become a Creator?
            </Text>
          </View>

          {/* Features List */}
          <ScrollView 
            style={styles.featuresContainer}
            showsVerticalScrollIndicator={false}>
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                status={feature.status}
                delay={300 + index * 100}
              />
            ))}
          </ScrollView>

          {/* Call to Action */}
          <Animated.View 
            entering={SlideInDown.delay(900).duration(500)}
            style={styles.ctaContainer}>
            <View style={styles.creatorPrompt}>
              <Icon name="star" size={24} color="#f59e0b" />
              <Text style={styles.creatorPromptText}>
                Take your culinary journey to the next level
              </Text>
            </View>
            
            <Text style={styles.ctaTitle}>Become a Food Creator</Text>
            <Text style={styles.ctaSubtitle}>
              Share your recipes, build a following, and inspire others with your culinary creativity
            </Text>
            
            {/* Primary CTA - Become Creator */}
            <TouchableOpacity 
              style={styles.creatorButton}
              onPress={handleBecomeCreator}
              activeOpacity={0.8}>
              <View style={styles.creatorButtonContent}>
                <Icon name="videocam" size={20} color="#fff" />
                <Text style={styles.creatorButtonText}>Start Creating Content</Text>
                <Feather name="arrow-right" size={16} color="#fff" />
              </View>
            </TouchableOpacity>

            {/* Secondary Action */}
            <TouchableOpacity 
              style={styles.learnMoreButton}
              onPress={() => {
                onClose();
              }}
              activeOpacity={0.7}>
              <Text style={styles.learnMoreText}>Maybe Later</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 40,
    paddingHorizontal: 24,
    maxHeight: screenHeight * 0.90,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 24,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#10b981',
    marginBottom: 16,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  premiumText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#047857',
    marginLeft: 8,
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  featuresContainer: {
    maxHeight: screenHeight * 0.35,
    marginBottom: 24,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
    lineHeight: 18,
  },
  featureStatus: {
    fontSize: 12,
    fontWeight: '500',
    color: '#10b981',
  },
  ctaContainer: {
    alignItems: 'center',
  },
  creatorPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 16,
  },
  creatorPromptText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#92400e',
    marginLeft: 8,
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  ctaSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  creatorButton: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 16,
    width: '100%',
  },
  creatorButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 12,
  },
  learnMoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  learnMoreText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default PremiumFeaturesModal; 