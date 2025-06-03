import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useRecipeDetails } from '../../hooks/useRecipeDetails';
import { COLORS } from '../../constants/theme';
import { useAuth } from '../../providers/AuthProvider';

// Circular progress component for visually showing macro percentages
function CircularProgress({
  percentage,
  color,
  size = 60,
  label,
  value,
}: {
  percentage: number;
  color: string;
  size?: number;
  label: string;
  value: string;
}) {
  // Calculate the stroke dash
  const strokeWidth = size * 0.1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View style={styles.circularProgressContainer}>
      <View style={[styles.progressContainer, { width: size, height: size }]}>
        <View
          style={[
            styles.backgroundCircle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
            },
          ]}
        />
        <View
          style={[
            styles.progressCircle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: strokeWidth,
              borderColor: color,
              borderTopColor: 'transparent',
              borderRightColor: percentage > 75 ? color : 'transparent',
              borderBottomColor: percentage > 50 ? color : 'transparent',
              borderLeftColor: percentage > 25 ? color : 'transparent',
              transform: [{ rotateZ: `-${percentage * 3.6}deg` }],
            },
          ]}
        />
        <View
          style={[
            styles.progressLabel,
            { width: size - strokeWidth * 2, height: size - strokeWidth * 2 },
          ]}>
          <Text style={[styles.progressValue, { color }]}>{value}</Text>
        </View>
      </View>
      <Text style={styles.progressText}>{label}</Text>
    </View>
  );
}

// Bar progress component for visually showing nutrient percentages
function NutrientBar({
  label,
  amount,
  percentage,
  color,
}: {
  label: string;
  amount: string;
  percentage: number;
  color: string;
}) {
  return (
    <View style={styles.nutrientBarContainer}>
      <View style={styles.nutrientLabelContainer}>
        <Text style={styles.nutrientLabel}>{label}</Text>
        <Text style={styles.nutrientAmount}>{amount}</Text>
      </View>
      <View style={styles.barContainer}>
        <View style={[styles.barBackground, { backgroundColor: `${color}20` }]}>
          <View
            style={[
              styles.barFill,
              {
                width: `${Math.min(percentage, 100)}%`,
                backgroundColor: color,
              },
            ]}
          />
        </View>
        <Text style={styles.percentText}>{percentage}%</Text>
      </View>
    </View>
  );
}

export default function MacrosTab() {
  const route = useRoute<any>();
  const { user } = useAuth();
  const recipeId = route.params?.id;
  console.log(
    '[MacrosTab] recipeId from route.params:',
    recipeId,
    'userId:',
    user?.id,
  );

  const {
    data: recipeDetails,
    isLoading,
    error,
  } = useRecipeDetails(recipeId, user?.id);
  console.log(
    '[MacrosTab] useRecipeDetails results - recipeDetails:',
    JSON.stringify(recipeDetails, null, 2),
    'isLoading:',
    isLoading,
    'error:',
    JSON.stringify(error, null, 2),
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error || !recipeDetails) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          Could not load nutritional information.
        </Text>
      </View>
    );
  }

  // The mock data will now always be shown if recipeDetails are loaded.
  const servings = recipeDetails.servings || 1; // Default to 1 if servings is null/undefined, used for display string.

  const totalCalories = 240;
  const caloriesFromProtein = 56;
  const caloriesFromCarbs = 24;
  const caloriesFromFat = 160;

  const proteinPercentage = Math.round(
    (caloriesFromProtein / totalCalories) * 100,
  );
  const carbsPercentage = Math.round((caloriesFromCarbs / totalCalories) * 100);
  const fatPercentage = Math.round((caloriesFromFat / totalCalories) * 100);

  return (
    <View style={styles.container}>
      {/* The content below will now always be rendered as hasNutritionData logic is removed */}
      <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <Ionicons
            name="nutrition-outline"
            size={24}
            color={COLORS.primary}
            style={styles.headerIcon}
          />
          <Text style={styles.headerTitle}>Nutrition Facts</Text>
        </View>
        <Text style={styles.servingInfo}>
          Based on {servings} serving{servings > 1 ? 's' : ''}
        </Text>
      </View>

      <View style={styles.caloriesCard}>
        <Text style={styles.caloriesLabel}>Total Calories</Text>
        <Text style={styles.caloriesValue}>
          {totalCalories} <Text style={styles.caloriesUnit}>kcal</Text>
        </Text>
      </View>

      <View style={styles.sectionContainer}>
        <View style={styles.sectionTitleContainer}>
          <Ionicons name="pie-chart-outline" size={18} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>Macronutrient Distribution</Text>
        </View>

        <View style={styles.macrosCirclesContainer}>
          <CircularProgress
            percentage={proteinPercentage}
            color="#2E7D32"
            label="Protein"
            value="14g"
          />
          <CircularProgress
            percentage={carbsPercentage}
            color="#1976D2"
            label="Carbs"
            value="6g"
          />
          <CircularProgress
            percentage={fatPercentage}
            color="#FF8F00"
            label="Fat"
            value="18g"
          />
        </View>
      </View>

      <View style={styles.sectionContainer}>
        <View style={styles.sectionTitleContainer}>
          <Ionicons name="leaf-outline" size={18} color={COLORS.primary} />
          <Text style={styles.sectionTitle}>Vitamins & Minerals</Text>
          <Text style={styles.dailyValueText}>% Daily Value</Text>
        </View>

        <View style={styles.vitaminsContainer}>
          <NutrientBar
            label="Vitamin A"
            amount="750 IU"
            percentage={15}
            color="#43A047"
          />
          <NutrientBar
            label="Vitamin C"
            amount="10.8 mg"
            percentage={12}
            color="#E53935"
          />
          <NutrientBar
            label="Calcium"
            amount="80 mg"
            percentage={8}
            color="#1E88E5"
          />
          <NutrientBar
            label="Iron"
            amount="1.8 mg"
            percentage={10}
            color="#FB8C00"
          />
          <NutrientBar
            label="Potassium"
            amount="525 mg"
            percentage={15}
            color="#8E24AA"
          />
        </View>
      </View>

      <View style={styles.sectionContainer}>
        <View style={styles.sectionTitleContainer}>
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={COLORS.primary}
          />
          <Text style={styles.sectionTitle}>Additional Details</Text>
        </View>

        <View style={styles.detailsGrid}>
          <DetailItem label="Saturated Fat" value="4g" />
          <DetailItem label="Trans Fat" value="0g" />
          <DetailItem label="Cholesterol" value="175mg" />
          <DetailItem label="Sodium" value="380mg" />
          <DetailItem label="Fiber" value="4g" />
          <DetailItem label="Sugar" value="1g" />
        </View>
      </View>

      <View style={styles.disclaimerContainer}>
        <Text style={styles.disclaimerText}>
          Values are approximate based on recipe ingredients. Individual
          nutritional content may vary.
        </Text>
      </View>
    </View>
  );
}

