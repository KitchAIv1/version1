import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
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

import { useAuth } from '../providers/AuthProvider';
import { supabase } from '../services/supabase';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PremiumUpgradeModalProps {
  visible: boolean;
  onClose: () => void;
  onBecomeCreator?: () => void;
  onUpgradeSuccess?: () => void; // Callback to trigger global confetti
  username?: string;
}

const PREMIUM_PRICE = '$9.99';

export const PremiumUpgradeModal: React.FC<PremiumUpgradeModalProps> = ({
  visible,
  onClose,
  onBecomeCreator,
  onUpgradeSuccess,
  username = 'Chef',
}) => {
  console.log('[PremiumUpgradeModal] Rendered with visible:', visible);
  
  const { user, refreshProfile } = useAuth();
  const [isUpgrading, setIsUpgrading] = React.useState(false);

  // Copy exact payment processing from UpgradeScreen
  const processPayment = async (): Promise<boolean> => {
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    // For demo purposes, always return true
    // In production, integrate with actual payment provider
    return true;
  };

  const handleDirectUpgrade = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setIsUpgrading(true);
    
    try {
      // Process payment
      const paymentSuccessful = await processPayment();

      if (paymentSuccessful) {
        console.log('[PremiumUpgradeModal] 💳 Payment successful - IMMEDIATE CONFETTI EXPLOSION!');
        
        // 🎉 IMMEDIATE CONFETTI EXPLOSION - No delay!
        setIsUpgrading(false);
        onClose();
        onUpgradeSuccess?.();
        
        console.log('[PremiumUpgradeModal] 🎊 Confetti triggered immediately!');
        
        // Database operations happen in background while confetti plays
        try {
          console.log('[PremiumUpgradeModal] 🔄 Background: Updating tier for user:', user.id);
          
          // Update user tier in database
          const { error, data } = await supabase
            .from('profiles')
            .update({ tier: 'PREMIUM' })
            .eq('user_id', user.id)
            .select();

          if (error) {
            console.error('[PremiumUpgradeModal] ❌ Background database update failed:', error);
            // Don't show error to user since confetti already started
            // Could add a subtle notification later if needed
            return;
          }

          console.log('[PremiumUpgradeModal] ✅ Background: Database updated successfully:', data);

          // Background refresh sequence while confetti plays
          console.log('[PremiumUpgradeModal] 🔄 Background: Refreshing profile data...');
          
          // First refresh
          await refreshProfile(user.id);
          console.log('[PremiumUpgradeModal] Background: First refresh completed');
          
          // Wait longer for React state to settle
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Second refresh with verification
          console.log('[PremiumUpgradeModal] 🔄 Background: Second refresh...');
          await refreshProfile(user.id);
          
          // Wait again and log current state
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log('[PremiumUpgradeModal] ✅ Background: Profile refresh sequence completed');
          
        } catch (backgroundError: any) {
          console.error('[PremiumUpgradeModal] ❌ Background operations failed:', backgroundError);
          // Silent failure - user already sees confetti celebration
        }
        
      } else {
        Alert.alert(
          'Payment Failed',
          'Your payment could not be processed. Please try again.',
        );
        setIsUpgrading(false);
      }
      
    } catch (error: any) {
      console.error('[PremiumUpgradeModal] ❌ Upgrade failed:', error);
      Alert.alert(
        'Error',
        error.message || 'An unexpected error occurred during upgrade.',
      );
      setIsUpgrading(false);
    }
  };

  const handleBecomeCreator = () => {
    onClose();
    onBecomeCreator?.();
  };

  const handleBackdropPress = () => {
    onClose();
  };

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
            
            <Text style={styles.title}>Unlock Premium, {username}!</Text>
            <Text style={styles.subtitle}>
              Get unlimited access to all KitchAI features and become a Creator
            </Text>
          </View>

          {/* Features Grid */}
          <View style={styles.featuresContainer}>
            <View style={styles.featureRow}>
              <FeatureCard 
                icon="camera-alt" 
                title="Unlimited Scans" 
                description="Scan your pantry endlessly"
                delay={300}
              />
              <FeatureCard 
                icon="auto-awesome" 
                title="Unlimited AI Recipes" 
                description="Generate endless recipes"
                delay={400}
              />
            </View>
            
            <View style={styles.featureRow}>
              <FeatureCard 
                icon="videocam" 
                title="Recipe Videos" 
                description="Create & share videos"
                delay={500}
              />
              <FeatureCard 
                icon="star" 
                title="Creator Status" 
                description="Become a food creator"
                delay={600}
              />
            </View>
          </View>

          {/* Call to Action */}
          <Animated.View 
            entering={SlideInDown.delay(700).duration(500)}
            style={styles.ctaContainer}>
            <Text style={styles.ctaTitle}>Ready to Become a Food Creator?</Text>
            <Text style={styles.ctaSubtitle}>
              Upgrade to Premium and share your culinary creativity with the world
            </Text>
            
            {/* Primary CTA - Upgrade to Premium */}
            <TouchableOpacity 
              style={styles.upgradeButton}
              onPress={handleDirectUpgrade}
              activeOpacity={0.8}
              disabled={isUpgrading}>
              <View style={styles.upgradeButtonContent}>
                {isUpgrading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Icon name="diamond" size={20} color="#fff" />
                    <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
                    <Text style={styles.priceText}>{PREMIUM_PRICE}/mo</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>

            {/* Secondary CTA - Learn about Creator */}
            <TouchableOpacity 
              style={styles.creatorButton}
              onPress={handleBecomeCreator}
              activeOpacity={0.7}>
              <View style={styles.creatorButtonContent}>
                <Feather name="star" size={18} color="#10b981" />
                <Text style={styles.creatorButtonText}>Learn About Creator Benefits</Text>
              </View>
            </TouchableOpacity>

            {/* Tertiary Action */}
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

// Feature Card Component
const FeatureCard: React.FC<{
  icon: string;
  title: string;
  description: string;
  delay: number;
}> = ({ icon, title, description, delay }) => (
  <Animated.View 
    entering={FadeIn.delay(delay).duration(400)}
    style={styles.featureCard}>
    <View style={styles.featureIconContainer}>
      <Icon name={icon} size={24} color="#10b981" />
    </View>
    <Text style={styles.featureTitle}>{title}</Text>
    <Text style={styles.featureDescription}>{description}</Text>
  </Animated.View>
);

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
    paddingBottom: 80, // Prevent button cutoff
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
    paddingBottom: 32,
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
    fontSize: 28,
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
    marginBottom: 40,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  featureCard: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 6,
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
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 16,
  },
  ctaContainer: {
    alignItems: 'center',
    paddingBottom: 30,
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
  upgradeButton: {
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
  upgradeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 12,
  },
  priceText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.9,
  },
  creatorButton: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10b981',
    marginBottom: 16,
    width: '100%',
  },
  creatorButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorButtonText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
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

export default PremiumUpgradeModal; 