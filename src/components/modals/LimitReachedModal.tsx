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

import { useAuth } from '../../providers/AuthProvider';
import { useAccessControl } from '../../hooks/useAccessControl';
import { supabase } from '../../services/supabase';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface LimitReachedModalProps {
  visible: boolean;
  onClose: () => void;
  limitType: 'scan' | 'ai_recipe';
  onUpgradeSuccess?: () => void;
  username?: string;
  usageData?: {
    current: number;
    limit: number;
    remaining: number;
  };
}

const PREMIUM_PRICE = '$9.99';

export const LimitReachedModal: React.FC<LimitReachedModalProps> = ({
  visible,
  onClose,
  limitType,
  onUpgradeSuccess,
  username = 'Chef',
  usageData: passedUsageData,
}) => {
  console.log('[LimitReachedModal] Rendered with visible:', visible, 'limitType:', limitType);
  console.log('[LimitReachedModal] Usage data passed:', passedUsageData);
  
  const { user, refreshProfile } = useAuth();
  const { getUsageDisplay, FREEMIUM_SCAN_LIMIT, FREEMIUM_AI_RECIPE_LIMIT } = useAccessControl();
  const [isUpgrading, setIsUpgrading] = React.useState(false);
  
  const fallbackUsageData = getUsageDisplay();

  // Get limit-specific content
  const getLimitContent = () => {
    // Use passed usage data if available, otherwise fall back to getUsageDisplay
    const currentUsageDisplay = passedUsageData 
      ? `${passedUsageData.current}/${passedUsageData.limit}` 
      : (limitType === 'scan' ? fallbackUsageData.scanUsage : fallbackUsageData.aiRecipeUsage);

    if (limitType === 'scan') {
      return {
        icon: 'camera-alt',
        iconColor: '#3b82f6',
        iconBg: '#dbeafe',
        title: 'Pantry Scan Limit Reached',
        subtitle: `You've used all ${FREEMIUM_SCAN_LIMIT} monthly pantry scans`,
        currentUsage: currentUsageDisplay,
        limitLabel: 'Pantry Scans',
        contextMessage: 'You need to scan more pantry items to generate AI recipes, but you\'ve reached your monthly scan limit.',
        primaryBenefit: 'Unlimited Pantry Scans',
        primaryBenefitDesc: 'Scan your pantry as many times as you want',
      };
    } else {
      return {
        icon: 'auto-awesome',
        iconColor: '#10b981',
        iconBg: '#dcfce7',
        title: 'AI Recipe Limit Reached',
        subtitle: `You've used all ${FREEMIUM_AI_RECIPE_LIMIT} monthly AI recipe generations`,
        currentUsage: currentUsageDisplay,
        limitLabel: 'AI Recipes',
        contextMessage: 'You\'ve reached your monthly limit for AI-generated recipes. Upgrade to Premium for unlimited recipe generation.',
        primaryBenefit: 'Unlimited AI Recipes',
        primaryBenefitDesc: 'Generate personalized recipes with AI endlessly',
      };
    }
  };

  const limitContent = getLimitContent();

  // Payment processing (same as PremiumUpgradeModal)
  const processPayment = async (): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return true; // Demo purposes
  };

  const handleUpgrade = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setIsUpgrading(true);
    
    try {
      console.log('[LimitReachedModal] Processing upgrade for', limitType, 'limit');
      
      const paymentSuccessful = await processPayment();

      if (paymentSuccessful) {
        console.log('[LimitReachedModal] 💳 Payment successful - triggering upgrade success');
        
        setIsUpgrading(false);
        onClose();
        onUpgradeSuccess?.();
        
        // Background database operations
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ tier: 'PREMIUM' })
            .eq('user_id', user.id);

          if (error) {
            console.error('[LimitReachedModal] ❌ Database update failed:', error);
            return;
          }

          console.log('[LimitReachedModal] ✅ Database updated successfully');
          await refreshProfile(user.id);
          
        } catch (backgroundError) {
          console.error('[LimitReachedModal] ❌ Background operations failed:', backgroundError);
        }
        
      } else {
        Alert.alert('Payment Failed', 'Please try again.');
        setIsUpgrading(false);
      }
      
    } catch (error: any) {
      console.error('[LimitReachedModal] ❌ Upgrade failed:', error);
      Alert.alert('Error', error.message || 'An unexpected error occurred.');
      setIsUpgrading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent>
      
      {/* Backdrop */}
      <Animated.View 
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(200)}
        style={styles.backdrop}>
        
        <TouchableOpacity 
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
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

          {/* Header with Limit Icon */}
          <View style={styles.header}>
            <Animated.View 
              entering={BounceIn.delay(200).duration(600)}
              style={[styles.limitIcon, { backgroundColor: limitContent.iconBg }]}>
              <Icon name={limitContent.icon} size={32} color={limitContent.iconColor} />
            </Animated.View>
            
            <Text style={styles.title}>{limitContent.title}</Text>
            <Text style={styles.subtitle}>{limitContent.subtitle}</Text>
          </View>

          {/* Current Usage Status */}
          <Animated.View 
            entering={SlideInDown.delay(300).duration(500)}
            style={styles.usageContainer}>
            <Text style={styles.usageTitle}>Current Usage</Text>
            <View style={styles.usageRow}>
              <Text style={styles.usageLabel}>{limitContent.limitLabel}</Text>
              <Text style={styles.usageValue}>{limitContent.currentUsage}</Text>
            </View>
            <View style={styles.usageBar}>
              <View style={[styles.usageBarFill, { backgroundColor: limitContent.iconColor }]} />
            </View>
          </Animated.View>

          {/* Context Message */}
          <Animated.View 
            entering={SlideInDown.delay(400).duration(500)}
            style={styles.contextContainer}>
            <Text style={styles.contextMessage}>{limitContent.contextMessage}</Text>
          </Animated.View>

          {/* Premium Benefits */}
          <Animated.View 
            entering={SlideInDown.delay(500).duration(500)}
            style={styles.benefitsContainer}>
            <Text style={styles.benefitsTitle}>Upgrade to Premium</Text>
            
            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Icon name={limitContent.icon} size={20} color="#10b981" />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>{limitContent.primaryBenefit}</Text>
                <Text style={styles.benefitDescription}>{limitContent.primaryBenefitDesc}</Text>
              </View>
            </View>

            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Icon name="diamond" size={20} color="#10b981" />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>All Premium Features</Text>
                <Text style={styles.benefitDescription}>Unlimited scans, AI recipes, and Creator tools</Text>
              </View>
            </View>
          </Animated.View>

          {/* Upgrade Button */}
          <Animated.View 
            entering={SlideInDown.delay(600).duration(500)}
            style={styles.ctaContainer}>
            <TouchableOpacity 
              style={styles.upgradeButton}
              onPress={handleUpgrade}
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

            <TouchableOpacity 
              style={styles.laterButton}
              onPress={onClose}
              activeOpacity={0.7}>
              <Text style={styles.laterButtonText}>Maybe Later</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 25,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 12,
  },
  limitIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  usageContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  usageTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    textAlign: 'center',
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  usageLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  usageValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ef4444',
  },
  usageBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  usageBarFill: {
    height: '100%',
    width: '100%',
    borderRadius: 4,
  },
  contextContainer: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  contextMessage: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
    textAlign: 'center',
  },
  benefitsContainer: {
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center',
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  benefitContent: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  benefitDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 18,
  },
  ctaContainer: {
    alignItems: 'center',
  },
  upgradeButton: {
    backgroundColor: '#10b981',
    borderRadius: 16,
    width: '100%',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  upgradeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  priceText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.9,
  },
  laterButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  laterButtonText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
}); 