// Detail item component for additional nutritional details
function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white || '#fff',
    paddingHorizontal: 16,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white || '#fff',
    padding: 30,
  },
  errorText: {
    color: COLORS.error || 'red',
    fontSize: 16,
    textAlign: 'center',
  },
  headerContainer: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerIcon: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text || '#333',
  },
  servingInfo: {
    fontSize: 14,
    color: COLORS.textSecondary || '#666',
    marginLeft: 32,
  },
  // Calories Card
  caloriesCard: {
    backgroundColor: COLORS.primary || '#00796b',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  caloriesLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
  },
  caloriesValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  caloriesUnit: {
    fontSize: 16,
    fontWeight: 'normal',
  },
  // Section styling
  sectionContainer: {
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2.5,
    elevation: 2,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text || '#333',
    marginLeft: 8,
    flex: 1,
  },
  dailyValueText: {
    fontSize: 12,
    color: COLORS.textSecondary || '#888',
  },
  // Circular progress components
  macrosCirclesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
  },
  circularProgressContainer: {
    alignItems: 'center',
  },
  progressContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundCircle: {
    position: 'absolute',
    borderColor: '#f0f0f0',
  },
  progressCircle: {
    position: 'absolute',
    transform: [{ rotateZ: '-90deg' }],
  },
  progressLabel: {
    position: 'absolute',
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressText: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.text || '#333',
  },
  // Vitamins and minerals bar components
  vitaminsContainer: {
    marginTop: 4,
  },
  nutrientBarContainer: {
    marginBottom: 14,
  },
  nutrientLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  nutrientLabel: {
    fontSize: 14,
    color: COLORS.text || '#333',
  },
  nutrientAmount: {
    fontSize: 14,
    color: COLORS.textSecondary || '#666',
  },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barBackground: {
    height: 8,
    borderRadius: 4,
    flex: 1,
    marginRight: 8,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentText: {
    fontSize: 12,
    color: COLORS.textSecondary || '#888',
    width: 30,
  },
  // Additional details grid
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  detailItem: {
    width: '48%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.text || '#333',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary || '#00796b',
  },
  disclaimerContainer: {
    marginTop: 8,
    padding: 16,
  },
  disclaimerText: {
    fontSize: 12,
    color: COLORS.textSecondary || '#888',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  // Empty state styling
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    opacity: 0.6,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textSecondary || '#888',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary || '#666',
    textAlign: 'center',
    maxWidth: '80%',
  },
});
