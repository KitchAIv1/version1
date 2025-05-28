import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAccessControl } from '../hooks/useAccessControl';

interface TierDisplayProps {
  onUpgradePress?: () => void;
  showUpgradeButton?: boolean;
  compact?: boolean;
}

export const TierDisplay: React.FC<TierDisplayProps> = ({ 
  onUpgradePress, 
  showUpgradeButton = true,
  compact = false 
}) => {
  const { getUsageDisplay } = useAccessControl();
  const usageData = getUsageDisplay();

  const getTierColor = () => {
    if (usageData.tierDisplay.includes('PREMIUM')) {
      return '#10b981'; // Green for premium
    }
    return '#f59e0b'; // Amber for freemium
  };

  const getTierIcon = () => {
    if (usageData.tierDisplay.includes('CREATOR')) {
      return 'star';
    } else if (usageData.tierDisplay.includes('PREMIUM')) {
      return 'diamond';
    }
    return 'person';
  };

  if (compact) {
    return (
      <View style={[styles.compactContainer, { borderColor: getTierColor() }]}>
        <Ionicons name={getTierIcon()} size={16} color={getTierColor()} />
        <Text style={[styles.compactTierText, { color: getTierColor() }]}>
          {usageData.tierDisplay}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tier Status */}
      <View style={[styles.tierContainer, { backgroundColor: `${getTierColor()}15` }]}>
        <View style={styles.tierHeader}>
          <Ionicons name={getTierIcon()} size={24} color={getTierColor()} />
          <Text style={[styles.tierText, { color: getTierColor() }]}>
            {usageData.tierDisplay}
          </Text>
        </View>
        
        {usageData.tierDisplay.includes('CREATOR') && (
          <Text style={styles.creatorSubtext}>
            Unlimited access to all features
          </Text>
        )}
      </View>

      {/* Usage Display for FREEMIUM users */}
      {usageData.showUsage && (
        <View style={styles.usageContainer}>
          <Text style={styles.usageTitle}>Monthly Usage</Text>
          
          <View style={styles.usageRow}>
            <View style={styles.usageItem}>
              <Ionicons name="camera-outline" size={20} color="#6b7280" />
              <Text style={styles.usageLabel}>Pantry Scans</Text>
              <Text style={styles.usageValue}>{usageData.scanUsage}</Text>
            </View>
            
            <View style={styles.usageItem}>
              <Ionicons name="bulb-outline" size={20} color="#6b7280" />
              <Text style={styles.usageLabel}>AI Recipes</Text>
              <Text style={styles.usageValue}>{usageData.aiRecipeUsage}</Text>
            </View>
          </View>

          {/* Upgrade Button */}
          {showUpgradeButton && onUpgradePress && (
            <TouchableOpacity style={styles.upgradeButton} onPress={onUpgradePress}>
              <Ionicons name="arrow-up-circle" size={20} color="#fff" />
              <Text style={styles.upgradeButtonText}>Upgrade to PREMIUM</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#fff',
    minHeight: 24,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  compactTierText: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 5,
    letterSpacing: 0.3,
  },
  tierContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  creatorSubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    marginLeft: 32,
  },
  usageContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  usageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  usageItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  usageLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    textAlign: 'center',
  },
  usageValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 2,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
}); 