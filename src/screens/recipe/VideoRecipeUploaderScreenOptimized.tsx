import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  Suspense,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  Dimensions,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Feather } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { v4 as uuidv4 } from 'uuid';
import 'react-native-get-random-values';
import { useQueryClient } from '@tanstack/react-query';

// Optimized imports
import {
  useVideoUploader,
  RecipeMetadataForEdgeFunction,
  Ingredient,
} from '../../hooks/useVideoUploader';
import { MainStackParamList } from '../../navigation/types';
import { useAuth } from '../../providers/AuthProvider';
import {
  useScreenLoadTracking,
  useApiPerformanceTracking,
} from '../../hooks/usePerformanceMonitoring';

// Lazy-loaded components for better performance
const OptimizedCollapsibleCard = React.lazy(() =>
  import('./components/OptimizedCollapsibleCard').then(module => ({
    default: module.OptimizedCollapsibleCard,
  })),
);
const MediaSelectionSection = React.lazy(() =>
  import('./components/MediaSelectionSection').then(module => ({
    default: module.MediaSelectionSection,
  })),
);
const RecipeDetailsSection = React.lazy(() =>
  import('./components/RecipeDetailsSection').then(module => ({
    default: module.RecipeDetailsSection,
  })),
);
const IngredientsSection = React.lazy(() =>
  import('./components/IngredientsSection').then(module => ({
    default: module.IngredientsSection,
  })),
);
const PreparationStepsSection = React.lazy(() =>
  import('./components/PreparationStepsSection').then(module => ({
    default: module.PreparationStepsSection,
  })),
);

// Constants
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BRAND_PRIMARY = '#10B981';
const BRAND_PRIMARY_LIGHT = '#22c55e';
const ACCENT_COLOR = '#FF9500';

const DIET_TAGS_OPTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Keto',
  'Paleo',
  'Low-Carb',
  'High-Protein',
];

// Types
type VideoRecipeUploaderScreenProps = NativeStackScreenProps<
  MainStackParamList,
  'VideoRecipeUploader'
>;

// Optimized Form State Hook
const useOptimizedFormState = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    prepTimeMinutes: '',
    cookTimeMinutes: '',
    servings: '',
    isPublic: true,
  });

  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { name: '', quantity: '', unit: '' },
  ]);

  const [preparationSteps, setPreparationSteps] = useState<string[]>(['']);
  const [dietTags, setDietTags] = useState<string[]>([]);

  const updateFormData = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      title: '',
      description: '',
      prepTimeMinutes: '',
      cookTimeMinutes: '',
      servings: '',
      isPublic: true,
    });
    setIngredients([{ name: '', quantity: '', unit: '' }]);
    setPreparationSteps(['']);
    setDietTags([]);
  }, []);

  return {
    formData,
    ingredients,
    preparationSteps,
    dietTags,
    updateFormData,
    setIngredients,
    setPreparationSteps,
    setDietTags,
    resetForm,
  };
};

// Optimized Header Component
const OptimizedHeader = React.memo(() => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <Animated.View
      style={[
        styles.headerContainer,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}>
      <Text style={styles.screenTitle}>Create New Recipe</Text>
      <Text style={styles.screenSubtitle}>
        Share your culinary masterpiece with the world
      </Text>
    </Animated.View>
  );
});
OptimizedHeader.displayName = 'OptimizedHeader';

