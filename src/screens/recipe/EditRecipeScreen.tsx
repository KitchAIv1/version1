import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system'; // Import expo-file-system
import { supabase } from '../../services/supabase'; // Adjust path as needed
import {
  useEditableRecipeDetails,
  RecipeEditableData,
  Ingredient,
} from '../../hooks/useEditableRecipeDetails'; // Adjust path
import { useAuth } from '../../providers/AuthProvider'; // Import useAuth
import { MainStackParamList } from '../../navigation/types'; // Adjust path as needed
import {
  compressImageWithPreset,
  needsCompression,
} from '../../utils/imageCompression'; // Import compression utilities

// ADD THE SAFE RECIPE EDIT HOOK IMPORT
import { useSafeRecipeEdit } from '../../hooks/useSafeRecipeEdit';

// Reusable CollapsibleCard (can be moved to a shared components folder)
const CollapsibleCard: React.FC<{
  title: string;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}> = ({ title, children, defaultCollapsed = false }) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  return (
    <View style={styles.cardContainer}>
      <TouchableOpacity
        onPress={() => setIsCollapsed(!isCollapsed)}
        style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Icon
          name={isCollapsed ? 'expand-more' : 'expand-less'}
          size={24}
          color="#333"
        />
      </TouchableOpacity>
      {!isCollapsed && <View style={styles.cardContent}>{children}</View>}
    </View>
  );
};

// Available diet tags (can be imported from a constants file)
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

type EditRecipeScreenProps = NativeStackScreenProps<
  MainStackParamList,
  'EditRecipe'
>; // Assuming 'EditRecipe' is the route name

