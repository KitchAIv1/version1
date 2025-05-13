import React, { useState, useEffect } from 'react';
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
  Button,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/types';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { MediaTypeOptions } from 'expo-image-picker';
import { useVideoUploader, RecipeMetadataForEdgeFunction, Ingredient } from '../../hooks/useVideoUploader';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { v4 as uuidv4 } from 'uuid';
import 'react-native-get-random-values'; // Import this before uuid

// Placeholder for CollapsibleCard: For a real app, create this in src/components/CollapsibleCard.tsx
const CollapsibleCard: React.FC<{ title: string; children: React.ReactNode; defaultCollapsed?: boolean }> = ({ title, children, defaultCollapsed = false }) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  return (
    <View style={styles.cardContainer}>
      <TouchableOpacity onPress={() => setIsCollapsed(!isCollapsed)} style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Icon name={isCollapsed ? "expand-more" : "expand-less"} size={24} color="#333" />
      </TouchableOpacity>
      {!isCollapsed && <View style={styles.cardContent}>{children}</View>}
    </View>
  );
};

type VideoRecipeUploaderScreenProps = NativeStackScreenProps<MainStackParamList, 'VideoRecipeUploader'>;

const DIET_TAGS_OPTIONS = [ // Renamed to avoid conflict if DIET_TAGS was a state
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Keto',
  'Paleo',
  'Low-Carb',
  'High-Protein',
];

