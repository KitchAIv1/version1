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
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';

// Optimized imports
import { supabase } from '../../services/supabase';
import {
  useEditableRecipeDetails,
  RecipeEditableData,
  Ingredient,
} from '../../hooks/useEditableRecipeDetails';
import { useAuth } from '../../providers/AuthProvider';
import { MainStackParamList } from '../../navigation/types';
import { compressImageWithPreset } from '../../utils/imageCompression';
import { useSafeRecipeEdit } from '../../hooks/useSafeRecipeEdit';
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
const EditRecipeDetailsSection = React.lazy(() =>
  import('./components/EditRecipeDetailsSection').then(module => ({
    default: module.EditRecipeDetailsSection,
  })),
);
const EditIngredientsSection = React.lazy(() =>
  import('./components/EditIngredientsSection').then(module => ({
    default: module.EditIngredientsSection,
  })),
);
const EditPreparationStepsSection = React.lazy(() =>
  import('./components/EditPreparationStepsSection').then(module => ({
    default: module.EditPreparationStepsSection,
  })),
);
const EditThumbnailSection = React.lazy(() =>
  import('./components/EditThumbnailSection').then(module => ({
    default: module.EditThumbnailSection,
  })),
);

// Constants
const BRAND_PRIMARY = '#10B981';

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
type EditRecipeScreenProps = NativeStackScreenProps<
  MainStackParamList,
  'EditRecipe'
>;

