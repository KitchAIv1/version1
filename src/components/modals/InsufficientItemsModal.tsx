import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/types';
import { useAccessControl } from '../../hooks/useAccessControl';

type NavigationProp = NativeStackNavigationProp<MainStackParamList>;

interface InsufficientItemsModalProps {
  visible: boolean;
  onClose: () => void;
  currentItemCount: number;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  statusContainer: {
    backgroundColor: '#f8fafc',
    padding: 20,
    borderRadius: 16,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  currentCount: {
    color: '#ef4444',
  },
  neededCount: {
    color: '#f59e0b',
  },
  requiredCount: {
    color: '#10b981',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 12,
  },
  freemiumContainer: {
    backgroundColor: '#ecfdf5',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  freemiumTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#047857',
    marginBottom: 8,
    textAlign: 'center',
  },
  freemiumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  freemiumLabel: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '500',
  },
  freemiumValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#047857',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#10b981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  secondaryButtonText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  tertiaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  tertiaryButtonText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  encouragementText: {
    fontSize: 13,
    color: '#059669',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
    lineHeight: 18,
  },
});

function InsufficientItemsModal({
  visible,
  onClose,
  currentItemCount,
}: InsufficientItemsModalProps) {
  const navigation = useNavigation<NavigationProp>();
  const { getUsageDisplay, canPerformScan } = useAccessControl();
  
  const usageData = getUsageDisplay();
  const isFreemiumUser = usageData.showUsage;
  const itemsNeeded = 3 - currentItemCount;
  const canScan = canPerformScan();

  const handleAIScanPress = () => {
    onClose();
    // Navigate to PantryScan screen
    navigation.navigate('PantryScan');
  };

  const handleManualAddPress = () => {
    onClose();
    // Navigate to Pantry tab and trigger manual add modal
    navigation.navigate('MainTabs', { 
      screen: 'Pantry', 
      params: { showManualAdd: true } 
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="restaurant" size={36} color="#f59e0b" />
            </View>
            <Text style={styles.title}>🔮 Need More Ingredients</Text>
            <Text style={styles.subtitle}>
              Add at least 3 pantry items to generate AI recipes
            </Text>
          </View>

          {/* Status Container */}
          <View style={styles.statusContainer}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Current items:</Text>
              <Text style={[styles.statusValue, styles.currentCount]}>
                {currentItemCount}
              </Text>
            </View>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Need at least:</Text>
              <Text style={[styles.statusValue, styles.requiredCount]}>3</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Missing:</Text>
              <Text style={[styles.statusValue, styles.neededCount]}>
                {itemsNeeded} more item{itemsNeeded !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {/* FREEMIUM Usage Info */}
          {isFreemiumUser && (
            <View style={styles.freemiumContainer}>
              <Text style={styles.freemiumTitle}>
                🎁 Your FREEMIUM Benefits
              </Text>
              <View style={styles.freemiumRow}>
                <Text style={styles.freemiumLabel}>📱 AI Scans remaining:</Text>
                <Text style={styles.freemiumValue}>{usageData.scanUsage}</Text>
              </View>
              <View style={styles.freemiumRow}>
                <Text style={styles.freemiumLabel}>⚡ AI Recipes remaining:</Text>
                <Text style={styles.freemiumValue}>{usageData.aiRecipeUsage}</Text>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {/* AI Scan Button - Only if user can scan */}
            {canScan && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleAIScanPress}>
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>
                  📱 AI Scan Items
                </Text>
              </TouchableOpacity>
            )}

            {/* Manual Add Button */}
            <TouchableOpacity
              style={canScan ? styles.secondaryButton : styles.primaryButton}
              onPress={handleManualAddPress}>
              <Ionicons 
                name="add-circle" 
                size={20} 
                color={canScan ? "#475569" : "#fff"} 
              />
              <Text style={canScan ? styles.secondaryButtonText : styles.primaryButtonText}>
                ✏️ Add Manually
              </Text>
            </TouchableOpacity>

            {/* Maybe Later Button */}
            <TouchableOpacity style={styles.tertiaryButton} onPress={onClose}>
              <Text style={styles.tertiaryButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>

          {/* Encouragement Text */}
          <Text style={styles.encouragementText}>
            💡 The more items you add, the better your AI recipes will be!
          </Text>
        </View>
      </View>
    </Modal>
  );
}

export default InsufficientItemsModal;