const VideoRecipeUploaderScreen: React.FC<VideoRecipeUploaderScreenProps> = ({ navigation: navPropFromProps }) => { // Renamed to avoid conflict
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList, 'VideoRecipeUploader'>>();
  
  const onUploadSuccessHandler = (response: any) => {
    console.log('onUploadSuccessHandler received:', response);
    const videoUrl = response?.videoUrl; // Assuming Edge Function returns { videoUrl: '...' }
    const recipeId = response?.recipeId;

    let successMessage = 'Recipe uploaded successfully!';
    if (videoUrl) {
      successMessage += `\nVideo URL: ${videoUrl}`;
      console.log('Processed Video URL:', videoUrl);
      // TODO: Potentially navigate to a player or display the videoUrl
    }
    if (recipeId) {
      console.log('Processed Recipe ID:', recipeId);
    }

    Alert.alert('Success', successMessage);
    // Clear form state
    setTitle('');
    setDescription('');
    setIngredients([{ name: '', quantity: '', unit: '' }]);
    setDietTags([]);
    setIsPublic(true);
    setPreparationSteps(['']);
    setPrepTimeMinutes('');
    setCookTimeMinutes('');
    setServings('');
    // Hook will clear its own videoUri and thumbnailUri
    if(navigation.canGoBack()) navigation.goBack();
  };

  const onUploadErrorHandler = (errorDetails: any | string) => {
    console.error('onUploadErrorHandler received:', errorDetails);
    let errorMessage = 'An unexpected error occurred.';

    if (typeof errorDetails === 'string') {
      errorMessage = errorDetails;
    } else if (errorDetails && typeof errorDetails === 'object') {
      // Attempt to parse known error structures from Supabase Edge Functions
      // The actual structure might be in errorDetails.details, errorDetails.error, errorDetails.message, etc.
      // This is an example based on common patterns or the user's provided snippet
      const details = errorDetails.details || errorDetails.error?.message || errorDetails.message;
      if (details && typeof details === 'string') {
        if (details.includes('Invalid UUID format')) {
          errorMessage = 'There was a problem with the recipe ID. Please try publishing again.';
        } else if (details.includes('Mux processing failed')) { // Example for future Mux errors
          errorMessage = 'Video processing failed after upload. Please check the video format or try again later.';
        } else {
          errorMessage = details; // Use the detailed message from the function
        }
      } else if (errorDetails.message) {
        errorMessage = errorDetails.message; // Fallback to a general message if details parsing fails
      }
    }
    Alert.alert('Upload Error', errorMessage);
  };
  
  const { 
    uploadRecipe, 
    isUploading, 
    selectVideo, // Use this from hook
    selectThumbnail, // Use this from hook
    videoUri, 
    thumbnailUri, 
    uploadProgress, 
    error: uploadErrorHook 
  } = useVideoUploader({
    onUploadSuccess: onUploadSuccessHandler,
    onUploadError: onUploadErrorHandler
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: '', quantity: '', unit: '' }]);
  const [dietTags, setDietTags] = useState<string[]>([]); // Changed to string[]
  const [isPublic, setIsPublic] = useState(true);
  const [preparationSteps, setPreparationSteps] = useState<string[]>(['']);
  const [prepTimeMinutes, setPrepTimeMinutes] = useState('');
  const [cookTimeMinutes, setCookTimeMinutes] = useState('');
  const [servings, setServings] = useState('');

  // New ingredient state for input fields, not part of the main ingredients list until added
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientQuantity, setNewIngredientQuantity] = useState('');
  const [newIngredientUnit, setNewIngredientUnit] = useState('');


  // These handlers now directly call the hook's functions
  const handleSelectVideo = () => {
    selectVideo(); 
  };

  const handleSelectThumbnail = () => {
    selectThumbnail();
  };

  const handleTagToggle = (tag: string) => {
    setDietTags(prev =>
      prev.includes(tag)
        ? prev.filter((t: string) => t !== tag) // Explicitly type t
        : [...prev, tag]
    );
  };

  const handleAddIngredient = () => {
    if (newIngredientName.trim() && newIngredientQuantity.trim() && newIngredientUnit.trim()) {
      setIngredients(prev => [...prev, {
        name: newIngredientName.trim(),
        quantity: newIngredientQuantity.trim(),
        unit: newIngredientUnit.trim(),
      }]);
      setNewIngredientName('');
      setNewIngredientQuantity('');
      setNewIngredientUnit('');
    } else {
      Alert.alert("Missing Fields", "Please fill in all ingredient fields before adding.");
    }
  };

  const handleRemoveIngredient = (indexToRemove: number) => {
    setIngredients(prev => prev.filter((_, index) => index !== indexToRemove));
    if (ingredients.length === 1) { // If last one removed, add a blank one back
        setIngredients([{ name: '', quantity: '', unit: '' }]);
    }
  };

  const handleAddStep = () => {
    setPreparationSteps(prev => [...prev, '']);
  };

  const handleRemoveStep = (indexToRemove: number) => {
    setPreparationSteps(prev => prev.filter((_, index) => index !== indexToRemove));
     if (preparationSteps.length === 1) { 
        setPreparationSteps(['']);
    }
  };

  const handleStepChange = (index: number, value: string) => {
    setPreparationSteps(prev => {
      const newSteps = [...prev];
      newSteps[index] = value;
      return newSteps;
    });
  };

  const handleIngredientChange = (index: number, field: keyof Ingredient, value: string) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setIngredients(newIngredients);
  };

  const handlePublish = async () => {
    console.log('[VideoRecipeUploaderScreen] handlePublish called');
    if (!videoUri) {
      Alert.alert('Validation Error', 'Please select a video first.');
      console.log('[VideoRecipeUploaderScreen] Validation failed: videoUri missing');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please enter a recipe title.');
      return;
    }
    if (!prepTimeMinutes.trim() || !cookTimeMinutes.trim() || !servings.trim()) {
      Alert.alert('Validation Error', 'Please fill in Prep Time, Cook Time, and Servings.');
      return;
    }
    if (isNaN(parseInt(prepTimeMinutes)) || isNaN(parseInt(cookTimeMinutes)) || isNaN(parseInt(servings))) {
        Alert.alert('Validation Error', 'Prep Time, Cook Time, and Servings must be numbers.');
        return;
    }
    if (ingredients.length === 0 || ingredients.every(ing => !ing.name.trim() && !ing.quantity.trim() && !ing.unit.trim())) {
        Alert.alert('Validation Error', 'Please add at least one valid ingredient.');
        return;
    }
     if (preparationSteps.length === 0 || preparationSteps.every(step => !step.trim())) {
        Alert.alert('Validation Error', 'Please add at least one preparation step.');
        console.log('[VideoRecipeUploaderScreen] Validation failed: preparationSteps empty');
        return;
    }
    console.log('[VideoRecipeUploaderScreen] Validations passed, proceeding to generate recipeId.');

    let recipeId;
    try {
      recipeId = uuidv4();
      console.log('[VideoRecipeUploaderScreen] recipeId generated:', recipeId);
    } catch (e: any) {
      console.error('[VideoRecipeUploaderScreen] Error generating recipeId with uuidv4:', e);
      Alert.alert('Error', `Could not generate a unique ID for the recipe: ${e.message || 'Unknown error'}`);
      return;
    }

    console.log('[VideoRecipeUploaderScreen] Proceeding to create metadata object.');
    let metadata: RecipeMetadataForEdgeFunction;
    try {
      metadata = {
        id: recipeId,
        title: title.trim(),
        description: description.trim(),
        prep_time_minutes: parseInt(prepTimeMinutes, 10) || 0,
        cook_time_minutes: parseInt(cookTimeMinutes, 10) || 0,
        servings: parseInt(servings, 10) || 0,
        is_public: isPublic,
        diet_tags: dietTags.map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0),
        ingredients: ingredients.filter(ing => ing.name.trim() !== '' && ing.quantity.trim() !== ''),
        preparation_steps: preparationSteps.filter(step => step.trim() !== ''),
      };
      console.log('[VideoRecipeUploaderScreen] Metadata object created successfully.');
    } catch (e: any) {
      console.error('[VideoRecipeUploaderScreen] Error creating metadata object:', e);
      Alert.alert('Error', `Could not prepare recipe data: ${e.message || 'Unknown error'}`);
      return;
    }
    
    console.log('[VideoRecipeUploaderScreen] Calling uploadRecipe with metadata:', metadata);
    try {
      await uploadRecipe(metadata);
      console.log('[VideoRecipeUploaderScreen] uploadRecipe call finished (returned or threw, check hook callbacks for actual success/error).');
    } catch (e: any) {
      console.error('[VideoRecipeUploaderScreen] Error directly from awaiting uploadRecipe call:', e);
      // This alert might be redundant if the hook's onUploadError also fires, but good for direct errors.
      Alert.alert('Upload Failed', `An unexpected error occurred during the upload attempt: ${e.message || 'Unknown error'}`);
    }
    // Success/error handling is now primarily managed by callbacks passed to useVideoUploader
  };

  useEffect(() => {
    if (uploadErrorHook) {
      // Alert is already handled by onUploadErrorHandler, this is for additional console logging or UI changes
      console.log("Upload error in screen effect: ", uploadErrorHook);
    }
  }, [uploadErrorHook]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.screenHeader}>Upload New Recipe</Text>

      <CollapsibleCard title="Video & Thumbnail" defaultCollapsed={false}>
        <View style={styles.videoPreviewWrapper}>
          {videoUri ? (
            <Video
              style={styles.videoElement}
              source={{ uri: videoUri }}
              useNativeControls={false} // Set to true for quick testing of video validity
              resizeMode={ResizeMode.CONTAIN}
              isLooping
              // shouldPlay // Auto-play can be annoying during form filling
            />
          ) : (
            <View style={styles.placeholderMedia}>
              <Icon name="videocam" size={48} color="#a0a0a0" />
              <Text style={styles.placeholderText}>No video selected</Text>
            </View>
          )}
        </View>

        {thumbnailUri && (
          <View style={styles.thumbnailPreviewWrapper}>
            <Text style={styles.sectionSubtitle}>Thumbnail Preview:</Text>
            <Image source={{ uri: thumbnailUri }} style={styles.thumbnailImage} resizeMode="cover" />
          </View>
        )}

        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={handleSelectVideo} >
            <Icon name={videoUri ? "switch-video" : "video-library"} size={20} color="#fff" />
            <Text style={styles.actionButtonText}>{videoUri ? 'Change Video' : 'Select Video *'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleSelectThumbnail} >
            <Icon name="photo-library" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>{thumbnailUri ? 'Change Thumbnail' : 'Select Thumbnail'}</Text>
          </TouchableOpacity>
        </View>
      </CollapsibleCard>

      <CollapsibleCard title="Recipe Basics">
        <Text style={styles.inputLabel}>Recipe Title *</Text>
        <TextInput style={styles.textInput} placeholder="e.g., My Awesome Pasta" value={title} onChangeText={setTitle} />
        <Text style={styles.inputLabel}>Description</Text>
        <TextInput style={[styles.textInput, styles.textArea]} placeholder="A short summary of your recipe" value={description} onChangeText={setDescription} multiline numberOfLines={4} />
      </CollapsibleCard>

      <CollapsibleCard title="Details & Timings">
        <View style={styles.row}>
          <View style={styles.column}>
            <Text style={styles.inputLabel}>Prep Time (minutes) *</Text>
            <TextInput style={styles.textInput} placeholder="e.g., 15" value={prepTimeMinutes} onChangeText={setPrepTimeMinutes} keyboardType="numeric" />
          </View>
          <View style={styles.column}>
            <Text style={styles.inputLabel}>Cook Time (minutes) *</Text>
            <TextInput style={styles.textInput} placeholder="e.g., 30" value={cookTimeMinutes} onChangeText={setCookTimeMinutes} keyboardType="numeric" />
          </View>
        </View>
        <Text style={styles.inputLabel}>Servings *</Text>
        <TextInput style={styles.textInput} placeholder="e.g., 4" value={servings} onChangeText={setServings} keyboardType="numeric" />
      </CollapsibleCard>

      <CollapsibleCard title="Preparation Steps">
        {preparationSteps.map((step, index) => (
          <View key={`step-${index}`} style={styles.listItemRow}>
            <Text style={styles.itemNumber}>{index + 1}.</Text>
            <TextInput
              style={[styles.textInput, styles.flexInput]}
              placeholder={`Describe step ${index + 1}`}
              value={step}
              onChangeText={(value) => handleStepChange(index, value)}
              multiline
            />
            {preparationSteps.length > 1 && (
              <TouchableOpacity style={styles.removeListItemButton} onPress={() => handleRemoveStep(index)} >
                <Icon name="delete-outline" size={24} color="#c83e4d" />
              </TouchableOpacity>
            )}
          </View>
        ))}
        <TouchableOpacity style={styles.addItemButton} onPress={handleAddStep} >
            <Icon name="add-circle-outline" size={22} color="#fff" />
            <Text style={styles.addItemButtonText}>Add Step</Text>
        </TouchableOpacity>
      </CollapsibleCard>

      <CollapsibleCard title="Ingredients">
        {ingredients.map((ingredient, index) => (
          <View key={`ingredient-${index}`} style={styles.ingredientRow}>
            <TextInput
              style={[styles.textInput, styles.ingredientNameInput]}
              placeholder="Name (e.g., Flour)"
              value={ingredient.name}
              onChangeText={value => handleIngredientChange(index, 'name', value)}
            />
            <TextInput
              style={[styles.textInput, styles.ingredientQtyInput]}
              placeholder="Qty"
              value={ingredient.quantity}
              onChangeText={value => handleIngredientChange(index, 'quantity', value)}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.textInput, styles.ingredientUnitInput]}
              placeholder="Unit (g, ml, cup)"
              value={ingredient.unit}
              onChangeText={value => handleIngredientChange(index, 'unit', value)}
            />
            {ingredients.length > 1 && (
              <TouchableOpacity style={styles.removeListItemButton} onPress={() => handleRemoveIngredient(index)} >
                <Icon name="delete-outline" size={24} color="#c83e4d" />
              </TouchableOpacity>
            )}
          </View>
        ))}
         {/* Add New Ingredient Form */}
        <View style={styles.addIngredientContainer}>
            <Text style={styles.sectionSubtitle}>Add New Ingredient:</Text>
            <View style={styles.ingredientRow}>
                <TextInput
                    style={[styles.textInput, styles.ingredientNameInput]}
                    placeholder="Ingredient Name"
                    value={newIngredientName}
                    onChangeText={setNewIngredientName}
                />
                <TextInput
                    style={[styles.textInput, styles.ingredientQtyInput]}
                    placeholder="Quantity"
                    value={newIngredientQuantity}
                    onChangeText={setNewIngredientQuantity}
                    keyboardType="numeric"
                />
                <TextInput
                    style={[styles.textInput, styles.ingredientUnitInput]}
                    placeholder="Unit"
                    value={newIngredientUnit}
                    onChangeText={setNewIngredientUnit}
                />
                 <TouchableOpacity style={[styles.addItemButton, styles.addIngredientButton]} onPress={handleAddIngredient}>
                    <Icon name="add" size={24} color="#fff" />
                </TouchableOpacity>
            </View>
        </View>
      </CollapsibleCard>
      
      <CollapsibleCard title="Tags & Visibility">
        <Text style={styles.inputLabel}>Dietary Tags (select multiple)</Text>
        <View style={styles.tagsSelectionContainer}>
          {DIET_TAGS_OPTIONS.map(tag => (
            <TouchableOpacity
              key={tag}
              style={[styles.tagOption, dietTags.includes(tag) && styles.tagSelected]}
              onPress={() => handleTagToggle(tag)} >
              <Text style={[styles.tagOptionText, dietTags.includes(tag) && styles.tagSelectedText]}>
                {tag}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.visibilityToggleContainer}>
          <Text style={styles.inputLabel}>Make Recipe Publicly Visible?</Text>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={isPublic ? '#22c55e' : '#f4f3f4'}
            ios_backgroundColor="#3e3e3e"
          />
        </View>
      </CollapsibleCard>

      <TouchableOpacity
        style={[styles.finalPublishButton, isUploading && styles.disabledButton]}
        onPress={handlePublish}
        disabled={isUploading} >
        {isUploading ? (
          <View style={styles.publishingIndicator}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.finalPublishButtonText}>
                {uploadProgress < 1 ? `Uploading ${Math.round(uploadProgress * 100)}%` : 'Processing...'}
            </Text>
          </View>
        ) : (
          <Text style={styles.finalPublishButtonText}>Publish Recipe</Text>
        )}
      </TouchableOpacity>

      {uploadErrorHook && <Text style={styles.errorFeedbackText}>Error: {uploadErrorHook}</Text>}
      <View style={{ height: 50 }} />{/* Spacer for bottom */}
    </ScrollView>
  );
};

