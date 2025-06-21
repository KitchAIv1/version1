import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  Alert,
  ListRenderItem,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  AgingNotification,
  useMarkNotificationRead,
  useDismissNotification,
  useMarkAllNotificationsRead,
  useAgingNotifications,
} from '../hooks/useAgingNotifications';
import { AGE_GROUP_CONFIG } from '../hooks/useStockAging';
import { useAuth } from '../providers/AuthProvider';

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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markAllReadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  markAllReadText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
    marginLeft: 4,
  },
  closeButton: {
    padding: 4,
  },
  listContent: {
    paddingVertical: 8,
    flexGrow: 1,
  },
  notificationItem: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ageBadge: {
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
    marginRight: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 6,
  },
  notificationMetadata: {
    fontSize: 12,
    color: '#9ca3af',
  },
  notificationTime: {
    fontSize: 12,
    color: '#9ca3af',
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

interface AgingNotificationsPanelProps {
  isVisible: boolean;
  onClose: () => void;
  onViewItem?: (itemId: string) => void;
  notifications: AgingNotification[];
  unreadCount: number;
}

interface NotificationItemProps {
  notification: AgingNotification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onViewItem?: (itemId: string) => void;
}

const NotificationItem = memo<NotificationItemProps>(
  ({ notification, onMarkRead, onDismiss, onViewItem }) => {
    // Handle both flat structure (actual backend) and nested metadata (legacy)
    const item_name =
      notification.item_name ||
      notification.metadata?.item_name ||
      'Unknown item';
    const days_old =
      notification.days_old ?? notification.metadata?.days_old ?? 0;
    const stock_item_id =
      notification.stock_item_id || notification.metadata?.stock_item_id;

    // Calculate age_group based on days_old (since backend doesn't provide it)
    const age_group =
      notification.metadata?.age_group ||
      (days_old > 14 ? 'red' : days_old >= 7 ? 'yellow' : 'green');

    // Generate title and message if missing
    const title = notification.title || `${item_name} is aging`;
    const message =
      notification.message ||
      (age_group === 'red'
        ? `${item_name} is ${days_old} days old and may be spoiled`
        : age_group === 'yellow'
          ? `${item_name} is ${days_old} days old and should be used soon`
          : `${item_name} is ${days_old} days old and still fresh`);

    const ageConfig = AGE_GROUP_CONFIG[age_group];

    const handleMarkRead = useCallback(() => {
      onMarkRead(notification.id);
    }, [notification.id, onMarkRead]);

    const handleDismiss = useCallback(() => {
      onDismiss(notification.id);
    }, [notification.id, onDismiss]);

    const handleViewItem = useCallback(() => {
      if (stock_item_id && onViewItem) {
        onViewItem(stock_item_id);
        onMarkRead(notification.id); // Mark as read when viewing
      }
    }, [stock_item_id, notification.id, onViewItem, onMarkRead]);

    return (
      <View
        style={[
          styles.notificationItem,
          // Show all notifications the same way since we don't track read status
        ]}>
        <View style={styles.notificationHeader}>
          <View
            style={[
              styles.ageBadge,
              {
                backgroundColor: ageConfig.backgroundColor,
                borderColor: ageConfig.color,
              },
            ]}>
            <Ionicons
              name={
                age_group === 'red'
                  ? 'alert-circle'
                  : age_group === 'yellow'
                    ? 'warning'
                    : 'checkmark-circle'
              }
              size={16}
              color={ageConfig.color}
            />
          </View>

          <View style={styles.notificationContent}>
            <Text style={styles.notificationTitle}>{title}</Text>
            <Text style={styles.notificationMessage}>{message}</Text>
            <Text style={styles.notificationMetadata}>
              {item_name} • {days_old} days old • {ageConfig.label}
            </Text>
            <Text style={styles.notificationTime}>
              {new Date(notification.created_at).toLocaleDateString()} at{' '}
              {new Date(notification.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>

          <View style={styles.notificationActions}>
            {stock_item_id && onViewItem && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleViewItem}
                accessibilityLabel={`View ${item_name}`}
                accessibilityHint="Opens the pantry item for editing">
                <Ionicons name="eye-outline" size={20} color="#6b7280" />
              </TouchableOpacity>
            )}

            {/* Simplified actions since we don't have is_read field */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleDismiss}
              accessibilityLabel="Dismiss notification"
              accessibilityHint="Removes this notification">
              <Ionicons name="close-circle-outline" size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  },
);

NotificationItem.displayName = 'NotificationItem';

const AgingNotificationsPanel: React.FC<AgingNotificationsPanelProps> = ({
  isVisible,
  onClose,
  onViewItem,
  notifications,
  unreadCount,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isLoading = false; // Since we handle loading internally in the hook
  const error = null; // Error handling is done internally in the hook

  const markReadMutation = useMarkNotificationRead();
  const dismissMutation = useDismissNotification();

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

  const renderNotification = useCallback(
    ({ item }: { item: AgingNotification }) => (
      <NotificationItem
        notification={item}
        onMarkRead={handleMarkRead}
        onDismiss={handleDismiss}
        onViewItem={onViewItem}
      />
    ),
    [handleMarkRead, handleDismiss, onViewItem],
  );

  const keyExtractor = useCallback((item: AgingNotification) => item.id, []);

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="notifications-outline" size={48} color="#cbd5e1" />
      <Text style={styles.emptyStateTitle}>No aging alerts</Text>
      <Text style={styles.emptyStateText}>
        You'll see notifications here when pantry items are getting old
      </Text>
    </View>
  );

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Aging Alerts</Text>
            {notifications.length > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {notifications.length}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              accessibilityLabel="Close notifications">
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Notifications List */}
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={keyExtractor}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />

        {/* Help Text */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            💡 Tip: Red items are 15+ days old and should be used immediately.
            Yellow items are 7-14 days old and should be used soon. Green items
            are fresh (0-6 days).
          </Text>
        </View>
      </View>
    </Modal>
  );
};

AgingNotificationsPanel.displayName = 'AgingNotificationsPanel';

export default AgingNotificationsPanel;
export { AgingNotificationsPanel };