// Optimized Form State Hook
const useOptimizedEditFormState = (initialData?: RecipeEditableData) => {
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
  const [currentThumbnailUrl, setCurrentThumbnailUrl] = useState<string | null>(
    null,
  );
  const [newLocalThumbnailUri, setNewLocalThumbnailUri] = useState<
    string | null
  >(null);
  const [compressionInfo, setCompressionInfo] = useState<string>('');

  const updateFormData = useCallback((field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const populateFromInitialData = useCallback((data: RecipeEditableData) => {
    setFormData({
      title: data.title || '',
      description: data.description || '',
      prepTimeMinutes: data.prep_time_minutes?.toString() || '',
      cookTimeMinutes: data.cook_time_minutes?.toString() || '',
      servings: data.servings?.toString() || '',
      isPublic: data.is_public,
    });
    setPreparationSteps(
      data.preparation_steps.length > 0 ? data.preparation_steps : [''],
    );
    setDietTags(data.diet_tags || []);
    setCurrentThumbnailUrl(data.thumbnail_url);
    setNewLocalThumbnailUri(null);
  }, []);

  return {
    formData,
    ingredients,
    preparationSteps,
    dietTags,
    currentThumbnailUrl,
    newLocalThumbnailUri,
    compressionInfo,
    updateFormData,
    setIngredients,
    setPreparationSteps,
    setDietTags,
    setCurrentThumbnailUrl,
    setNewLocalThumbnailUri,
    setCompressionInfo,
    populateFromInitialData,
  };
};

// Optimized Header Component
const OptimizedHeader = React.memo<{ title: string }>(({ title }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View style={[styles.headerContainer, { opacity: fadeAnim }]}>
      <Text style={styles.screenTitle}>Edit Recipe</Text>
      {title && (
        <Text
          style={styles.screenSubtitle}
          numberOfLines={1}
          ellipsizeMode="tail">
          {title}
        </Text>
      )}
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

// Optimized Save Button Component
const OptimizedSaveButton = React.memo<{
  isUpdating: boolean;
  uploadProgress: number;
  onSave: () => void;
}>(({ isUpdating, uploadProgress, onSave }) => (
  <>
    <TouchableOpacity
      style={[styles.saveButton, isUpdating && styles.saveButtonDisabled]}
      onPress={onSave}
      disabled={isUpdating}
      activeOpacity={0.8}>
      {isUpdating ? (
        <View style={styles.saveButtonContentLoading}>
          <ActivityIndicator
            color="#fff"
            size="small"
            style={{ marginRight: 10 }}
          />
          <Text style={styles.saveButtonText}>Saving...</Text>
        </View>
      ) : (
        <View style={styles.saveButtonContent}>
          <Feather
            name="save"
            size={20}
            color="#fff"
            style={{ marginRight: 10 }}
          />
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </View>
      )}
    </TouchableOpacity>

    {isUpdating && uploadProgress > 0 && uploadProgress < 1 && (
      <View style={styles.progressBarContainer}>
        <View
          style={[styles.progressBar, { width: `${uploadProgress * 100}%` }]}
        />
        <Text style={styles.progressText}>
          {`Saving... ${(uploadProgress * 100).toFixed(0)}%`}
        </Text>
      </View>
    )}
  </>
));
OptimizedSaveButton.displayName = 'OptimizedSaveButton';

// Main EditRecipeScreen component
export const EditRecipeScreenOptimized: React.FC<EditRecipeScreenProps> = ({
  route,
  navigation,
}) => {
  const { recipeId } = route.params;
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Performance tracking
  useScreenLoadTracking('EditRecipeScreen');
  const { startApiCall, endApiCall } = useApiPerformanceTracking();

  // Data hooks
  const {
    data: initialRecipeData,
    isLoading: isLoadingDetails,
    isError: isErrorDetails,
    error: errorDetails,
  } = useEditableRecipeDetails(recipeId);

  const {
    parsedIngredients,
    updateIngredients,
    addIngredient: addParsedIngredient,
    removeIngredient: removeParsedIngredient,
    getIngredientsForSave,
    clearCachesAfterSave,
    isLoading: isLoadingParsedIngredients,
    ensureIngredientSync,
  } = useSafeRecipeEdit(recipeId, user?.id);

  // Optimized form state
  const {
    formData,
    ingredients,
    preparationSteps,
    dietTags,
    currentThumbnailUrl,
    newLocalThumbnailUri,
    compressionInfo,
    updateFormData,
    setIngredients,
    setPreparationSteps,
    setDietTags,
    setCurrentThumbnailUrl,
    setNewLocalThumbnailUri,
    setCompressionInfo,
    populateFromInitialData,
  } = useOptimizedEditFormState();

  const [isUpdating, setIsUpdating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Effect to populate form when initialRecipeData loads
  useEffect(() => {
    if (initialRecipeData) {
      populateFromInitialData(initialRecipeData);

      // Set dynamic screen title
      if (initialRecipeData.title) {
        navigation.setOptions({ title: `Editing: ${initialRecipeData.title}` });
      } else {
        navigation.setOptions({ title: 'Edit Recipe' });
      }
    }
  }, [initialRecipeData, navigation, populateFromInitialData]);

  // Effect to sync parsed ingredients to display format
  useEffect(() => {
    if (parsedIngredients && parsedIngredients.length > 0) {
      const displayIngredients = parsedIngredients.map(parsed => ({
        name: parsed.ingredient || '',
        quantity: parsed.quantity || '',
        unit: parsed.unit || '',
      }));
      setIngredients(displayIngredients);
      
      // SAFETY: Ensure sync is maintained after setting display ingredients
      ensureIngredientSync(displayIngredients);
    }
  }, [parsedIngredients, setIngredients, ensureIngredientSync]);

  // Memoized handlers
  const handleIngredientChange = useCallback(
    (index: number, field: keyof Ingredient, value: string) => {
      const newIngredients = [...ingredients];
      newIngredients[index] = { ...newIngredients[index], [field]: value };
      setIngredients(newIngredients);

      // CRITICAL FIX: Ensure parsedIngredients array is properly sized and synchronized
      const newParsedIngredients = [...parsedIngredients];
      
      // SAFETY: Ensure the array is large enough for the current index
      while (newParsedIngredients.length <= index) {
        newParsedIngredients.push({
          quantity: '',
          unit: '',
          ingredient: '',
        });
      }

      // Ensure we have a valid parsed ingredient at this index
      if (!newParsedIngredients[index]) {
        newParsedIngredients[index] = {
          quantity: '',
          unit: '',
          ingredient: '',
        };
      }

      // Also update the parsed ingredients to keep them in sync
      if (field === 'name') newParsedIngredients[index].ingredient = value;
      if (field === 'quantity') newParsedIngredients[index].quantity = value;
      if (field === 'unit') newParsedIngredients[index].unit = value;

      // DEBUG: Log the synchronization for troubleshooting
      if (__DEV__) {
        console.log(`[EditRecipeOptimized] Ingredient sync - Index: ${index}, Field: ${field}, Value: ${value}`);
        console.log(`[EditRecipeOptimized] Updated parsed ingredient:`, newParsedIngredients[index]);
      }

      updateIngredients(newParsedIngredients);
    },
    [ingredients, parsedIngredients, setIngredients, updateIngredients],
  );

  const handleAddIngredient = useCallback(() => {
    setIngredients(prev => [...prev, { name: '', quantity: '', unit: '' }]);
    addParsedIngredient();
  }, [setIngredients, addParsedIngredient]);

  const handleRemoveIngredient = useCallback(
    (indexToRemove: number) => {
      if (ingredients.length === 1) {
        setIngredients([{ name: '', quantity: '', unit: '' }]);
        return;
      }
      setIngredients(prev =>
        prev.filter((_, index) => index !== indexToRemove),
      );
      removeParsedIngredient(indexToRemove);
    },
    [ingredients.length, setIngredients, removeParsedIngredient],
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

  const handleTagToggle = useCallback(
    (tag: string) => {
      setDietTags(prev =>
        prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
      );
    },
    [setDietTags],
  );

  const handleSelectThumbnail = useCallback(async () => {
    const callId = `thumbnail_select_${Date.now()}`;
    startApiCall(callId);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await processAndCompressThumbnail(result.assets[0].uri);
      }
    } catch (error: any) {
      Alert.alert('Error', 'Could not select thumbnail.');
    } finally {
      endApiCall(callId, 'thumbnail_select');
    }
  }, [startApiCall, endApiCall]);

  const processAndCompressThumbnail = useCallback(
    async (uri: string) => {
      try {
        setCompressionInfo('Processing image...');

        const compressionResult = await compressImageWithPreset(
          uri,
          'HIGH_QUALITY',
        );

        if (compressionResult.compressionRatio) {
          setCompressionInfo(
            `Compressed by ${(compressionResult.compressionRatio * 100).toFixed(1)}%`,
          );
        } else {
          setCompressionInfo('Image optimized');
        }

        setNewLocalThumbnailUri(compressionResult.uri);
        setCurrentThumbnailUrl(compressionResult.uri);

        // Clear compression info after a delay
        setTimeout(() => setCompressionInfo(''), 3000);
      } catch (error: any) {
        Alert.alert(
          'Processing Failed',
          error.message || 'Could not process thumbnail.',
        );
        setCompressionInfo('');
      }
    },
    [setCompressionInfo, setNewLocalThumbnailUri, setCurrentThumbnailUrl],
  );

  // Optimized validation
  const validateForm = useCallback(() => {
    if (!formData.title.trim()) {
      Alert.alert('Validation Error', 'Please enter a recipe title.');
      return false;
    }
    return true;
  }, [formData.title]);

  // Helper for converting URI to base64
  const convertUriToBase64 = useCallback(
    async (uri: string): Promise<string> => {
      if (Platform.OS === 'web') {
        try {
          const response = await fetch(uri);
          const blob = await response.blob();
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () =>
              resolve((reader.result as string).split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          throw new Error('Failed to convert web URI to Base64');
        }
      }

      try {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return base64;
      } catch (e) {
        throw e;
      }
    },
    [],
  );

  const handleSaveRecipe = useCallback(async () => {
    if (!initialRecipeData) {
      Alert.alert('Error', 'Original recipe data not loaded.');
      return;
    }
    if (!validateForm()) return;

    setIsUpdating(true);
    setUploadProgress(0);
    let finalThumbnailUrl = currentThumbnailUrl;

    const callId = `recipe_save_${Date.now()}`;
    startApiCall(callId);

    try {
      // Handle thumbnail upload if a new one was selected
      if (
        newLocalThumbnailUri &&
        newLocalThumbnailUri !== initialRecipeData.thumbnail_url
      ) {
        setUploadProgress(0.25);

        // Get the compressed image data
        let base64Data: string;
        try {
          const compressionResult = await compressImageWithPreset(
            newLocalThumbnailUri,
            'HIGH_QUALITY',
          );
          if (!compressionResult.base64) {
            throw new Error('Failed to get base64 data from compressed image');
          }
          base64Data = compressionResult.base64;
        } catch (compressionError) {
          base64Data = await convertUriToBase64(newLocalThumbnailUri);
        }

        const fileExt = 'jpg';
        const fileName = `recipe-thumb-${recipeId}-${Date.now()}.${fileExt}`;
        const contentType = 'image/jpeg';
        const filePath = `${user?.id || 'public'}/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('recipe-thumbnails')
          .upload(filePath, decode(base64Data), {
            cacheControl: '3600',
            upsert: true,
            contentType,
          });

        if (uploadError) {
          throw new Error(
            `Failed to upload thumbnail: ${JSON.stringify(uploadError)}`,
          );
        }

        setUploadProgress(0.5);
        if (uploadData) {
          const { data: publicUrlData } = supabase.storage
            .from('recipe-thumbnails')
            .getPublicUrl(filePath);
          finalThumbnailUrl = publicUrlData.publicUrl;
        }
      }

      // Prepare data for RPC call
      const updatedRecipePayload = {
        p_recipe_id: initialRecipeData.recipe_id,
        p_title: formData.title.trim(),
        p_description: formData.description.trim(),
        p_video_url: initialRecipeData.video_url,
        p_thumbnail_url: finalThumbnailUrl,
        p_ingredients: getIngredientsForSave(),
        p_diet_tags: dietTags,
        p_preparation_steps: preparationSteps.filter(
          step => step.trim() !== '',
        ),
        p_prep_time_minutes: parseInt(formData.prepTimeMinutes) || null,
        p_cook_time_minutes: parseInt(formData.cookTimeMinutes) || null,
        p_servings: parseInt(formData.servings) || null,
        p_is_public: formData.isPublic,
      };

      // 🔍 BACKEND TEAM REQUEST: Debug auth context before RPC call
      console.log('=== AUTH DEBUG INFO (Backend Team Request - Optimized) ===');
      console.log('🔐 Current auth.user():', await supabase.auth.getUser());
      console.log('🔐 Expected user_id:', '75a26b47-9b41-490b-af01-d00926cb0bbb');
      console.log('🔐 useAuth() user:', user);
      console.log('🔐 useAuth() user.id:', user?.id);
      console.log('📦 updatedRecipePayload:', JSON.stringify(updatedRecipePayload, null, 2));
      
      // 🔍 DEBUG: Check ingredient data before save
      console.log('🥕 INGREDIENT DEBUG (Optimized):');
      console.log('🥕 Parsed ingredients:', JSON.stringify(parsedIngredients, null, 2));
      console.log('🥕 Serialized for save:', JSON.stringify(getIngredientsForSave(), null, 2));
      
      console.log('=== END AUTH DEBUG ===');

      setUploadProgress(0.75);

      // Call the update RPC
      const { error: updateRpcError } = await supabase.rpc(
        'update_recipe_details',
        updatedRecipePayload,
      );
      
      // 🔍 BACKEND TEAM REQUEST: Log RPC errors in detail
      if (updateRpcError) {
        console.error('=== RPC ERROR DEBUG (Backend Team Request - Optimized) ===');
        console.error('❌ RPC Error Details:', updateRpcError);
        console.error('❌ Error Code:', updateRpcError.code);
        console.error('❌ Error Message:', updateRpcError.message);
        console.error('❌ Error Details:', updateRpcError.details);
        console.error('❌ Error Hint:', updateRpcError.hint);
        console.error('=== END RPC ERROR DEBUG ===');
        throw updateRpcError;
      }

      setUploadProgress(1);
      Alert.alert('Success', 'Recipe updated successfully!');

      // GENTLE CACHE REFRESH: Invalidate without removing data
      console.log('[EditRecipeOptimized] Using gentle cache refresh approach...');
      
      // Invalidate the specific recipe caches to trigger refetch
      queryClient.invalidateQueries({
        queryKey: ['recipeDetails', recipeId],
      });
      queryClient.invalidateQueries({
        queryKey: ['editableRecipeDetails', recipeId],
      });
      
      // Invalidate profile data for recipe lists
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      }

      // Small delay before navigation to allow cache invalidation to start
      await new Promise(resolve => setTimeout(resolve, 200));

      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not update recipe.');
    } finally {
      setIsUpdating(false);
      setUploadProgress(0);
      endApiCall(callId, 'recipe_save');
    }
  }, [
    initialRecipeData,
    validateForm,
    currentThumbnailUrl,
    newLocalThumbnailUri,
    formData,
    dietTags,
    preparationSteps,
    getIngredientsForSave,
    convertUriToBase64,
    recipeId,
    user,
    clearCachesAfterSave,
    queryClient,
    navigation,
    startApiCall,
    endApiCall,
    parsedIngredients,
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

  // Loading state
  if (isLoadingDetails || isLoadingParsedIngredients) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={BRAND_PRIMARY} />
      </View>
    );
  }

  // Error state
  if (isErrorDetails) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorText}>
          Error loading recipe details: {errorDetails?.message}
        </Text>
      </View>
    );
  }

  if (!initialRecipeData) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorText}>Recipe not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContentContainer}
      showsVerticalScrollIndicator={false}>
      <OptimizedHeader title={formData.title} />

      {/* Form Container */}
      <View style={styles.formContainer}>
        {/* Recipe Details Section */}
        <Suspense fallback={<ActivityIndicator size="small" />}>
          <EditRecipeDetailsSection
            formData={formData}
            onUpdateFormData={updateFormData}
          />
        </Suspense>

        {/* Thumbnail Section */}
        <Suspense fallback={<ActivityIndicator size="small" />}>
          <EditThumbnailSection
            currentThumbnailUrl={currentThumbnailUrl}
            newLocalThumbnailUri={newLocalThumbnailUri}
            compressionInfo={compressionInfo}
            onSelectThumbnail={handleSelectThumbnail}
          />
        </Suspense>

        {/* Ingredients Section */}
        <Suspense fallback={<ActivityIndicator size="small" />}>
          <EditIngredientsSection
            ingredients={ingredients}
            ingredientCount={ingredientCount}
            onIngredientChange={handleIngredientChange}
            onAddIngredient={handleAddIngredient}
            onRemoveIngredient={handleRemoveIngredient}
          />
        </Suspense>

        {/* Preparation Steps Section */}
        <Suspense fallback={<ActivityIndicator size="small" />}>
          <EditPreparationStepsSection
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

      {/* Save Button */}
      <OptimizedSaveButton
        isUpdating={isUpdating}
        uploadProgress={uploadProgress}
        onSave={handleSaveRecipe}
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
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginHorizontal: 20,
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
  saveButton: {
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
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonContentLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
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

EditRecipeScreenOptimized.displayName = 'EditRecipeScreenOptimized';

export default EditRecipeScreenOptimized;
