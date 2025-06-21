import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { OptimizedCollapsibleCard } from './OptimizedCollapsibleCard';

interface FormData {
  title: string;
  description: string;
  prepTimeMinutes: string;
  cookTimeMinutes: string;
  servings: string;
  isPublic: boolean;
}

interface EditRecipeDetailsSectionProps {
  formData: FormData;
  onUpdateFormData: (field: string, value: any) => void;
}

export const EditRecipeDetailsSection: React.FC<EditRecipeDetailsSectionProps> =
  React.memo(({ formData, onUpdateFormData }) => {
    return (
      <>
        {/* General Details */}
        <OptimizedCollapsibleCard
          title="General Details"
          icon="edit"
          defaultCollapsed={false}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Recipe Title *</Text>
            <TextInput
              placeholder="Enter recipe title"
              value={formData.title}
              onChangeText={value => onUpdateFormData('title', value)}
              style={[
                styles.input,
                !formData.title.trim() && styles.inputRequired,
              ]}
              placeholderTextColor="#9ca3af"
              maxLength={100}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              placeholder="Describe your recipe (optional)"
              value={formData.description}
              onChangeText={value => onUpdateFormData('description', value)}
              style={styles.inputMulti}
              multiline
              numberOfLines={4}
              placeholderTextColor="#9ca3af"
              maxLength={500}
              textAlignVertical="top"
            />
          </View>
        </OptimizedCollapsibleCard>

        {/* Timings & Servings */}
        <OptimizedCollapsibleCard title="Timings & Servings" icon="clock">
          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={styles.inputLabel}>Prep Time</Text>
              <TextInput
                placeholder="Minutes"
                value={formData.prepTimeMinutes}
                onChangeText={value =>
                  onUpdateFormData('prepTimeMinutes', value)
                }
                style={styles.input}
                keyboardType="numeric"
                placeholderTextColor="#9ca3af"
                maxLength={4}
              />
            </View>

            <View style={styles.halfWidth}>
              <Text style={styles.inputLabel}>Cook Time</Text>
              <TextInput
                placeholder="Minutes"
                value={formData.cookTimeMinutes}
                onChangeText={value =>
                  onUpdateFormData('cookTimeMinutes', value)
                }
                style={styles.input}
                keyboardType="numeric"
                placeholderTextColor="#9ca3af"
                maxLength={4}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Servings</Text>
            <TextInput
              placeholder="Number of servings"
              value={formData.servings}
              onChangeText={value => onUpdateFormData('servings', value)}
              style={styles.input}
              keyboardType="numeric"
              placeholderTextColor="#9ca3af"
              maxLength={3}
            />
          </View>
        </OptimizedCollapsibleCard>
      </>
    );
  });

EditRecipeDetailsSection.displayName = 'EditRecipeDetailsSection';

const styles = StyleSheet.create({
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#111827',
  },
  inputRequired: {
    borderColor: '#f87171',
  },
  inputMulti: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#111827',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  halfWidth: {
    flex: 0.48,
  },
});

export default EditRecipeDetailsSection;
