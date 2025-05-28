import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InsufficientItemsModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToPantry: () => void;
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
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  statusContainer: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    marginBottom: 24,
  },
  statusText: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 4,
  },
  currentCount: {
    fontWeight: 'bold',
    color: '#10b981',
  },
  neededCount: {
    fontWeight: 'bold',
    color: '#f59e0b',
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
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  secondaryButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  tipText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
});

function InsufficientItemsModal({
  visible,
  onClose,
  onNavigateToPantry,
  currentItemCount,
}: InsufficientItemsModalProps) {
  const itemsNeeded = 3 - currentItemCount;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Ionicons name="restaurant-outline" size={48} color="#f59e0b" />
            <Text style={styles.title}>Need More Ingredients</Text>
          </View>

          <Text style={styles.message}>
            Add at least 3 items to your pantry to generate smart recipes.
          </Text>

          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>
              Current items:{' '}
              <Text style={styles.currentCount}>{currentItemCount}</Text>
            </Text>
            <Text style={styles.statusText}>
              Need <Text style={styles.neededCount}>{itemsNeeded} more</Text> to
              continue
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onNavigateToPantry}>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Add Items to Pantry</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.tipText}>
            💡 Tip: Scan your pantry or add items manually to get started!
          </Text>
        </View>
      </View>
    </Modal>
  );
}

export default InsufficientItemsModal;
