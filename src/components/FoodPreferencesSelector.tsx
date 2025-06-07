import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

// Move styles to top to fix "styles used before defined" errors
const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  preferencesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  preferenceItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#e0e0e0', // Light gray for unselected
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  preferenceItemSelected: {
    backgroundColor: '#22c55e', // Green for selected (Kitchai primary)
    borderColor: '#16a34a', // Darker green border
  },
  preferenceText: {
    fontSize: 14,
    color: '#333', // Dark text for unselected
  },
  preferenceTextSelected: {
    color: '#fff', // White text for selected
    fontWeight: '500',
  },
});

interface FoodPreferencesSelectorProps {
  currentPreferences: string[];
  onPreferencesChange: (preferences: string[]) => void;
}

// Updated list of allowed diet tags from backend (normalized)
const AVAILABLE_PREFERENCES = [
  'carnivore',
  'gluten-free',
  'hyper-keto',
  'intermittent-fasting',
  'keto',
  'low-carb',
  'low-fodmap',
  'mediterranean',
  'paleo',
  'standard',
  'vegan',
  'vegetarian',
];

const FoodPreferencesSelector: React.FC<FoodPreferencesSelectorProps> = ({
  currentPreferences,
  onPreferencesChange,
}) => {
  const togglePreference = (preference: string) => {
    const newPreferences = currentPreferences.includes(preference)
      ? currentPreferences.filter(p => p !== preference)
      : [...currentPreferences, preference];
    onPreferencesChange(newPreferences);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Select Your Food Preferences:</Text>
      <View style={styles.preferencesList}>
        {AVAILABLE_PREFERENCES.map(preference => {
          const isSelected = currentPreferences.includes(preference);
          return (
            <TouchableOpacity
              key={preference}
              style={[
                styles.preferenceItem,
                isSelected && styles.preferenceItemSelected,
              ]}
              onPress={() => togglePreference(preference)}>
              <Text
                style={[
                  styles.preferenceText,
                  isSelected && styles.preferenceTextSelected,
                ]}>
                {preference}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
};

export default FoodPreferencesSelector;
