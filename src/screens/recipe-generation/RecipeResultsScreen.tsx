import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { RecipeResultsScreenProps } from '../../navigation/types';
import { useRecipeSuggestions } from '../../hooks/useRecipeSuggestions';
import { useAccessControl } from '../../hooks/useAccessControl';
import { LimitReachedModal } from '../../components/modals/LimitReachedModal';

export default function RecipeResultsScreen({
  navigation,
  route,
}: RecipeResultsScreenProps) {
  const { selectedIngredients } = route.params;

  // Fetch recipe suggestions using our new hook
  const {
    data: suggestionsData,
    isLoading,
    error,
    refetch,
  } = useRecipeSuggestions(selectedIngredients);

  // Access control for AI recipe generation
  const { checkAIRecipeAvailability } = useAccessControl();
  
  // State for AI recipe availability and limit modal
  const [aiAvailability, setAiAvailability] = useState<{
    canGenerate: boolean;
    isLimitReached: boolean;
    usage: any;
    reason: string | null;
  } | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);

  // Check AI recipe availability when component mounts
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const availability = await checkAIRecipeAvailability();
        setAiAvailability(availability);
        console.log('[RecipeResultsScreen] AI availability check result:', availability);
      } catch (error) {
        console.error('[RecipeResultsScreen] Error checking AI availability:', error);
        // On error, assume available (backend will handle)
        setAiAvailability({
          canGenerate: true,
          isLimitReached: false,
          usage: null,
          reason: null,
        });
      }
    };

    checkAvailability();
  }, [checkAIRecipeAvailability]);

  const handleGoBack = () => {
    navigation.goBack();
  };

  const handleRetry = () => {
    refetch();
  };

  const handleRecipePress = (recipeId: string) => {
    navigation.navigate('RecipeDetail', { id: recipeId });
  };

  const handleAIGeneration = () => {
    // Check if user has reached their limit
    if (aiAvailability?.isLimitReached) {
      console.log('[RecipeResultsScreen] AI recipe limit reached - showing limit modal');
      setShowLimitModal(true);
      return;
    }

    // Navigate to AI Generation screen
    navigation.navigate('AIRecipeGeneration', {
      selectedIngredients,
    });
  };

  const handleUpgradeSuccess = () => {
    console.log('[RecipeResultsScreen] Upgrade successful - refreshing availability');
    // Refresh AI availability after upgrade
    const checkAvailability = async () => {
      try {
        const availability = await checkAIRecipeAvailability();
        setAiAvailability(availability);
      } catch (error) {
        console.error('[RecipeResultsScreen] Error refreshing availability:', error);
      }
    };
    checkAvailability();
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Finding Recipes...</Text>
          </View>
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10b981" />
          <Text style={styles.loadingText}>
            Searching recipes with your {selectedIngredients.length}{' '}
            ingredients...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Recipe Results</Text>
          </View>
        </View>

        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color="#ef4444" />
          <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
          <Text style={styles.errorMessage}>
            {error.message || 'Failed to load recipe suggestions'}
          </Text>
          <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Success state with data
  const { recipe_matches, total_matches, ai_generation_available } =
    suggestionsData || {};

  // DEBUGGING: Log the total_matches value being used
  console.log('[RecipeResultsScreen] 🔍 TOTAL MATCHES DEBUG:', {
    total_matches,
    recipe_matches_length: recipe_matches?.length || 0,
    suggestionsData_keys: Object.keys(suggestionsData || {}),
    full_suggestionsData: suggestionsData,
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Recipe Results</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Database Matches Section */}
        {recipe_matches && recipe_matches.length > 0 ? (
          <View style={styles.matchesSection}>
            <Text style={styles.sectionTitle}>Perfect Matches for You</Text>
            <Text style={styles.sectionSubtitle}>
              {selectedIngredients.length} ingredients • {total_matches || recipe_matches?.length || 0} matches found
            </Text>

            {recipe_matches.map(recipe => (
              <TouchableOpacity
                key={recipe.id}
                style={styles.recipeCard}
                onPress={() => handleRecipePress(recipe.id)}
                activeOpacity={0.7}>
                {/* Recipe Thumbnail */}
                <View style={styles.thumbnailContainer}>
                  {recipe.image_url ? (
                    <Image
                      source={{ uri: recipe.image_url }}
                      style={styles.thumbnail}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.placeholderThumbnail}>
                      <Feather name="image" size={24} color="#9ca3af" />
                    </View>
                  )}

                  {/* Match Badge Overlay */}
                  <View
                    style={[
                      styles.matchBadgeOverlay,
                      {
                        backgroundColor: getMatchColor(recipe.match_percentage),
                      },
                    ]}>
                    <Text style={styles.matchBadgeText}>
                      {Math.round(recipe.match_percentage)}%
                    </Text>
                  </View>
                </View>

                {/* Recipe Content */}
                <View style={styles.recipeContent}>
                  <View style={styles.recipeHeader}>
                    <Text style={styles.recipeTitle} numberOfLines={2}>
                      {recipe.title}
                    </Text>
                    <View style={styles.recipeMetrics}>
                      <View style={styles.metricItem}>
                        <Feather name="clock" size={14} color="#6b7280" />
                        <Text style={styles.metricText}>
                          {recipe.cook_time}min
                        </Text>
                      </View>
                      <View style={styles.metricItem}>
                        <Feather name="trending-up" size={14} color="#6b7280" />
                        <Text style={styles.metricText}>
                          {recipe.difficulty}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Creator Info */}
                  <View style={styles.creatorInfo}>
                    <Feather name="user" size={14} color="#6b7280" />
                    <Text style={styles.creatorName}>
                      by {recipe.creator_name}
                    </Text>
                  </View>

                  {/* Missing Ingredients */}
                  {recipe.missing_ingredients.length > 0 && (
                    <View style={styles.missingSection}>
                      <Text style={styles.missingLabel}>Missing:</Text>
                      <Text style={styles.missingText} numberOfLines={1}>
                        {recipe.missing_ingredients.slice(0, 3).join(', ')}
                        {recipe.missing_ingredients.length > 3 &&
                          ` +${recipe.missing_ingredients.length - 3} more`}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Action Arrow */}
                <View style={styles.actionArrow}>
                  <Feather name="chevron-right" size={20} color="#9ca3af" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          // No matches found
          <View style={styles.matchesSection}>
            <Text style={styles.sectionTitle}>Perfect Matches for You</Text>
            <Text style={styles.sectionSubtitle}>
              {selectedIngredients.length} ingredients • {total_matches || recipe_matches?.length || 0} matches found
            </Text>
            <View style={styles.noMatchesContainer}>
              <View style={styles.noMatchesIcon}>
                <Feather name="search" size={48} color="#9ca3af" />
              </View>
              <Text style={styles.noMatchesTitle}>No Perfect Matches</Text>
              <Text style={styles.noMatchesMessage}>
                We couldn't find recipes that match your ingredients perfectly.
                Try our AI chef to create something custom!
              </Text>
            </View>
          </View>
        )}

        {/* AI Generation Section - Always show for all users, let limit logic handle the UI */}
        <View style={styles.aiSection}>
          <View style={styles.aiHeader}>
            <View style={styles.aiIconContainer}>
              <Feather name="zap" size={24} color="#10b981" />
            </View>
            <View style={styles.aiTextContainer}>
              <Text style={styles.aiTitle}>Create Something New</Text>
              <Text style={styles.aiSubtitle}>
                Let our AI chef create a custom recipe with your ingredients
              </Text>
              
              {/* Show usage info for FREEMIUM users */}
              {aiAvailability?.usage && (
                <Text style={styles.usageInfo}>
                  {aiAvailability.usage.remaining} of {aiAvailability.usage.limit} AI recipes remaining this month
                </Text>
              )}
            </View>
          </View>
          
          {/* Dynamic button based on availability */}
          {aiAvailability?.isLimitReached ? (
            // Limit reached - show upgrade CTA
            <View style={styles.limitReachedContainer}>
              <TouchableOpacity
                onPress={handleAIGeneration}
                style={styles.upgradeButton}>
                <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
                <Feather name="star" size={16} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.limitReachedText}>
                You've reached your monthly AI recipe limit. Upgrade for unlimited access!
              </Text>
            </View>
          ) : (
            // Can generate - show normal button
            <TouchableOpacity
              onPress={handleAIGeneration}
              style={[
                styles.aiButton,
                aiAvailability?.canGenerate === false && styles.disabledButton
              ]}
              disabled={aiAvailability?.canGenerate === false}>
              <Text style={[
                styles.aiButtonText,
                aiAvailability?.canGenerate === false && styles.disabledButtonText
              ]}>
                {aiAvailability?.canGenerate === false ? 'Checking Availability...' : 'Generate AI Recipe'}
              </Text>
              {aiAvailability?.canGenerate !== false && (
                <Feather name="arrow-right" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Limit Reached Modal */}
      <LimitReachedModal
        visible={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        limitType="ai_recipe"
        onUpgradeSuccess={handleUpgradeSuccess}
        usageData={aiAvailability?.usage}
      />
    </SafeAreaView>
  );
}

// Helper function to get match percentage color
const getMatchColor = (percentage: number) => {
  if (percentage >= 80) return '#10b981'; // Green
  if (percentage >= 60) return '#f59e0b'; // Orange
  return '#ef4444'; // Red
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
    borderRadius: 8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  errorMessage: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 24,
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  matchesSection: {
    marginTop: 24,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 20,
  },
  recipeCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  thumbnailContainer: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholderThumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchBadgeOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  matchBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  recipeContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  recipeHeader: {
    marginBottom: 8,
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
    lineHeight: 22,
  },
  recipeMetrics: {
    flexDirection: 'row',
    gap: 12,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  creatorName: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  missingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  missingLabel: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
  },
  missingText: {
    fontSize: 12,
    color: '#92400e',
    flex: 1,
  },
  actionArrow: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  noMatchesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  noMatchesIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  noMatchesTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  noMatchesMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  aiSection: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    marginBottom: 32,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#dcfce7',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  aiIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  aiTextContainer: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  aiSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  aiButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  usageInfo: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontWeight: '500',
  },
  limitReachedContainer: {
    alignItems: 'center',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  limitReachedText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#d1d5db',
  },
});
