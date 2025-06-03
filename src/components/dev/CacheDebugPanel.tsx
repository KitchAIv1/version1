import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createCacheManager } from '../../utils/cacheUtils';

interface CacheDebugPanelProps {
  visible: boolean;
  onClose: () => void;
}

export const CacheDebugPanel: React.FC<CacheDebugPanelProps> = ({
  visible,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [storageKeys, setStorageKeys] = useState<string[]>([]);

  const cacheManager = createCacheManager(queryClient);

  const handleAction = async (
    action: () => Promise<void>,
    actionName: string,
  ) => {
    setIsLoading(true);
    try {
      await action();
      Alert.alert('Success', `${actionName} completed successfully!`);
    } catch (error) {
      console.error(`Error during ${actionName}:`, error);
      Alert.alert(
        'Error',
        `Failed to ${actionName.toLowerCase()}. Check console for details.`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const showStorageKeys = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      setStorageKeys([...keys]);
      Alert.alert(
        'AsyncStorage Keys',
        keys.length > 0 ? keys.join('\n') : 'No keys found',
        [{ text: 'OK', style: 'default' }],
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to retrieve storage keys');
    }
  };

  const showQueryCacheInfo = () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();

    const queryInfo = queries.map(query => ({
      key: JSON.stringify(query.queryKey),
      state: query.state.status,
      dataSize: query.state.data ? JSON.stringify(query.state.data).length : 0,
    }));

    Alert.alert(
      'React Query Cache Info',
      `Total Queries: ${queries.length}\n\nTop Queries:\n${queryInfo
        .slice(0, 5)
        .map(q => `• ${q.key} (${q.state})`)
        .join('\n')}`,
      [{ text: 'OK', style: 'default' }],
    );
  };

  const actionButtons = [
    {
      title: 'Clear All Caches',
      subtitle: 'Clears React Query + AsyncStorage',
      icon: 'trash-outline',
      color: '#ef4444',
      action: () =>
        handleAction(() => cacheManager.clearAllCaches(), 'Clear All Caches'),
    },
    {
      title: 'Clear Data Only',
      subtitle: 'Preserves auth, clears app data',
      icon: 'refresh-outline',
      color: '#f59e0b',
      action: () =>
        handleAction(
          () => cacheManager.clearDataCachesOnly(),
          'Clear Data Caches',
        ),
    },
    {
      title: 'Clear Profile Cache',
      subtitle: 'Clears user profile data',
      icon: 'person-outline',
      color: '#8b5cf6',
      action: () =>
        handleAction(
          () => cacheManager.clearProfileCache(),
          'Clear Profile Cache',
        ),
    },
    {
      title: 'Clear Feed Cache',
      subtitle: 'Clears recipe feed data',
      icon: 'grid-outline',
      color: '#06b6d4',
      action: () =>
        handleAction(() => cacheManager.clearFeedCache(), 'Clear Feed Cache'),
    },
    {
      title: 'Clear Pantry Cache',
      subtitle: 'Clears pantry/stock data',
      icon: 'basket-outline',
      color: '#10b981',
      action: () =>
        handleAction(
          () => cacheManager.clearPantryCache(),
          'Clear Pantry Cache',
        ),
    },
    {
      title: 'Force Refresh',
      subtitle: 'Refetch all active queries',
      icon: 'reload-outline',
      color: '#22c55e',
      action: () =>
        handleAction(
          () => cacheManager.forceRefreshAllQueries(),
          'Force Refresh',
        ),
    },
  ];

  const infoButtons = [
    {
      title: 'Show Storage Keys',
      subtitle: 'View AsyncStorage keys',
      icon: 'key-outline',
      action: showStorageKeys,
    },
    {
      title: 'Query Cache Info',
      subtitle: 'View React Query cache stats',
      icon: 'information-circle-outline',
      action: showQueryCacheInfo,
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Cache Debug Panel</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cache Actions</Text>
            <Text style={styles.sectionSubtitle}>
              Clear different types of cached data
            </Text>

            {actionButtons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.actionButton,
                  isLoading && styles.disabledButton,
                ]}
                onPress={button.action}
                disabled={isLoading}>
                <View style={styles.buttonContent}>
                  <View
                    style={[
                      styles.iconContainer,
                      { backgroundColor: `${button.color}20` },
                    ]}>
                    <Ionicons
                      name={button.icon as any}
                      size={20}
                      color={button.color}
                    />
                  </View>
                  <View style={styles.buttonText}>
                    <Text style={styles.buttonTitle}>{button.title}</Text>
                    <Text style={styles.buttonSubtitle}>{button.subtitle}</Text>
                  </View>
                  {isLoading && <ActivityIndicator size="small" color="#666" />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cache Information</Text>
            <Text style={styles.sectionSubtitle}>
              View cache statistics and stored data
            </Text>

            {infoButtons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={styles.infoButton}
                onPress={button.action}>
                <View style={styles.buttonContent}>
                  <View style={styles.iconContainer}>
                    <Ionicons
                      name={button.icon as any}
                      size={20}
                      color="#666"
                    />
                  </View>
                  <View style={styles.buttonText}>
                    <Text style={styles.buttonTitle}>{button.title}</Text>
                    <Text style={styles.buttonSubtitle}>{button.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#666" />
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.warningSection}>
            <Ionicons name="warning-outline" size={20} color="#f59e0b" />
            <Text style={styles.warningText}>
              This panel is for development/debugging only. Clearing caches may
              require users to log in again.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

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
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  actionButton: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoButton: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  buttonText: {
    flex: 1,
  },
  buttonTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  buttonSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  warningSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 32,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#92400e',
    marginLeft: 12,
    lineHeight: 20,
  },
});

export default CacheDebugPanel;
