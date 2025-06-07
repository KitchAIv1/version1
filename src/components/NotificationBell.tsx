import React, { memo } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Move styles to top to fix "styles used before defined" errors
const styles = StyleSheet.create({
  container: {
    padding: 8,
  },
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  dotBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    minWidth: 12,
    top: -6,
    right: -6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
  },
});

interface NotificationBellProps {
  unreadCount: number;
  onPress: () => void;
  size?: number;
  color?: string;
  style?: ViewStyle;
  badgeColor?: string;
  showDot?: boolean; // Show dot instead of count for large numbers
}

export const NotificationBell = memo<NotificationBellProps>(
  ({
    unreadCount,
    onPress,
    size = 24,
    color = '#1f2937',
    style,
    badgeColor = '#ef4444',
    showDot = false,
  }) => {
    const hasUnread = unreadCount > 0;
    const displayCount = unreadCount > 99 ? '99+' : unreadCount.toString();
    const shouldShowDot = showDot || unreadCount > 99;

    return (
      <TouchableOpacity
        style={[styles.container, style]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={
          hasUnread ? `Notifications, ${unreadCount} unread` : 'Notifications'
        }
        accessibilityHint="Opens notification panel"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <View style={styles.iconContainer}>
          <Ionicons
            name={hasUnread ? 'notifications' : 'notifications-outline'}
            size={size}
            color={hasUnread ? badgeColor : color}
          />

          {hasUnread && (
            <View
              style={[
                styles.badge,
                { backgroundColor: badgeColor },
                shouldShowDot && styles.dotBadge,
              ]}>
              {!shouldShowDot && (
                <Text
                  style={[
                    styles.badgeText,
                    { fontSize: unreadCount > 9 ? 10 : 12 },
                  ]}>
                  {displayCount}
                </Text>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  },
);

NotificationBell.displayName = 'NotificationBell';
