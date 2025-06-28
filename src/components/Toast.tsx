import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

interface ToastProps {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
  onHide: () => void;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  type,
  duration = 4000,
  onHide,
  action,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout>();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      Animated.spring(animatedValue, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();

      timeoutRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    } else {
      hideToast();
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [visible, duration]);

  const hideToast = () => {
    Animated.timing(animatedValue, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onHide();
    });
  };

  const getToastConfig = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: '#10b981',
          icon: 'check-circle',
          iconColor: '#fff',
        };
      case 'error':
        return {
          backgroundColor: '#ef4444',
          icon: 'x-circle',
          iconColor: '#fff',
        };
      case 'info':
      default:
        return {
          backgroundColor: '#3b82f6',
          icon: 'info',
          iconColor: '#fff',
        };
    }
  };

  const config = getToastConfig();

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 0],
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  if (!visible && animatedValue._value === 0) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: config.backgroundColor,
          top: insets.top + 10,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={styles.content}>
        <Feather
          name={config.icon as any}
          size={20}
          color={config.iconColor}
          style={styles.icon}
        />
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
        {action && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={action.onPress}
          >
            <Text style={styles.actionText}>{action.label}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.closeButton} onPress={hideToast}>
          <Feather name="x" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10000,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  icon: {
    marginRight: 12,
  },
  message: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  actionButton: {
    marginLeft: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    marginLeft: 8,
    padding: 4,
  },
});

export default Toast;