const EditRecipeScreen: React.FC<EditRecipeScreenProps> = ({
  route,
  navigation,
}) => {
  const { recipeId } = route.params; // Get recipeId from navigation params
  const queryClient = useQueryClient();
  const { user } = useAuth(); // Get user from useAuth

  const {
    data: initialRecipeData,
    isLoading: isLoadingDetails,
    isError: isErrorDetails,
    error: errorDetails,
  } = useEditableRecipeDetails(recipeId);

  // ADD SAFE RECIPE EDIT HOOK FOR PARSED INGREDIENTS
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

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { name: '', quantity: '', unit: '' },
  ]);
  const [preparationSteps, setPreparationSteps] = useState<string[]>(['']);
  const [dietTags, setDietTags] = useState<string[]>([]);
  const [prepTimeMinutes, setPrepTimeMinutes] = useState('');
  const [cookTimeMinutes, setCookTimeMinutes] = useState('');
  const [servings, setServings] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [currentThumbnailUrl, setCurrentThumbnailUrl] = useState<string | null>(
    null,
  );
  const [newLocalThumbnailUri, setNewLocalThumbnailUri] = useState<
    string | null
  >(null);

  const [isUpdating, setIsUpdating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // For thumbnail upload if needed
  const [compressionInfo, setCompressionInfo] = useState<string>(''); // Add compression info state

  // --- Effect to populate form when initialRecipeData loads & set screen title ---
  useEffect(() => {
    if (initialRecipeData) {
      setTitle(initialRecipeData.title || '');
      setDescription(initialRecipeData.description || '');
      // REMOVE: setIngredients(initialRecipeData.ingredients.length > 0 ? initialRecipeData.ingredients : [{ name: '', quantity: '', unit: '' }]);
      setPreparationSteps(
        initialRecipeData.preparation_steps.length > 0
          ? initialRecipeData.preparation_steps
          : [''],
      );
      setDietTags(initialRecipeData.diet_tags || []);
      setPrepTimeMinutes(initialRecipeData.prep_time_minutes?.toString() || '');
      setCookTimeMinutes(initialRecipeData.cook_time_minutes?.toString() || '');
      setServings(initialRecipeData.servings?.toString() || '');
      setIsPublic(initialRecipeData.is_public);
      setCurrentThumbnailUrl(initialRecipeData.thumbnail_url);
      setNewLocalThumbnailUri(null); // Reset any previously selected new thumbnail

      // Set dynamic screen title
      if (initialRecipeData.title) {
        navigation.setOptions({ title: `Editing: ${initialRecipeData.title}` });
      } else {
        navigation.setOptions({ title: 'Edit Recipe' }); // Fallback title
      }
    }
  }, [initialRecipeData, navigation]);

  // --- Effect to sync parsed ingredients to display format ---
  useEffect(() => {
    if (parsedIngredients && parsedIngredients.length > 0) {
      const displayIngredients = parsedIngredients.map(parsed => ({
        // FIX: Map 'ingredient' field from database to 'name' field for display
        name: parsed.ingredient || '',
        quantity: parsed.quantity || '',
        unit: parsed.unit || '',
      }));
      
      setIngredients(displayIngredients);
      
      // SAFETY: Ensure sync is maintained after setting display ingredients
      ensureIngredientSync(displayIngredients);
    }
  }, [parsedIngredients, ensureIngredientSync]);

  // --- Updated Handlers for Ingredients to sync with parsing ---
  const handleIngredientChange = (
    index: number,
    field: keyof Ingredient,
    value: string,
  ) => {
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

    // Update the correct field in parsed ingredients
    if (field === 'name') {
      newParsedIngredients[index].ingredient = value;
    } else if (field === 'quantity') {
      newParsedIngredients[index].quantity = value;
    } else if (field === 'unit') {
      newParsedIngredients[index].unit = value;
    }

    // DEBUG: Log the synchronization for troubleshooting
    if (__DEV__) {
      console.log(`[EditRecipe] Ingredient sync - Index: ${index}, Field: ${field}, Value: ${value}`);
      console.log(`[EditRecipe] Updated parsed ingredient:`, newParsedIngredients[index]);
    }

    // Apply the update
    updateIngredients(newParsedIngredients);
  };

  const handleAddIngredient = () => {
    setIngredients([...ingredients, { name: '', quantity: '', unit: '' }]);
    addParsedIngredient(); // Also add to parsed ingredients
  };

  const handleRemoveIngredient = (indexToRemove: number) => {
    if (ingredients.length === 1) {
      setIngredients([{ name: '', quantity: '', unit: '' }]);
      // Reset parsed ingredients to have one empty ingredient
      updateIngredients([{
        quantity: '',
        unit: '',
        ingredient: '',
      }]);
      return;
    }
    setIngredients(ingredients.filter((_, index) => index !== indexToRemove));
    removeParsedIngredient(indexToRemove); // Also remove from parsed ingredients
  };

  // --- Handlers for Preparation Steps (similar to VideoUploaderScreen) ---
  const handleStepChange = (index: number, value: string) => {
    const newSteps = [...preparationSteps];
    newSteps[index] = value;
    setPreparationSteps(newSteps);
  };
  const handleAddStep = () => setPreparationSteps([...preparationSteps, '']);
  const handleRemoveStep = (indexToRemove: number) => {
    if (preparationSteps.length === 1) {
      setPreparationSteps(['']);
      return;
    }
    setPreparationSteps(
      preparationSteps.filter((_, index) => index !== indexToRemove),
    );
  };

  // --- Handler for Diet Tags ---
  const handleTagToggle = (tag: string) => {
    setDietTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    );
  };

  // --- Handler for Thumbnail Selection ---
  const handleSelectThumbnail = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Camera roll permission is needed to select a thumbnail.',
      );
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [16, 9], // Maintain 16:9 aspect ratio for recipe thumbnails
        quality: 1.0, // Start with highest quality, we'll compress it ourselves
        base64: false, // We'll get base64 from compression
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        await processAndCompressThumbnail(asset.uri);
      }
    } catch (error: any) {
      console.error('Error selecting thumbnail:', error);
      Alert.alert(
        'Selection Failed',
        error.message || 'Could not select thumbnail.',
      );
    }
  };

  const processAndCompressThumbnail = async (uri: string) => {
    try {
      setCompressionInfo('Checking image size...');

      // Check if compression is needed (target 300KB for recipe thumbnails)
      const { needsCompression: shouldCompress, currentSizeKB } =
        await needsCompression(uri, 300);

      if (shouldCompress) {
        setCompressionInfo(
          `Compressing ${Math.round(currentSizeKB)}KB image...`,
        );

        // Compress using HIGH_QUALITY preset (800x800, ~300KB target) - good for recipe thumbnails
        const compressionResult = await compressImageWithPreset(
          uri,
          'HIGH_QUALITY',
        );

        const finalSizeKB = compressionResult.fileSize
          ? Math.round(compressionResult.fileSize / 1024)
          : 0;
        const compressionPercent = compressionResult.compressionRatio
          ? Math.round(compressionResult.compressionRatio * 100)
          : 0;

        setCompressionInfo(
          `Optimized: ${finalSizeKB}KB (${compressionPercent}% smaller)`,
        );

        // Set the compressed image
        setNewLocalThumbnailUri(compressionResult.uri);
        setCurrentThumbnailUrl(compressionResult.uri); // Show compressed image immediately for preview
      } else {
        setCompressionInfo(
          `Image already optimized (${Math.round(currentSizeKB)}KB)`,
        );

        // Image is already small enough, but still compress for consistency
        const compressionResult = await compressImageWithPreset(
          uri,
          'HIGH_QUALITY',
        );
        setNewLocalThumbnailUri(compressionResult.uri);
        setCurrentThumbnailUrl(compressionResult.uri);
      }

      // Clear compression info after a delay
      setTimeout(() => setCompressionInfo(''), 3000);
    } catch (error: any) {
      console.error('Thumbnail processing error:', error);
      Alert.alert(
        'Processing Failed',
        error.message || 'Could not process thumbnail.',
      );
      setCompressionInfo('');
    }
  };

  // --- Main Save Function ---
  const handleSaveRecipe = async () => {
    if (!initialRecipeData) {
      Alert.alert('Error', 'Original recipe data not loaded.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please enter a recipe title.');
      return;
    }
    // Add more validations for other fields as needed (e.g., times, servings, ingredients, steps)

    setIsUpdating(true);
    setUploadProgress(0);
    let finalThumbnailUrl = currentThumbnailUrl; // Start with the existing or initially set thumbnail

    try {
      // 1. Handle thumbnail upload if a new one was selected
      if (
        newLocalThumbnailUri &&
        newLocalThumbnailUri !== initialRecipeData.thumbnail_url
      ) {
        console.log(
          'New thumbnail selected, attempting upload:',
          newLocalThumbnailUri,
        );
        setUploadProgress(0.25);

        // Get the compressed image data
        let base64Data: string;
        try {
          // Since we compressed the image, we need to get its base64 representation
          const compressionResult = await compressImageWithPreset(
            newLocalThumbnailUri,
            'HIGH_QUALITY',
          );
          if (!compressionResult.base64) {
            throw new Error('Failed to get base64 data from compressed image');
          }
          base64Data = compressionResult.base64;
        } catch (compressionError) {
          console.error(
            'Error getting compressed image data:',
            compressionError,
          );
          // Fallback to original conversion method
          base64Data = await convertUriToBase64(newLocalThumbnailUri);
        }

        const fileExt = 'jpg'; // Always use jpg for recipe thumbnails (better compression)
        const fileName = `recipe-thumb-${recipeId}-${Date.now()}.${fileExt}`;
        const contentType = 'image/jpeg';

        const filePath = `${user?.id || 'public'}/${fileName}`;
        console.log(`Uploading to path: ${filePath}`);

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('recipe-thumbnails')
          .upload(filePath, decode(base64Data), {
            cacheControl: '3600',
            upsert: true, // Important for replacing existing thumbnail if any
            contentType, // Use jpeg content type
          });

        if (uploadError) {
          console.error('Thumbnail upload error:', uploadError);
          // Attempt to get bucket details for more context if primary upload fails
          try {
            const { data: bucketData, error: bucketError } =
              await supabase.storage.getBucket('recipe-thumbnails');
            if (bucketError) {
              console.error(
                'Failed to get bucket details after upload error:',
                bucketError,
              );
            } else {
              console.log('Bucket details (recipe-thumbnails):', bucketData);
            }
          } catch (e) {
            console.error('Error fetching bucket details:', e);
          }
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
          console.log(
            'Thumbnail uploaded and public URL obtained:',
            finalThumbnailUrl,
          );
        } else {
          // This case should ideally be caught by uploadError, but as a fallback:
          console.warn(
            'Thumbnail upload returned no data and no error. Using original thumbnail URL.',
          );
        }
      }

      // 2. Prepare data for RPC call
      const updatedRecipePayload = {
        p_recipe_id: initialRecipeData.recipe_id,
        p_title: title.trim(),
        p_description: description.trim(),
        p_video_url: initialRecipeData.video_url, // Pass original video URL as it's not changed here
        p_thumbnail_url: finalThumbnailUrl,
        p_ingredients: getIngredientsForSave(), // USE PROPERLY SERIALIZED INGREDIENTS
        p_diet_tags: dietTags,
        p_preparation_steps: preparationSteps.filter(
          step => step.trim() !== '',
        ), // Clean empty steps
        p_prep_time_minutes: parseInt(prepTimeMinutes) || null,
        p_cook_time_minutes: parseInt(cookTimeMinutes) || null,
        p_servings: parseInt(servings) || null,
        p_is_public: isPublic,
      };

      // Verify authentication before saving
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        console.error('[EditRecipeScreen] Auth error:', authError?.message || 'No user');
        throw new Error('User not authenticated');
      }

      // 3. Call the RPC function
      const { data, error } = await supabase.rpc('update_recipe_details', updatedRecipePayload);
      
      if (error) {
        console.error('[EditRecipeScreen] Update failed:', error.message);
        throw new Error(`Update failed: ${error.message}`);
      }

      setUploadProgress(1);
      Alert.alert('Success', 'Recipe updated successfully!');

      // 4. SAFE cache management - Remove stale data instead of invalidating
      
      if (user) {
        // Remove specific cached data to force fresh fetch
        queryClient.removeQueries({
          queryKey: ['recipeDetails', recipeId, user.id],
        });
        
        queryClient.removeQueries({
          queryKey: ['editableRecipeDetails', recipeId, user.id],
        });
        
        queryClient.removeQueries({
          queryKey: ['pantryMatch', recipeId, user.id],
        });
        
        // Invalidate profile data for recipe lists (this is safe to invalidate)
        queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      }

      // Ensure cache is cleared before navigation
      await new Promise(resolve => setTimeout(resolve, 300));

      navigation.goBack();
    } catch (error: any) {
      console.error('Failed to save recipe:', error);
      Alert.alert('Error', error.message || 'Could not update recipe.');
    } finally {
      setIsUpdating(false);
      setUploadProgress(0);
    }
  };

  // Helper for converting URI to base64 on mobile
  async function convertUriToBase64(uri: string): Promise<string> {
    if (Platform.OS === 'web') {
      // For web, if the uri is a blob uri, fetching and converting to base64 is more complex
      // and might not be necessary if uploading as Blob/File.
      // This function is primarily for mobile native URI to base64 for direct ArrayBuffer upload.
      // If direct blob/file upload is used for web, this conversion step might be skipped.
      console.warn(
        'convertUriToBase64 called on web, ensure this is intended or handle web uploads differently.',
      );
      // Fallback for web: try to fetch and convert, assuming it's a fetchable URI
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () =>
            resolve((reader.result as string).split(',')[1]); // Get base64 part
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.error('Web URI to Base64 conversion failed:', e);
        throw new Error('Failed to convert web URI to Base64');
      }
    }
    // For mobile (iOS/Android)
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return base64;
    } catch (e) {
      console.error('Failed to read file as base64:', e);
      throw e;
    }
  }

  // --- Render Loading/Error States ---
  if (isLoadingDetails || isLoadingParsedIngredients) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (isErrorDetails) {
    return (
      <View style={styles.centered}>
        <Text>Error loading recipe details: {errorDetails?.message}</Text>
      </View>
    );
  }
  if (!initialRecipeData) {
    return (
      <View style={styles.centered}>
        <Text>Recipe not found.</Text>
      </View>
    );
  }

  // --- Main Render ---
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContentContainer}>
      <Text style={styles.screenTitle}>Edit Recipe</Text>

      <CollapsibleCard title="General Details" defaultCollapsed={false}>
        <TextInput
          placeholder="Recipe Title"
          value={title}
          onChangeText={setTitle}
          style={styles.input}
        />
        <TextInput
          placeholder="Description (optional)"
          value={description}
          onChangeText={setDescription}
          style={styles.inputMulti}
          multiline
          numberOfLines={4}
        />
      </CollapsibleCard>

      <CollapsibleCard title="Timings & Servings">
        <TextInput
          placeholder="Prep Time (minutes)"
          value={prepTimeMinutes}
          onChangeText={setPrepTimeMinutes}
          style={styles.input}
          keyboardType="numeric"
        />
        <TextInput
          placeholder="Cook Time (minutes)"
          value={cookTimeMinutes}
          onChangeText={setCookTimeMinutes}
          style={styles.input}
          keyboardType="numeric"
        />
        <TextInput
          placeholder="Servings"
          value={servings}
          onChangeText={setServings}
          style={styles.input}
          keyboardType="numeric"
        />
      </CollapsibleCard>

      <CollapsibleCard title="Thumbnail">
        <View style={styles.thumbnailContainer}>
          {currentThumbnailUrl || newLocalThumbnailUri ? (
            <Image
              source={{ uri: newLocalThumbnailUri || currentThumbnailUrl! }}
              style={styles.thumbnailPreview}
            />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Icon name="image" size={50} color="#ccc" />
            </View>
          )}
          <TouchableOpacity
            style={styles.button}
            onPress={handleSelectThumbnail}>
            <Text style={styles.buttonText}>Change Thumbnail</Text>
          </TouchableOpacity>
          {/* Compression info display */}
          {compressionInfo && (
            <Text style={styles.compressionInfo}>{compressionInfo}</Text>
          )}
        </View>
      </CollapsibleCard>

      <CollapsibleCard title={`Ingredients (${ingredients.length})`}>
        {ingredients.map((ing, index) => (
          <View key={index} style={styles.listItemContainer}>
            <TextInput
              placeholder="Name (e.g., Flour)"
              value={ing.name}
              onChangeText={val => handleIngredientChange(index, 'name', val)}
              style={styles.inputFlex}
            />
            <TextInput
              placeholder="Qty"
              value={ing.quantity}
              onChangeText={val =>
                handleIngredientChange(index, 'quantity', val)
              }
              style={styles.inputQty}
              keyboardType="numeric"
            />
            <TextInput
              placeholder="Unit (e.g., cup)"
              value={ing.unit}
              onChangeText={val => handleIngredientChange(index, 'unit', val)}
              style={styles.inputUnit}
            />
            <TouchableOpacity
              onPress={() => handleRemoveIngredient(index)}
              style={styles.removeButton}>
              <Icon name="remove-circle-outline" size={24} color="#ff6347" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddIngredient}>
          <Icon name="add-circle-outline" size={26} color="#22c55e" />
          <Text style={styles.addButtonText}>Add Ingredient</Text>
        </TouchableOpacity>
      </CollapsibleCard>

      <CollapsibleCard title={`Preparation Steps (${preparationSteps.length})`}>
        {preparationSteps.map((step, index) => (
          <View key={index} style={styles.listItemContainer}>
            <Text style={styles.stepNumber}>{index + 1}.</Text>
            <TextInput
              placeholder="Describe step"
              value={step}
              onChangeText={val => handleStepChange(index, val)}
              style={styles.inputFlexMulti}
              multiline
            />
            <TouchableOpacity
              onPress={() => handleRemoveStep(index)}
              style={styles.removeButtonPadding}>
              <Icon name="remove-circle-outline" size={24} color="#ff6347" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addButton} onPress={handleAddStep}>
          <Icon name="add-circle-outline" size={26} color="#22c55e" />
          <Text style={styles.addButtonText}>Add Step</Text>
        </TouchableOpacity>
      </CollapsibleCard>

      <CollapsibleCard title="Dietary Tags">
        <View style={styles.tagsContainer}>
          {DIET_TAGS_OPTIONS.map(tag => (
            <TouchableOpacity
              key={tag}
              style={[styles.tag, dietTags.includes(tag) && styles.tagSelected]}
              onPress={() => handleTagToggle(tag)}>
              <Text
                style={[
                  styles.tagText,
                  dietTags.includes(tag) && styles.tagTextSelected,
                ]}>
                {tag}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </CollapsibleCard>

      <CollapsibleCard title="Visibility">
        <View style={styles.switchContainer}>
          <Text>Make Recipe Public</Text>
          <Switch value={isPublic} onValueChange={setIsPublic} />
        </View>
      </CollapsibleCard>

      <TouchableOpacity
        style={[styles.saveButton, isUpdating && styles.saveButtonDisabled]}
        onPress={handleSaveRecipe}
        disabled={isUpdating}>
        {isUpdating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save Changes</Text>
        )}
      </TouchableOpacity>
      {isUpdating && uploadProgress > 0 && uploadProgress < 1 && (
        <View style={styles.progressBarContainer}>
          <View
            style={[styles.progressBar, { width: `${uploadProgress * 100}%` }]}
          />
          <Text
            style={
              styles.progressText
            }>{`Uploading... ${(uploadProgress * 100).toFixed(0)}%`}</Text>
        </View>
      )}
    </ScrollView>
  );
};

// Basic Styles - Adapt from VideoUploaderScreen or create new ones
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  scrollContentContainer: { paddingBottom: 100 }, // Ensure space for save button
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  screenTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 16,
    color: '#333',
  },
  cardContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 8,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#444' },
  cardContent: { padding: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  inputMulti: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 6,
    marginBottom: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
  },
  listItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputFlex: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 8,
    borderRadius: 6,
    marginRight: 8,
  },
  inputFlexMulti: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 8,
    borderRadius: 6,
    marginRight: 8,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  inputQty: {
    width: 60,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 8,
    borderRadius: 6,
    marginRight: 8,
    textAlign: 'center',
  },
  inputUnit: {
    flex: 0.8,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 8,
    borderRadius: 6,
    marginRight: 8,
  },
  removeButton: { padding: 4 }, // Minimal padding around icon
  removeButtonPadding: { padding: 8 }, // For step remove consistency
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  addButtonText: { color: '#22c55e', marginLeft: 8, fontWeight: '600' },
  stepNumber: { marginRight: 8, fontSize: 15, color: '#555' },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#ccc',
    marginRight: 8,
    marginBottom: 8,
  },
  tagSelected: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  tagText: { color: '#555' },
  tagTextSelected: { color: '#fff' },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  thumbnailContainer: { alignItems: 'center', marginVertical: 10 },
  thumbnailPreview: {
    width: 200,
    height: 112.5,
    borderRadius: 6,
    marginBottom: 10,
    backgroundColor: '#eee',
  }, // 16:9 aspect ratio
  thumbnailPlaceholder: {
    width: 200,
    height: 112.5,
    borderRadius: 6,
    marginBottom: 10,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#22c55e',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: 'bold' },
  saveButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: { backgroundColor: '#A3A3A3' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  progressBarContainer: {
    marginHorizontal: 16,
    marginTop: 10,
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  progressBar: { height: '100%', backgroundColor: '#22c55e' },
  progressText: {
    position: 'absolute',
    alignSelf: 'center',
    color: '#333',
    fontWeight: 'bold',
  },
  compressionInfo: {
    fontSize: 12,
    color: '#10B981',
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
    minHeight: 16,
  },
});

export default EditRecipeScreen;
