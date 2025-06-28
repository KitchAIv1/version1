import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInDown, 
  SlideOutDown,
  BounceIn,
} from 'react-native-reanimated';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ScanFallbackModalProps {
  visible: boolean;
  fallbackType: 'no_items' | 'error' | 'network';
  onRetry: () => void;
  onManualAdd: () => void;
  onClose: () => void;
}

const getFallbackContent = (type: string) => {
  switch (type) {
    case 'no_items':
      return {
        icon: 'camera-alt',
        iconColor: '#3b82f6',
        iconBg: '#dbeafe',
        title: 'No Items Detected',
        subtitle: 'Try positioning items more clearly in the frame or improving lighting conditions.',
        primaryAction: 'Try Again',
        secondaryAction: 'Add Manually',
      };
    case 'network':
      return {
        icon: 'wifi-off',
        iconColor: '#f59e0b',
        iconBg: '#fef3c7',
        title: 'Connection Issue',
        subtitle: 'Please check your internet connection and try scanning again.',
        primaryAction: 'Try Again',
        secondaryAction: 'Add Manually',
      };
    case 'error':
    default:
      return {
        icon: 'error-outline',
        iconColor: '#ef4444',
        iconBg: '#fee2e2',
        title: 'Scanning Error',
        subtitle: 'Something went wrong during scanning. Please try again.',
        primaryAction: 'Try Again',
        secondaryAction: 'Add Manually',
      };
  }
};

export const ScanFallbackModal: React.FC<ScanFallbackModalProps> = ({
  visible,
  fallbackType,
  onRetry,
  onManualAdd,
  onClose,
}) => {
  const content = getFallbackContent(fallbackType);

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

          {/* Header with Icon */}
          <View style={styles.header}>
            <Animated.View 
              entering={BounceIn.delay(200).duration(600)}
              style={[styles.iconContainer, { backgroundColor: content.iconBg }]}>
              <Icon name={content.icon} size={32} color={content.iconColor} />
            </Animated.View>
            
            <Text style={styles.title}>{content.title}</Text>
            <Text style={styles.subtitle}>{content.subtitle}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={onRetry}>
              <View style={styles.primaryButtonContent}>
                <Icon name="refresh" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>{content.primaryAction}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={onManualAdd}>
              <View style={styles.secondaryButtonContent}>
                <Icon name="edit" size={20} color="#10b981" />
                <Text style={styles.secondaryButtonText}>{content.secondaryAction}</Text>
              </View>
            </TouchableOpacity>
          </View>
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
    marginBottom: 32,
    marginTop: 12,
  },
  iconContainer: {
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
    paddingHorizontal: 8,
  },
  actionContainer: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#10b981',
    borderRadius: 16,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  secondaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default ScanFallbackModal; 