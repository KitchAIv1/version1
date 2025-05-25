import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../providers/AuthProvider';
import { useAccessControl } from '../hooks/useAccessControl';
import { TierDisplay } from '../components/TierDisplay';
import { supabase } from '../services/supabase';

const PREMIUM_PRICE = '$9.99';

export default function UpgradeScreen() {
  const navigation = useNavigation();
  const { user, refreshProfile } = useAuth();
  const { getUsageDisplay } = useAccessControl();
  const [isUpgrading, setIsUpgrading] = useState(false);

  const usageData = getUsageDisplay();

  // Mock payment processing - replace with actual payment provider (Stripe, etc.)
  const processPayment = async (): Promise<boolean> => {
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // For demo purposes, always return true
    // In production, integrate with actual payment provider
    return true;
  };

  const handleUpgrade = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    Alert.alert(
      'Confirm Upgrade',
      `Upgrade to PREMIUM for ${PREMIUM_PRICE}/month?\n\nYou'll get:\n• Unlimited pantry scans\n• Unlimited AI recipe generation\n• Priority support`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upgrade Now',
          onPress: async () => {
            setIsUpgrading(true);
            try {
              // Process payment
              const paymentSuccessful = await processPayment();

              if (paymentSuccessful) {
                // Update user tier in database
                const { error } = await supabase
                  .from('profiles')
                  .update({ tier: 'PREMIUM' })
                  .eq('id', user.id);

                if (error) {
                  Alert.alert('Error', 'Payment processed but failed to update account. Please contact support.');
                  return;
                }

                // Refresh profile to get updated tier
                await refreshProfile(user.id);

                Alert.alert(
                  'Upgrade Successful! 🎉',
                  'Welcome to PREMIUM! You now have unlimited access to all features.',
                  [
                    {
                      text: 'Continue',
                      onPress: () => navigation.goBack(),
                    },
                  ]
                );
              } else {
                Alert.alert('Payment Failed', 'Your payment could not be processed. Please try again.');
              }
            } catch (error: any) {
              Alert.alert('Error', error.message || 'An unexpected error occurred during upgrade.');
            } finally {
              setIsUpgrading(false);
            }
          },
        },
      ]
    );
  };

  const features = [
    {
      icon: 'camera-outline',
      title: 'Unlimited Pantry Scans',
      description: 'Scan your pantry as many times as you want',
      freemium: '3 per month',
      premium: 'Unlimited',
    },
    {
      icon: 'bulb-outline',
      title: 'Unlimited AI Recipes',
      description: 'Generate personalized recipes with AI',
      freemium: '10 per month',
      premium: 'Unlimited',
    },
    {
      icon: 'headset-outline',
      title: 'Priority Support',
      description: 'Get faster help when you need it',
      freemium: 'Standard',
      premium: 'Priority',
    },
    {
      icon: 'star-outline',
      title: 'Early Access',
      description: 'Be first to try new features',
      freemium: '❌',
      premium: '✅',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upgrade to PREMIUM</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Current Tier Display */}
        <View style={styles.currentTierSection}>
          <Text style={styles.sectionTitle}>Current Plan</Text>
          <TierDisplay showUpgradeButton={false} />
        </View>

        {/* Premium Benefits */}
        <View style={styles.benefitsSection}>
          <Text style={styles.sectionTitle}>PREMIUM Features</Text>
          
          {features.map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={feature.icon as any} size={24} color="#10b981" />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
                <View style={styles.featureComparison}>
                  <View style={styles.comparisonItem}>
                    <Text style={styles.comparisonLabel}>FREEMIUM</Text>
                    <Text style={styles.comparisonValue}>{feature.freemium}</Text>
                  </View>
                  <View style={styles.comparisonItem}>
                    <Text style={styles.comparisonLabel}>PREMIUM</Text>
                    <Text style={[styles.comparisonValue, styles.premiumValue]}>{feature.premium}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Pricing */}
        <View style={styles.pricingSection}>
          <View style={styles.pricingCard}>
            <Text style={styles.pricingTitle}>PREMIUM Plan</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{PREMIUM_PRICE}</Text>
              <Text style={styles.pricePeriod}>/month</Text>
            </View>
            <Text style={styles.pricingSubtext}>Cancel anytime • No hidden fees</Text>
          </View>
        </View>
      </ScrollView>

      {/* Upgrade Button */}
      {usageData.tierDisplay === 'FREEMIUM' && (
        <View style={styles.upgradeButtonContainer}>
          <TouchableOpacity
            style={[styles.upgradeButton, isUpgrading && styles.upgradeButtonDisabled]}
            onPress={handleUpgrade}
            disabled={isUpgrading}
          >
            {isUpgrading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="diamond" size={20} color="#fff" />
                <Text style={styles.upgradeButtonText}>Upgrade to PREMIUM</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  currentTierSection: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  benefitsSection: {
    marginVertical: 16,
  },
  featureRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  featureComparison: {
    flexDirection: 'row',
  },
  comparisonItem: {
    flex: 1,
    marginRight: 16,
  },
  comparisonLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  comparisonValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 2,
  },
  premiumValue: {
    color: '#10b981',
  },
  pricingSection: {
    marginVertical: 24,
  },
  pricingCard: {
    backgroundColor: '#f8f9fa',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10b981',
  },
  pricingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#10b981',
  },
  pricePeriod: {
    fontSize: 16,
    color: '#6b7280',
    marginLeft: 4,
  },
  pricingSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  upgradeButtonContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  upgradeButtonDisabled: {
    opacity: 0.7,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
}); 