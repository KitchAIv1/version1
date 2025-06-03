import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Animated,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  GlobalNotification,
  getNotificationIcon,
  getNotificationColor,
} from '../hooks/useNotifications';

interface ToastNotificationProps {
  notification: GlobalNotification;
  visible: boolean;
  onDismiss: () => void;
  onPress?: () => void;
  duration?: number; // Auto-dismiss duration in milliseconds
  position?: 'top' | 'bottom';
}

const { width: screenWidth } = Dimensions.get('window');
const TOAST_WIDTH = screenWidth - 32;

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  notification,
  visible,
  onDismiss,
  onPress,
  duration = 4000, // 4 seconds default
  position = 'top',
}) => {
  const slideAnim = useRef(
    new Animated.Value(position === 'top' ? -200 : 200),
  ).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const iconName = getNotificationIcon(notification.type);
  const priorityColor = getNotificationColor(notification.priority);

  const isUrgent =
    notification.priority === 'urgent' || notification.priority === 'high';

  const handleDismiss = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: position === 'top' ? -200 : 200,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  }, [slideAnim, opacityAnim, position, onDismiss]);

  useEffect(() => {
    if (visible) {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Animate in
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after duration (unless urgent)
      if (!isUrgent && duration > 0) {
        timeoutRef.current = setTimeout(() => {
          handleDismiss();
        }, duration);
      }
    } else {
      handleDismiss();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [visible, duration, isUrgent, slideAnim, opacityAnim, handleDismiss]);

  const handlePress = () => {
    onPress?.();
    handleDismiss();
  };

  if (!visible) return null;

  const getToastBackgroundColor = () => {
    switch (notification.priority) {
      case 'urgent':
        return '#fee2e2'; // Light red
      case 'high':
        return '#fef3c7'; // Light yellow
      default:
        return '#f0f9ff'; // Light blue
    }
  };

  const getToastBorderColor = () => {
    switch (notification.priority) {
      case 'urgent':
        return '#ef4444'; // Red
      case 'high':
        return '#f59e0b'; // Orange
      default:
        return '#10b981'; // Green
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top:
            position === 'top' ? (Platform.OS === 'ios' ? 60 : 40) : undefined,
          bottom:
            position === 'bottom'
              ? Platform.OS === 'ios'
                ? 100
                : 80
              : undefined,
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
          backgroundColor: getToastBackgroundColor(),
          borderColor: getToastBorderColor(),
        },
      ]}>
      <TouchableOpacity
        style={styles.touchableContent}
        onPress={handlePress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${notification.title}: ${notification.message}`}
        accessibilityHint="Tap to view notification details">
        <View style={styles.content}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${priorityColor}20` },
            ]}>
            <Ionicons name={iconName as any} size={20} color={priorityColor} />
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1}>
              {notification.title}
            </Text>
            <Text style={styles.message} numberOfLines={2}>
              {notification.message}
            </Text>
          </View>

          {isUrgent && (
            <View style={styles.urgentIndicator}>
              <Text style={styles.urgentText}>!</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.dismissButton}
          onPress={e => {
            e.stopPropagation();
            handleDismiss();
          }}
          accessibilityLabel="Dismiss notification"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={18} color="#6b7280" />
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Progress bar for auto-dismiss (only for non-urgent) */}
      {!isUrgent && duration > 0 && (
        <View style={styles.progressBarContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                backgroundColor: getToastBorderColor(),
                width: opacityAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, TOAST_WIDTH - 32],
                }),
              },
            ]}
          />
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 9999,
  },
  touchableContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 16,
  },
  urgentIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  urgentText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  dismissButton: {
    padding: 4,
    marginLeft: 8,
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
  },
  progressBar: {
    height: 2,
    borderRadius: 1,
  },
});
