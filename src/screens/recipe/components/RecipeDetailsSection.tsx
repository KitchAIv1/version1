import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
} from 'react-native';
import { OptimizedCollapsibleCard } from './OptimizedCollapsibleCard';

const BRAND_PRIMARY = '#10B981';

interface FormData {
  title: string;
  description: string;
  prepTimeMinutes: string;
  cookTimeMinutes: string;
  servings: string;
  isPublic: boolean;
}

interface RecipeDetailsSectionProps {
  formData: FormData;
  onUpdateFormData: (field: string, value: any) => void;
}

// Optimized Basic Details Component
const OptimizedBasicDetails = React.memo<{
  title: string;
  description: string;
  onUpdateFormData: (field: string, value: any) => void;
}>(({ title, description, onUpdateFormData }) => {
  const handleTitleChange = useCallback((value: string) => {
    onUpdateFormData('title', value);
  }, [onUpdateFormData]);

  const handleDescriptionChange = useCallback((value: string) => {
    onUpdateFormData('description', value);
  }, [onUpdateFormData]);

  return (
    <OptimizedCollapsibleCard
      title="Recipe Details"
      icon="info"
      defaultCollapsed={false}>
      <TextInput
        placeholder="Recipe Title"
        value={title}
        onChangeText={handleTitleChange}
        style={styles.input}
        placeholderTextColor="#999"
      />
      <TextInput
        placeholder="Description (tell the story behind your recipe)"
        value={description}
        onChangeText={handleDescriptionChange}
        style={styles.inputMulti}
        multiline
        numberOfLines={4}
        placeholderTextColor="#999"
      />
    </OptimizedCollapsibleCard>
  );
});
OptimizedBasicDetails.displayName = 'OptimizedBasicDetails';

// Optimized Time Input Component
const OptimizedTimeInput = React.memo<{
  label: string;
  value: string;
  unit: string;
  onChangeText: (value: string) => void;
}>(({ label, value, unit, onChangeText }) => (
  <View style={styles.timeInputContainer}>
    <Text style={styles.inputLabel}>{label}</Text>
    <View style={styles.timeInputWrapper}>
      <TextInput
        placeholder="0"
        value={value}
        onChangeText={onChangeText}
        style={styles.timeInput}
        keyboardType="numeric"
        placeholderTextColor="#999"
      />
      <Text style={styles.timeUnitText}>{unit}</Text>
    </View>
  </View>
));
OptimizedTimeInput.displayName = 'OptimizedTimeInput';

// Optimized Timings Component
const OptimizedTimings = React.memo<{
  prepTimeMinutes: string;
  cookTimeMinutes: string;
  servings: string;
  onUpdateFormData: (field: string, value: any) => void;
}>(({ prepTimeMinutes, cookTimeMinutes, servings, onUpdateFormData }) => {
  const handlePrepTimeChange = useCallback((value: string) => {
    onUpdateFormData('prepTimeMinutes', value);
  }, [onUpdateFormData]);

  const handleCookTimeChange = useCallback((value: string) => {
    onUpdateFormData('cookTimeMinutes', value);
  }, [onUpdateFormData]);

  const handleServingsChange = useCallback((value: string) => {
    onUpdateFormData('servings', value);
  }, [onUpdateFormData]);

  return (
    <OptimizedCollapsibleCard title="Timings & Servings" icon="clock">
      <View style={styles.timeInputRow}>
        <OptimizedTimeInput
          label="Prep Time"
          value={prepTimeMinutes}
          unit="min"
          onChangeText={handlePrepTimeChange}
        />
        <OptimizedTimeInput
          label="Cook Time"
          value={cookTimeMinutes}
          unit="min"
          onChangeText={handleCookTimeChange}
        />
        <OptimizedTimeInput
          label="Servings"
          value={servings}
          unit="portions"
          onChangeText={handleServingsChange}
        />
      </View>
    </OptimizedCollapsibleCard>
  );
});
OptimizedTimings.displayName = 'OptimizedTimings';

// Main RecipeDetailsSection Component
export const RecipeDetailsSection = React.memo<RecipeDetailsSectionProps>(({
  formData,
  onUpdateFormData,
}) => {
  return (
    <>
      <OptimizedBasicDetails
        title={formData.title}
        description={formData.description}
        onUpdateFormData={onUpdateFormData}
      />
      <OptimizedTimings
        prepTimeMinutes={formData.prepTimeMinutes}
        cookTimeMinutes={formData.cookTimeMinutes}
        servings={formData.servings}
        onUpdateFormData={onUpdateFormData}
      />
    </>
  );
});

RecipeDetailsSection.displayName = 'RecipeDetailsSection';

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#111827',
  },
  inputMulti: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#111827',
  },
  inputLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 6,
    fontWeight: '500',
  },
  timeInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  timeInputContainer: {
    flex: 1,
    marginHorizontal: 4,
  },
  timeInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    height: 48,
  },
  timeInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  timeUnitText: {
    color: '#6b7280',
    fontSize: 14,
  },
});

export default RecipeDetailsSection; 