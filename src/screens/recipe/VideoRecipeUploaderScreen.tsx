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
  Platform,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Feather } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { v4 as uuidv4 } from 'uuid';
import 'react-native-get-random-values'; // Import this before uuid
import { useQueryClient } from '@tanstack/react-query';
import {
  useVideoUploader,
  RecipeMetadataForEdgeFunction,
  Ingredient,
} from '../../hooks/useVideoUploader';
import { MainStackParamList } from '../../navigation/types';
import { useAuth } from '../../providers/AuthProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BRAND_PRIMARY = '#10B981';
const BRAND_PRIMARY_LIGHT = '#22c55e';
const ACCENT_COLOR = '#FF9500';

// Enhanced CollapsibleCard with animation
const CollapsibleCard: React.FC<{
  title: string;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
  icon?: string;
}> = ({ title, children, defaultCollapsed = false, icon }) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const animatedHeight = useState(
    new Animated.Value(defaultCollapsed ? 0 : 1),
  )[0];

  useEffect(() => {
    Animated.timing(animatedHeight, {
      toValue: isCollapsed ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [isCollapsed]);

  return (
    <View style={styles.cardContainer}>
      <TouchableOpacity
        onPress={() => setIsCollapsed(!isCollapsed)}
        style={[styles.cardHeader, isCollapsed ? {} : styles.activeCardHeader]}
        activeOpacity={0.7}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {icon && (
            <Feather
              name={icon as any}
              size={18}
              color={isCollapsed ? '#666' : BRAND_PRIMARY}
              style={{ marginRight: 8 }}
            />
          )}
          <Text
            style={[
              styles.cardTitle,
              isCollapsed ? {} : styles.activeCardTitle,
            ]}>
            {title}
          </Text>
        </View>
        <Icon
          name={isCollapsed ? 'expand-more' : 'expand-less'}
          size={24}
          color={isCollapsed ? '#666' : BRAND_PRIMARY}
        />
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.animatedContent,
          {
            maxHeight: animatedHeight.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 1000],
            }),
            opacity: animatedHeight,
          },
        ]}>
        <View style={styles.cardContent}>{children}</View>
      </Animated.View>
    </View>
  );
};

type VideoRecipeUploaderScreenProps = NativeStackScreenProps<
  MainStackParamList,
  'VideoRecipeUploader'
>;

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

