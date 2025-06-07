import React, { memo, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  GlobalNotification,
  NotificationType,
  useMarkNotificationRead,
  useDismissNotification,
  useMarkAllNotificationsRead,
  getNotificationIcon,
  getNotificationColor,
} from '../hooks/useNotifications';

// Move styles to top to fix "styles used before defined" errors
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#10b981',
    borderRadius: 8,
  },
  markAllButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fef2f2',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyListContent: {
    flex: 1,
  },
  notificationItem: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  unreadNotification: {
    backgroundColor: '#f9fafb',
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
  },
  urgentNotification: {
    borderLeftColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  unreadTitle: {
    fontWeight: '700',
  },
  notificationTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  notificationTypeLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  notificationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  urgentBanner: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgentText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#f9fafb',
  },
  footerText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
  },
});

interface NotificationItemProps {
  notification: GlobalNotification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onAction?: (notification: GlobalNotification) => void;
}

const NotificationItem = memo<NotificationItemProps>(
  ({ notification, onMarkRead, onDismiss, onAction }) => {
    const iconName = getNotificationIcon(notification.type);
    const priorityColor = getNotificationColor(notification.priority);

    const handleMarkRead = useCallback(() => {
      onMarkRead(notification.id);
    }, [notification.id, onMarkRead]);

    const handleDismiss = useCallback(() => {
      onDismiss(notification.id);
    }, [notification.id, onDismiss]);

    const handleAction = useCallback(() => {
      // Mark as read when taking action
      if (!notification.read) {
        onMarkRead(notification.id);
      }

      // Handle action_url for deep linking
      if (notification.action_url) {
        Linking.openURL(notification.action_url).catch(err => {
          console.error('Failed to open URL:', err);
          Alert.alert('Error', 'Unable to open link');
        });
        return;
      }

      // Call custom action handler
      onAction?.(notification);
    }, [notification, onMarkRead, onAction]);

    const formatTime = (dateString: string) => {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        return `${diffDays}d ago`;
      }
      if (diffHours > 0) {
        return `${diffHours}h ago`;
      }
      return 'Just now';
    };

    const getTypeDisplayName = (type: NotificationType): string => {
      switch (type) {
        case 'aging_alert':
          return 'Pantry Alert';
        case 'review_prompt':
          return 'Review Reminder';
        case 'meal_plan_ready':
          return 'Meal Plan';
        case 'recipe_liked':
          return 'Recipe Liked';
        case 'recipe_commented':
          return 'New Comment';
        case 'new_follower':
          return 'New Follower';
        case 'feature_announcement':
          return 'New Feature';
        case 'maintenance_notice':
          return 'System Notice';
        case 'upgrade_prompt':
          return 'Upgrade Available';
        default:
          return 'Notification';
      }
    };

    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !notification.read && styles.unreadNotification,
          notification.priority === 'urgent' && styles.urgentNotification,
        ]}
        onPress={handleAction}
        accessibilityLabel={`${getTypeDisplayName(notification.type)}: ${notification.message}`}
        accessibilityHint={
          notification.read
            ? 'Tap to view details'
            : 'Tap to view details and mark as read'
        }>
        <View style={styles.notificationHeader}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${priorityColor}20` },
            ]}>
            <Ionicons name={iconName as any} size={20} color={priorityColor} />
          </View>

          <View style={styles.notificationContent}>
            <View style={styles.notificationTitleRow}>
              <Text
                style={[
                  styles.notificationTitle,
                  !notification.read && styles.unreadTitle,
                ]}>
                {notification.title}
              </Text>
              <Text style={styles.notificationTime}>
                {formatTime(notification.created_at)}
              </Text>
            </View>

            <Text
              style={[styles.notificationTypeLabel, { color: priorityColor }]}>
              {getTypeDisplayName(notification.type)}
            </Text>

            <Text style={styles.notificationMessage}>
              {notification.message}
            </Text>
          </View>

          <View style={styles.notificationActions}>
            {!notification.read && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleMarkRead}
                accessibilityLabel="Mark as read"
                accessibilityHint="Marks this notification as read">
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color="#10b981"
                />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleDismiss}
              accessibilityLabel="Dismiss notification"
              accessibilityHint="Removes this notification">
              <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        {notification.priority === 'urgent' && (
          <View style={styles.urgentBanner}>
            <Text style={styles.urgentText}>Urgent</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  },
);

NotificationItem.displayName = 'NotificationItem';

interface NotificationDrawerProps {
  visible: boolean;
  notifications: GlobalNotification[];
  onClose: () => void;
  onNotificationAction?: (notification: GlobalNotification) => void;
  userId?: string;
}

export const NotificationDrawer = memo<NotificationDrawerProps>(
  ({ visible, notifications, onClose, onNotificationAction, userId }) => {
    const markReadMutation = useMarkNotificationRead();
    const dismissMutation = useDismissNotification();
    const markAllReadMutation = useMarkAllNotificationsRead(userId);

    const unreadCount = notifications.filter(n => !n.read).length;

    // Group notifications by priority and type for better organization
    const { urgentNotifications, otherNotifications } = useMemo(() => {
      const urgent = notifications.filter(n => n.priority === 'urgent');
      const other = notifications.filter(n => n.priority !== 'urgent');

      return {
        urgentNotifications: urgent,
        otherNotifications: other,
      };
    }, [notifications]);

    const handleMarkRead = useCallback(
      (notificationId: string) => {
        markReadMutation.mutate(notificationId);
      },
      [markReadMutation],
    );

    const handleDismiss = useCallback(
      (notificationId: string) => {
        dismissMutation.mutate(notificationId);
      },
      [dismissMutation],
    );

    const handleMarkAllRead = useCallback(() => {
      if (unreadCount > 0) {
        markAllReadMutation.mutate();
      }
    }, [markAllReadMutation, unreadCount]);

    const renderNotification = useCallback(
      ({ item }: { item: GlobalNotification }) => (
        <NotificationItem
          notification={item}
          onMarkRead={handleMarkRead}
          onDismiss={handleDismiss}
          onAction={onNotificationAction}
        />
      ),
      [handleMarkRead, handleDismiss, onNotificationAction],
    );

    const keyExtractor = useCallback((item: GlobalNotification) => item.id, []);

    const renderSeparator = useCallback(
      () => <View style={styles.separator} />,
      [],
    );

    const renderEmptyState = () => (
      <View style={styles.emptyState}>
        <Ionicons name="notifications-outline" size={48} color="#cbd5e1" />
        <Text style={styles.emptyStateTitle}>No notifications</Text>
        <Text style={styles.emptyStateText}>
          You're all caught up! New notifications will appear here.
        </Text>
      </View>
    );

    const renderHeader = () => (
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Alerts & Reminders</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.markAllButton}
              onPress={handleMarkAllRead}
              accessibilityLabel={`Mark all ${unreadCount} notifications as read`}>
              <Text style={styles.markAllButtonText}>Mark All Read</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            accessibilityLabel="Close notifications">
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>
    );

    const allNotifications = [...urgentNotifications, ...otherNotifications];

    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}>
        <SafeAreaView style={styles.container}>
          {renderHeader()}

          {notifications.length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              {urgentNotifications.length > 0 && (
                <View style={styles.sectionHeader}>
                  <Ionicons name="warning" size={16} color="#ef4444" />
                  <Text style={styles.sectionTitle}>Urgent Notifications</Text>
                </View>
              )}

              <FlatList
                data={allNotifications}
                renderItem={renderNotification}
                keyExtractor={keyExtractor}
                ItemSeparatorComponent={renderSeparator}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                  styles.listContent,
                  notifications.length === 0 && styles.emptyListContent,
                ]}
                removeClippedSubviews
                maxToRenderPerBatch={10}
                windowSize={10}
                initialNumToRender={8}
                updateCellsBatchingPeriod={100}
              />
            </>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Stay updated with personalized alerts about your pantry, recipes,
              and more.
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    );
  },
);

NotificationDrawer.displayName = 'NotificationDrawer';