// Combine and refine styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f7fc', // Light background
  },
  contentContainer: {
    paddingHorizontal: Platform.OS === 'web' ? 30 : 15,
    paddingVertical: 20,
  },
  screenHeader: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50', // Darker blue/grey
    textAlign: 'center',
    marginBottom: 25,
  },
  cardContainer: { // Renamed from 'card' to avoid conflict if Card component is imported
    backgroundColor: '#ffffff',
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7', // Lighter border
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#34495e', // Slightly muted title
  },
  // cardIcon is handled by Icon component directly
  cardContent: {
    padding: 15,
  },
  videoPreviewWrapper: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#e0e4e8',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    overflow: 'hidden', // Ensures Video respects borderRadius
  },
  videoElement: {
    width: '100%',
    height: '100%',
  },
  placeholderMedia: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 10,
    fontSize: 14,
    color: '#7f8c8d',
  },
  thumbnailPreviewWrapper: {
    alignItems: 'center',
    marginVertical: 15,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#34495e',
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  thumbnailImage: {
    width: '80%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dfe6e9',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3498db', // Primary blue
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 25, // More rounded
    flex: 1,
    marginHorizontal: 5,
    justifyContent: 'center',
    elevation: 2,
  },
  actionButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#555',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#bdc3c7', // Softer border
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    marginBottom: 15,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    flex: 1,
    marginHorizontal: 5,
  },
  listItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start', // Align items to the start for multiline text input
    marginBottom: 10,
  },
  itemNumber: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 10,
    marginTop: 12, // Align with text input
    color: '#7f8c8d',
  },
  flexInput: {
    flex: 1,
    marginBottom: 0, // Remove bottom margin as it's part of a row
  },
  removeListItemButton: {
    padding: 10, // Make it easier to tap
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2ecc71', // Green for add
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    justifyContent: 'center',
    marginTop: 10,
    elevation: 2,
  },
  addItemButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  ingredientNameInput: { flex: 2.5, marginRight: 8, marginBottom: 0 },
  ingredientQtyInput: { flex: 1, marginRight: 8, marginBottom: 0 },
  ingredientUnitInput: { flex: 1.5, marginBottom: 0 },
  addIngredientContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
  },
   addIngredientButton: {
    paddingVertical: 10, // Adjust padding for smaller button
    paddingHorizontal: 10,
    marginLeft: 8,
    height: 48, // Match text input height
    width: 48,  // Make it square for an icon button
    borderRadius: 8, 
  },
  tagsSelectionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  tagOption: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#e9ecef',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tagSelected: {
    backgroundColor: '#3498db',
    borderColor: '#2980b9',
  },
  tagOptionText: {
    color: '#34495e',
    fontWeight: '500',
  },
  tagSelectedText: {
    color: '#fff',
  },
  visibilityToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#eef2f7',
    marginTop: 10,
  },
  finalPublishButton: {
    backgroundColor: '#e67e22', // Orange for publish
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    elevation: 2,
    minHeight: 50, // Ensure consistent height
  },
  disabledButton: {
    backgroundColor: '#fabc8a', // Lighter orange when disabled
  },
  finalPublishButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10, // If icon is present
  },
  publishingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorFeedbackText: { // Renamed from errorText
    color: '#e74c3c', // Red for error
    textAlign: 'center',
    marginTop: 15,
    fontSize: 15,
    fontWeight: '500',
  },
});

export default VideoRecipeUploaderScreen; 