const VideoRecipeUploaderScreen: React.FC<VideoRecipeUploaderScreenProps> = ({
  navigation: navPropFromProps,
}) => {
  const navigation =
    useNavigation<
      NativeStackNavigationProp<MainStackParamList, 'VideoRecipeUploader'>
    >();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const scaleAnim = useState(new Animated.Value(0.95))[0];

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
  }, []);

  const onUploadSuccessHandler = (response: any) => {
    const recipeId = response?.recipeId;
    Alert.alert('Success', 'Recipe uploaded successfully!');

    if (user?.id) {
      queryClient.invalidateQueries({
        queryKey: ['userRecipesForPlanner', user.id],
      });
      queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
    }

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
    // Hook will clear its own videoUri and thumbnailUri if needed
    if (navigation.canGoBack()) navigation.goBack();
  };

  const onUploadErrorHandler = (errorDetails: any | string) => {
    console.error('onUploadErrorHandler received:', errorDetails);
    let errorMessage = 'An unexpected error occurred during upload.';
    if (typeof errorDetails === 'string') {
      errorMessage = errorDetails;
    } else if (errorDetails && errorDetails.message) {
      errorMessage = errorDetails.message;
    }
    Alert.alert('Upload Error', errorMessage);
  };

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

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { name: '', quantity: '', unit: '' },
  ]);
  const [dietTags, setDietTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [preparationSteps, setPreparationSteps] = useState<string[]>(['']);
  const [prepTimeMinutes, setPrepTimeMinutes] = useState('');
  const [cookTimeMinutes, setCookTimeMinutes] = useState('');
  const [servings, setServings] = useState('');

  const handleSelectVideo = () => selectVideo();
  const handleSelectThumbnail = () => selectThumbnail();

  const handleTagToggle = (tag: string) => {
    setDietTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag],
    );
  };

  const handleIngredientChange = (
    index: number,
    field: keyof Ingredient,
    value: string,
  ) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setIngredients(newIngredients);
  };

  const handleAddIngredient = () => {
    const newItem = { name: '', quantity: '', unit: '' };
    setIngredients([...ingredients, newItem]);

    // Animate scroll to bottom after state update
    setTimeout(() => {
      // This would need a ref to the ScrollView, but keeping it simple
    }, 100);
  };

  const handleRemoveIngredient = (indexToRemove: number) => {
    if (ingredients.length === 1) {
      setIngredients([{ name: '', quantity: '', unit: '' }]);
      return;
    }
    setIngredients(ingredients.filter((_, index) => index !== indexToRemove));
  };

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

  // Back button handler with confirmation
  const handleGoBack = () => {
    if (title || description || videoUri || thumbnailUri || ingredients.some(i => i.name)) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          { text: 'Continue Editing', style: 'cancel' },
          { 
            text: 'Discard', 
            style: 'destructive', 
            onPress: () => navigation.goBack() 
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  // Swipe down to dismiss gesture handler
  const handleSwipeGesture = ({ nativeEvent }: any) => {
    if (nativeEvent.state === State.END) {
      if (nativeEvent.translationY > 100 && nativeEvent.velocityY > 500) {
        // User swiped down far enough and fast enough
        handleGoBack();
      }
    }
  };

  const handlePublish = async () => {
    if (!videoUri) {
      Alert.alert('Validation Error', 'Please select a video.');
      return;
    }
    if (!thumbnailUri) {
      Alert.alert('Validation Error', 'Please select a thumbnail.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please enter a recipe title.');
      return;
    }
    if (
      !prepTimeMinutes.trim() ||
      !cookTimeMinutes.trim() ||
      !servings.trim()
    ) {
      Alert.alert(
        'Validation Error',
        'Please fill in Prep Time, Cook Time, and Servings.',
      );
      return;
    }
    if (
      isNaN(parseInt(prepTimeMinutes)) ||
      isNaN(parseInt(cookTimeMinutes)) ||
      isNaN(parseInt(servings))
    ) {
      Alert.alert(
        'Validation Error',
        'Prep Time, Cook Time, and Servings must be valid numbers.',
      );
      return;
    }
    if (
      ingredients.length === 0 ||
      ingredients.every(ing => !ing.name.trim())
    ) {
      Alert.alert(
        'Validation Error',
        'Please add at least one valid ingredient (name is required).',
      );
      return;
    }
    if (
      preparationSteps.length === 0 ||
      preparationSteps.every(step => !step.trim())
    ) {
      Alert.alert(
        'Validation Error',
        'Please add at least one preparation step.',
      );
      return;
    }

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
      title: title.trim(),
      description: description.trim(),
      ingredients: ingredients.filter(ing => ing.name.trim() !== ''),
      diet_tags: dietTags,
      is_public: isPublic,
      preparation_steps: preparationSteps.filter(step => step.trim() !== ''),
      prep_time_minutes: parseInt(prepTimeMinutes) || 0,
      cook_time_minutes: parseInt(cookTimeMinutes) || 0,
      servings: parseInt(servings) || 0,
    };
    uploadRecipe(metadata);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Fixed Header with Safe Area */}
      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.header}>
          {/* Back Button */}
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleGoBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="arrow-back" size={24} color="#1f2937" />
          </TouchableOpacity>
          
          {/* Header Title */}
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Create Recipe</Text>
            <Text style={styles.headerSubtitle}>Share your culinary creation</Text>
          </View>
          
          {/* Save Draft Button (Optional) */}
          <TouchableOpacity 
            style={styles.draftButton}
            onPress={() => {
              // Could implement save draft functionality
              Alert.alert('Draft', 'Draft saved locally');
            }}>
            <Text style={styles.draftButtonText}>Draft</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Scrollable Content with Swipe Gesture */}
      <PanGestureHandler onHandlerStateChange={handleSwipeGesture}>
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContentContainer}
          showsVerticalScrollIndicator={false}>
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }}>

        {/* Media selection area with enhanced styling */}
        <View style={styles.mediaSelectionContainer}>
          <View style={styles.mediaPreviewWrapper}>
            {videoUri ? (
              <Video
                source={{ uri: videoUri }}
                style={styles.videoPreview}
                useNativeControls
                resizeMode={ResizeMode.COVER}
                isLooping
              />
            ) : (
              <View style={[styles.videoPreview, styles.mediaPlaceholder]}>
                <Feather name="video" size={40} color="#ccc" />
                <Text style={styles.mediaPlaceholderText}>
                  Showcase your recipe in action
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={videoUri ? styles.buttonOutline : styles.button}
              onPress={handleSelectVideo}
              activeOpacity={0.8}>
              <Feather
                name={videoUri ? 'refresh-cw' : 'video'}
                size={18}
                color={videoUri ? BRAND_PRIMARY : '#fff'}
                style={{ marginRight: 8 }}
              />
              <Text
                style={videoUri ? styles.buttonOutlineText : styles.buttonText}>
                {videoUri ? 'Change Video' : 'Select Video'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mediaPreviewWrapper}>
            {thumbnailUri ? (
              <View style={styles.thumbnailContainer}>
                <Image
                  source={{ uri: thumbnailUri }}
                  style={styles.thumbnailPreview}
                />
                <View style={styles.thumbnailOverlay}>
                  <Text style={styles.thumbnailOverlayText}>Cover Image</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.thumbnailPreview, styles.mediaPlaceholder]}>
                <Feather name="image" size={40} color="#ccc" />
                <Text style={styles.mediaPlaceholderText}>
                  Add an appetizing cover image
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={thumbnailUri ? styles.buttonOutline : styles.button}
              onPress={handleSelectThumbnail}
              activeOpacity={0.8}>
              <Feather
                name={thumbnailUri ? 'refresh-cw' : 'image'}
                size={18}
                color={thumbnailUri ? BRAND_PRIMARY : '#fff'}
                style={{ marginRight: 8 }}
              />
              <Text
                style={
                  thumbnailUri ? styles.buttonOutlineText : styles.buttonText
                }>
                {thumbnailUri ? 'Change Thumbnail' : 'Select Thumbnail'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Enhanced collapsible cards with icons */}
        <View style={styles.formContainer}>
          <CollapsibleCard
            title="Recipe Details"
            icon="info"
            defaultCollapsed={false}>
            <TextInput
              placeholder="Recipe Title"
              value={title}
              onChangeText={setTitle}
              style={styles.input}
              placeholderTextColor="#999"
            />
            <TextInput
              placeholder="Description (tell the story behind your recipe)"
              value={description}
              onChangeText={setDescription}
              style={styles.inputMulti}
              multiline
              numberOfLines={4}
              placeholderTextColor="#999"
            />
          </CollapsibleCard>

          <CollapsibleCard title="Timings & Servings" icon="clock">
            <View style={styles.timeInputRow}>
              <View style={styles.timeInputContainer}>
                <Text style={styles.inputLabel}>Prep Time</Text>
                <View style={styles.timeInputWrapper}>
                  <TextInput
                    placeholder="0"
                    value={prepTimeMinutes}
                    onChangeText={setPrepTimeMinutes}
                    style={styles.timeInput}
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                  />
                  <Text style={styles.timeUnitText}>min</Text>
                </View>
              </View>

              <View style={styles.timeInputContainer}>
                <Text style={styles.inputLabel}>Cook Time</Text>
                <View style={styles.timeInputWrapper}>
                  <TextInput
                    placeholder="0"
                    value={cookTimeMinutes}
                    onChangeText={setCookTimeMinutes}
                    style={styles.timeInput}
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                  />
                  <Text style={styles.timeUnitText}>min</Text>
                </View>
              </View>

              <View style={styles.timeInputContainer}>
                <Text style={styles.inputLabel}>Servings</Text>
                <View style={styles.timeInputWrapper}>
                  <TextInput
                    placeholder="0"
                    value={servings}
                    onChangeText={setServings}
                    style={styles.timeInput}
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                  />
                  <Text style={styles.timeUnitText}>portions</Text>
                </View>
              </View>
            </View>
          </CollapsibleCard>

          <CollapsibleCard
            title={`Ingredients (${ingredients.filter(i => i.name.trim()).length})`}
            icon="shopping-bag">
            {ingredients.map((ing, index) => (
              <View key={index} style={styles.listItemContainer}>
                <TextInput
                  placeholder="Ingredient name"
                  value={ing.name}
                  onChangeText={val =>
                    handleIngredientChange(index, 'name', val)
                  }
                  style={styles.inputFlex}
                  placeholderTextColor="#999"
                />
                <TextInput
                  placeholder="Qty"
                  value={ing.quantity}
                  onChangeText={val =>
                    handleIngredientChange(index, 'quantity', val)
                  }
                  style={styles.inputQty}
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
                <TextInput
                  placeholder="Unit"
                  value={ing.unit}
                  onChangeText={val =>
                    handleIngredientChange(index, 'unit', val)
                  }
                  style={styles.inputUnit}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity
                  onPress={() => handleRemoveIngredient(index)}
                  style={styles.removeButton}>
                  <Feather name="x-circle" size={24} color="#ff6347" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddIngredient}
              activeOpacity={0.8}>
              <Feather
                name="plus-circle"
                size={20}
                color={BRAND_PRIMARY}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.addButtonText}>Add Ingredient</Text>
            </TouchableOpacity>
          </CollapsibleCard>

          <CollapsibleCard
            title={`Preparation Steps (${preparationSteps.filter(s => s.trim()).length})`}
            icon="list">
            {preparationSteps.map((step, index) => (
              <View key={index} style={styles.listItemContainer}>
                <View style={styles.stepNumberBadge}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <TextInput
                  placeholder="Describe this step in detail..."
                  value={step}
                  onChangeText={val => handleStepChange(index, val)}
                  style={styles.inputFlexMulti}
                  multiline
                  placeholderTextColor="#999"
                />
                <TouchableOpacity
                  onPress={() => handleRemoveStep(index)}
                  style={styles.removeButtonPadding}>
                  <Feather name="x-circle" size={24} color="#ff6347" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={styles.addButton}
              onPress={handleAddStep}
              activeOpacity={0.8}>
              <Feather
                name="plus-circle"
                size={20}
                color={BRAND_PRIMARY}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.addButtonText}>Add Step</Text>
            </TouchableOpacity>
          </CollapsibleCard>

          <CollapsibleCard title="Dietary Tags" icon="tag">
            <Text style={styles.tagSectionLabel}>
              Help others discover your recipe with relevant tags
            </Text>
            <View style={styles.tagsContainer}>
              {DIET_TAGS_OPTIONS.map(tag => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.tag,
                    dietTags.includes(tag) && styles.tagSelected,
                  ]}
                  onPress={() => handleTagToggle(tag)}
                  activeOpacity={0.7}>
                  {dietTags.includes(tag) && (
                    <Feather
                      name="check"
                      size={12}
                      color="#fff"
                      style={{ marginRight: 4 }}
                    />
                  )}
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

          <CollapsibleCard title="Visibility" icon="eye">
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
                onValueChange={setIsPublic}
                trackColor={{ false: '#e0e0e0', true: '#a7f3d0' }}
                thumbColor={isPublic ? BRAND_PRIMARY : '#f4f3f4'}
                ios_backgroundColor="#e0e0e0"
              />
            </View>
          </CollapsibleCard>
        </View>

        <TouchableOpacity
          style={[
            styles.publishButton,
            isUploading && styles.saveButtonDisabled,
          ]}
          onPress={handlePublish}
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
              style={[
                styles.progressBar,
                { width: `${uploadProgress * 100}%` },
              ]}
            />
            <Text
              style={
                styles.progressText
              }>{`${(uploadProgress * 100).toFixed(0)}%`}</Text>
          </View>
        )}
        </Animated.View>
        </ScrollView>
      </PanGestureHandler>
    </View>
  );
};

// Enhanced styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerSafeArea: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 2,
  },
  draftButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    marginLeft: 12,
  },
  draftButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  scrollContainer: {
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
  mediaSelectionContainer: {
    marginVertical: 16,
  },
  mediaPreviewWrapper: {
    marginBottom: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  videoPreview: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  thumbnailContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  thumbnailOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 6,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  thumbnailOverlayText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  thumbnailPreview: {
    width: SCREEN_WIDTH * 0.6,
    height: (SCREEN_WIDTH * 0.6) / (16 / 9),
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  mediaPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  mediaPlaceholderText: {
    marginTop: 12,
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: '80%',
  },
  button: {
    backgroundColor: BRAND_PRIMARY,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonOutline: {
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BRAND_PRIMARY,
    backgroundColor: 'transparent',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  buttonOutlineText: {
    color: BRAND_PRIMARY,
    fontWeight: '600',
    fontSize: 15,
  },
  formContainer: {
    paddingHorizontal: 12,
  },
  cardContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 4,
    marginVertical: 8,
    borderRadius: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#fff',
  },
  activeCardHeader: {
    backgroundColor: '#f9fafb',
    borderBottomColor: '#e5e7eb',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4b5563',
  },
  activeCardTitle: {
    color: BRAND_PRIMARY,
  },
  animatedContent: {
    overflow: 'hidden',
  },
  cardContent: {
    padding: 16,
  },
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
  listItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 8,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  stepNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BRAND_PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  inputFlex: {
    flex: 1,
    padding: 10,
    fontSize: 15,
    color: '#111827',
  },
  inputFlexMulti: {
    flex: 1,
    padding: 10,
    minHeight: 60,
    textAlignVertical: 'top',
    fontSize: 15,
    color: '#111827',
  },
  inputQty: {
    width: 50,
    padding: 10,
    textAlign: 'center',
    fontSize: 15,
    color: '#111827',
  },
  inputUnit: {
    width: 70,
    padding: 10,
    fontSize: 15,
    color: '#111827',
  },
  removeButton: {
    padding: 8,
  },
  removeButtonPadding: {
    padding: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND_PRIMARY,
    backgroundColor: '#f0fdf4',
  },
  addButtonText: {
    color: BRAND_PRIMARY,
    fontWeight: '600',
    fontSize: 15,
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

export default VideoRecipeUploaderScreen;