// Optimized Diet Tags Component
const OptimizedDietTags = React.memo<{
  dietTags: string[];
  onTagToggle: (tag: string) => void;
}>(({ dietTags, onTagToggle }) => {
  const memoizedTags = useMemo(
    () =>
      DIET_TAGS_OPTIONS.map(tag => ({
        tag,
        isSelected: dietTags.includes(tag),
      })),
    [dietTags],
  );

  return (
    <Suspense fallback={<ActivityIndicator size="small" />}>
      <OptimizedCollapsibleCard title="Dietary Tags" icon="tag">
        <Text style={styles.tagSectionLabel}>
          Help others discover your recipe with relevant tags
        </Text>
        <View style={styles.tagsContainer}>
          {memoizedTags.map(({ tag, isSelected }) => (
            <TouchableOpacity
              key={tag}
              style={[styles.tag, isSelected && styles.tagSelected]}
              onPress={() => onTagToggle(tag)}
              activeOpacity={0.7}>
              {isSelected && (
                <Feather
                  name="check"
                  size={12}
                  color="#fff"
                  style={{ marginRight: 4 }}
                />
              )}
              <Text
                style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                {tag}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </OptimizedCollapsibleCard>
    </Suspense>
  );
});
OptimizedDietTags.displayName = 'OptimizedDietTags';

// Optimized Visibility Component
const OptimizedVisibility = React.memo<{
  isPublic: boolean;
  onToggle: (value: boolean) => void;
}>(({ isPublic, onToggle }) => (
  <Suspense fallback={<ActivityIndicator size="small" />}>
    <OptimizedCollapsibleCard title="Visibility" icon="eye">
      <View style={styles.visibilityContainer}>
        <View>
          <Text style={styles.visibilityTitle}>Make Recipe Public</Text>
          <Text style={styles.visibilitySubtitle}>
            {isPublic
              ? 'Your recipe will be discoverable by all users'
              : 'Only you will be able to see this recipe'}
          </Text>
        </View>
        <Switch
          value={isPublic}
          onValueChange={onToggle}
          trackColor={{ false: '#e0e0e0', true: '#a7f3d0' }}
          thumbColor={isPublic ? BRAND_PRIMARY : '#f4f3f4'}
          ios_backgroundColor="#e0e0e0"
        />
      </View>
    </OptimizedCollapsibleCard>
  </Suspense>
));
OptimizedVisibility.displayName = 'OptimizedVisibility';

// Optimized Publish Button Component
const OptimizedPublishButton = React.memo<{
  isUploading: boolean;
  uploadProgress: number;
  onPublish: () => void;
}>(({ isUploading, uploadProgress, onPublish }) => (
  <>
    <TouchableOpacity
      style={[styles.publishButton, isUploading && styles.saveButtonDisabled]}
      onPress={onPublish}
      disabled={isUploading}
      activeOpacity={0.8}>
      {isUploading ? (
        <View style={styles.publishButtonContentLoading}>
          <ActivityIndicator
            color="#fff"
            size="small"
            style={{ marginRight: 10 }}
          />
          <Text style={styles.publishButtonText}>Uploading...</Text>
        </View>
      ) : (
        <View style={styles.publishButtonContent}>
          <Feather
            name="upload-cloud"
            size={20}
            color="#fff"
            style={{ marginRight: 10 }}
          />
          <Text style={styles.publishButtonText}>Publish Recipe</Text>
        </View>
      )}
    </TouchableOpacity>

    {isUploading && uploadProgress > 0 && (
      <View style={styles.progressBarContainer}>
        <View
          style={[styles.progressBar, { width: `${uploadProgress * 100}%` }]}
        />
        <Text style={styles.progressText}>
          {`${(uploadProgress * 100).toFixed(0)}%`}
        </Text>
      </View>
    )}
  </>
));
OptimizedPublishButton.displayName = 'OptimizedPublishButton';

// Main VideoRecipeUploaderScreen component
export const VideoRecipeUploaderScreenOptimized: React.FC<
  VideoRecipeUploaderScreenProps
> = ({ navigation: navPropFromProps }) => {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<MainStackParamList, 'VideoRecipeUploader'>
    >();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Performance tracking
  useScreenLoadTracking('VideoRecipeUploaderScreen');
  const { startApiCall, endApiCall } = useApiPerformanceTracking();

  // Optimized form state
  const {
    formData,
    ingredients,
    preparationSteps,
    dietTags,
    updateFormData,
    setIngredients,
    setPreparationSteps,
    setDietTags,
    resetForm,
  } = useOptimizedFormState();

  // Optimized upload handlers
  const onUploadSuccessHandler = useCallback(
    (response: any) => {
      const recipeId = response?.recipeId;
      Alert.alert('Success', 'Recipe uploaded successfully!');

      if (user?.id) {
        queryClient.invalidateQueries({
          queryKey: ['userRecipesForPlanner', user.id],
        });
        queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      }

      resetForm();
      if (navigation.canGoBack()) navigation.goBack();
    },
    [user?.id, queryClient, resetForm, navigation],
  );

  const onUploadErrorHandler = useCallback((errorDetails: any | string) => {
    console.error('onUploadErrorHandler received:', errorDetails);
    let errorMessage = 'An unexpected error occurred during upload.';
    if (typeof errorDetails === 'string') {
      errorMessage = errorDetails;
    } else if (errorDetails && errorDetails.message) {
      errorMessage = errorDetails.message;
    }
    Alert.alert('Upload Error', errorMessage);
  }, []);

  // Optimized video uploader hook
  const {
    uploadRecipe,
    isUploading,
    selectVideo,
    selectThumbnail,
    videoUri,
    thumbnailUri,
    uploadProgress,
  } = useVideoUploader({
    onUploadSuccess: onUploadSuccessHandler,
    onUploadError: onUploadErrorHandler,
  });

  // Memoized handlers
  const handleSelectVideo = useCallback(() => {
    const callId = `video_select_${Date.now()}`;
    startApiCall(callId);
    selectVideo().finally(() => endApiCall(callId, 'video_select'));
  }, [selectVideo, startApiCall, endApiCall]);

  const handleSelectThumbnail = useCallback(() => {
    const callId = `thumbnail_select_${Date.now()}`;
    startApiCall(callId);
    selectThumbnail().finally(() => endApiCall(callId, 'thumbnail_select'));
  }, [selectThumbnail, startApiCall, endApiCall]);

  const handleTagToggle = useCallback(
    (tag: string) => {
      setDietTags(prev =>
        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
      );
    },
    [setDietTags],
  );

  const handleIngredientChange = useCallback(
    (index: number, field: keyof Ingredient, value: string) => {
      setIngredients(prev => {
        const newIngredients = [...prev];
        newIngredients[index] = { ...newIngredients[index], [field]: value };
        return newIngredients;
      });
    },
    [setIngredients],
  );

  const handleAddIngredient = useCallback(() => {
    setIngredients(prev => [...prev, { name: '', quantity: '', unit: '' }]);
  }, [setIngredients]);

  const handleRemoveIngredient = useCallback(
    (indexToRemove: number) => {
      setIngredients(prev => {
        if (prev.length === 1) {
          return [{ name: '', quantity: '', unit: '' }];
        }
        return prev.filter((_, index) => index !== indexToRemove);
      });
    },
    [setIngredients],
  );

  const handleStepChange = useCallback(
    (index: number, value: string) => {
      setPreparationSteps(prev => {
        const newSteps = [...prev];
        newSteps[index] = value;
        return newSteps;
      });
    },
    [setPreparationSteps],
  );

  const handleAddStep = useCallback(() => {
    setPreparationSteps(prev => [...prev, '']);
  }, [setPreparationSteps]);

  const handleRemoveStep = useCallback(
    (indexToRemove: number) => {
      setPreparationSteps(prev => {
        if (prev.length === 1) {
          return [''];
        }
        return prev.filter((_, index) => index !== indexToRemove);
      });
    },
    [setPreparationSteps],
  );

  // Optimized validation
  const validateForm = useCallback(() => {
    if (!videoUri) {
      Alert.alert('Validation Error', 'Please select a video.');
      return false;
    }
    if (!thumbnailUri) {
      Alert.alert('Validation Error', 'Please select a thumbnail.');
      return false;
    }
    if (!formData.title.trim()) {
      Alert.alert('Validation Error', 'Please enter a recipe title.');
      return false;
    }
    if (
      !formData.prepTimeMinutes.trim() ||
      !formData.cookTimeMinutes.trim() ||
      !formData.servings.trim()
    ) {
      Alert.alert(
        'Validation Error',
        'Please fill in Prep Time, Cook Time, and Servings.',
      );
      return false;
    }
    if (
      isNaN(parseInt(formData.prepTimeMinutes)) ||
      isNaN(parseInt(formData.cookTimeMinutes)) ||
      isNaN(parseInt(formData.servings))
    ) {
      Alert.alert(
        'Validation Error',
        'Prep Time, Cook Time, and Servings must be valid numbers.',
      );
      return false;
    }
    if (
      ingredients.length === 0 ||
      ingredients.every(ing => !ing.name.trim())
    ) {
      Alert.alert(
        'Validation Error',
        'Please add at least one valid ingredient (name is required).',
      );
      return false;
    }
    if (
      preparationSteps.length === 0 ||
      preparationSteps.every(step => !step.trim())
    ) {
      Alert.alert(
        'Validation Error',
        'Please add at least one preparation step.',
      );
      return false;
    }
    return true;
  }, [videoUri, thumbnailUri, formData, ingredients, preparationSteps]);

  const handlePublish = useCallback(async () => {
    if (!validateForm()) return;

    let recipeId;
    try {
      recipeId = uuidv4();
    } catch (e: any) {
      Alert.alert(
        'Error',
        `Could not generate a unique ID for the recipe: ${e.message || 'Unknown error'}`,
      );
      return;
    }

    const metadata: RecipeMetadataForEdgeFunction = {
      id: recipeId,
      title: formData.title.trim(),
      description: formData.description.trim(),
      ingredients: ingredients.filter(ing => ing.name.trim() !== ''),
      diet_tags: dietTags,
      is_public: formData.isPublic,
      preparation_steps: preparationSteps.filter(step => step.trim() !== ''),
      prep_time_minutes: parseInt(formData.prepTimeMinutes) || 0,
      cook_time_minutes: parseInt(formData.cookTimeMinutes) || 0,
      servings: parseInt(formData.servings) || 0,
    };

    const callId = `recipe_upload_${Date.now()}`;
    startApiCall(callId);
    uploadRecipe(metadata).finally(() => endApiCall(callId, 'recipe_upload'));
  }, [
    validateForm,
    formData,
    ingredients,
    dietTags,
    preparationSteps,
    uploadRecipe,
    startApiCall,
    endApiCall,
  ]);

  // Memoized counts for performance
  const ingredientCount = useMemo(
    () => ingredients.filter(i => i.name.trim()).length,
    [ingredients],
  );

  const stepCount = useMemo(
    () => preparationSteps.filter(s => s.trim()).length,
    [preparationSteps],
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContentContainer}
      showsVerticalScrollIndicator={false}>
      <OptimizedHeader />

      {/* Media Selection Section */}
      <Suspense
        fallback={<ActivityIndicator size="large" style={{ margin: 20 }} />}>
        <MediaSelectionSection
          videoUri={videoUri || undefined}
          thumbnailUri={thumbnailUri || undefined}
          onSelectVideo={handleSelectVideo}
          onSelectThumbnail={handleSelectThumbnail}
        />
      </Suspense>

      {/* Form Container */}
      <View style={styles.formContainer}>
        {/* Recipe Details Section */}
        <Suspense fallback={<ActivityIndicator size="small" />}>
          <RecipeDetailsSection
            formData={formData}
            onUpdateFormData={updateFormData}
          />
        </Suspense>

        {/* Ingredients Section */}
        <Suspense fallback={<ActivityIndicator size="small" />}>
          <IngredientsSection
            ingredients={ingredients}
            ingredientCount={ingredientCount}
            onIngredientChange={handleIngredientChange}
            onAddIngredient={handleAddIngredient}
            onRemoveIngredient={handleRemoveIngredient}
          />
        </Suspense>

        {/* Preparation Steps Section */}
        <Suspense fallback={<ActivityIndicator size="small" />}>
          <PreparationStepsSection
            preparationSteps={preparationSteps}
            stepCount={stepCount}
            onStepChange={handleStepChange}
            onAddStep={handleAddStep}
            onRemoveStep={handleRemoveStep}
          />
        </Suspense>

        {/* Diet Tags Section */}
        <OptimizedDietTags dietTags={dietTags} onTagToggle={handleTagToggle} />

        {/* Visibility Section */}
        <OptimizedVisibility
          isPublic={formData.isPublic}
          onToggle={value => updateFormData('isPublic', value)}
        />
      </View>

      {/* Publish Button */}
      <OptimizedPublishButton
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        onPublish={handlePublish}
      />
    </ScrollView>
  );
};

// Enhanced styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContentContainer: {
    paddingBottom: 100,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111827',
    marginBottom: 8,
  },
  screenSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '400',
  },
  formContainer: {
    paddingHorizontal: 12,
  },
  tagSectionLabel: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  tagSelected: {
    backgroundColor: BRAND_PRIMARY,
    borderColor: BRAND_PRIMARY,
  },
  tagText: {
    color: '#6b7280',
    fontSize: 14,
  },
  tagTextSelected: {
    color: '#fff',
  },
  visibilityContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  visibilityTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  visibilitySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    maxWidth: 250,
  },
  publishButton: {
    backgroundColor: BRAND_PRIMARY,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  publishButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishButtonContentLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
  },
  progressBarContainer: {
    marginHorizontal: 16,
    marginVertical: 16,
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: BRAND_PRIMARY,
    borderRadius: 3,
  },
  progressText: {
    position: 'absolute',
    alignSelf: 'center',
    top: 8,
    fontSize: 12,
    fontWeight: '500',
  },
});

VideoRecipeUploaderScreenOptimized.displayName =
  'VideoRecipeUploaderScreenOptimized';

export default VideoRecipeUploaderScreenOptimized;
