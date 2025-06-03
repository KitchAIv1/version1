import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageLocation } from './usePantryData';

const STORAGE_LOCATION_PREFERENCE_KEY = 'lastUsedStorageLocation';
const DEFAULT_STORAGE_LOCATION: StorageLocation = 'cupboard';

export const useStorageLocationPreference = () => {
  const [lastUsedLocation, setLastUsedLocation] = useState<StorageLocation>(
    DEFAULT_STORAGE_LOCATION,
  );
  const [isLoading, setIsLoading] = useState(true);

  // Load saved preference on mount
  useEffect(() => {
    loadPreference();
  }, []);

  const loadPreference = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_LOCATION_PREFERENCE_KEY);
      if (saved && isValidStorageLocation(saved)) {
        setLastUsedLocation(saved as StorageLocation);
        console.log(
          '[useStorageLocationPreference] Loaded last used location:',
          saved,
        );
      } else {
        console.log(
          '[useStorageLocationPreference] No saved preference, using default:',
          DEFAULT_STORAGE_LOCATION,
        );
      }
    } catch (error) {
      console.error(
        '[useStorageLocationPreference] Error loading preference:',
        error,
      );
    } finally {
      setIsLoading(false);
    }
  };

  const savePreference = useCallback(async (location: StorageLocation) => {
    try {
      await AsyncStorage.setItem(STORAGE_LOCATION_PREFERENCE_KEY, location);
      setLastUsedLocation(location);
      console.log('[useStorageLocationPreference] Saved preference:', location);
    } catch (error) {
      console.error(
        '[useStorageLocationPreference] Error saving preference:',
        error,
      );
    }
  }, []);

  const getDefaultLocation = useCallback((): StorageLocation => {
    return lastUsedLocation;
  }, [lastUsedLocation]);

  return {
    lastUsedLocation,
    isLoading,
    savePreference,
    getDefaultLocation,
  };
};

// Helper function to validate storage location
const isValidStorageLocation = (value: string): boolean => {
  return ['refrigerator', 'freezer', 'cupboard', 'condiments'].includes(value);
};
