import React, { useState } from 'react';
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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainStackParamList } from '../../navigation/types';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Video from 'react-native-video';
import { launchImageLibrary } from 'react-native-image-picker';
import { useVideoUploader } from '../../hooks/useVideoUploader';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type VideoRecipeUploaderScreenProps = NativeStackScreenProps<MainStackParamList, 'VideoRecipeUploader'>;

interface Ingredient {
  id: string;
  name: string;
  quantity: string;
  unit: string;
}

const DIET_TAGS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Keto',
  'Paleo',
  'Low-Carb',
  'High-Protein',
];

const VideoRecipeUploaderScreen: React.FC<VideoRecipeUploaderScreenProps> = ({ navigation }) => {
  const navigationProp = useNavigation<NativeStackNavigationProp<MainStackParamList, 'VideoRecipeUploader'>>();
  const { uploadRecipe, isUploading } = useVideoUploader();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [dietTags, setDietTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [preparationSteps, setPreparationSteps] = useState<string[]>(['']);
  const [prepTimeMinutes, setPrepTimeMinutes] = useState<string>('');
  const [cookTimeMinutes, setCookTimeMinutes] = useState<string>('');
  const [servings, setServings] = useState<string>('');

  // New ingredient state
  const [newIngredient, setNewIngredient] = useState<Partial<Ingredient>>({
    name: '',
    quantity: '',
    unit: '',
  });

  const handleSelectVideo = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'video',
        quality: 1,
      });

      if (result.assets && result.assets[0]?.uri) {
        setVideoUri(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select video');
    }
  };

  const handleTagToggle = (tag: string) => {
    setDietTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleAddIngredient = () => {
    if (newIngredient.name && newIngredient.quantity && newIngredient.unit) {
      setIngredients(prev => [...prev, {
        id: Date.now().toString(),
        name: newIngredient.name!,
        quantity: newIngredient.quantity!,
        unit: newIngredient.unit!,
      }]);
      setNewIngredient({ name: '', quantity: '', unit: '' });
    }
  };

  const handleRemoveIngredient = (id: string) => {
    setIngredients(prev => prev.filter(ing => ing.id !== id));
  };

  const handleAddStep = () => {
    setPreparationSteps(prev => [...prev, '']);
  };

  const handleRemoveStep = (index: number) => {
    setPreparationSteps(prev => prev.filter((_, i) => i !== index));
  };

  const handleStepChange = (index: number, value: string) => {
    setPreparationSteps(prev => {
      const newSteps = [...prev];
      newSteps[index] = value;
      return newSteps;
    });
  };

  const handlePublish = async () => {
    if (!videoUri) {
      Alert.alert('Error', 'Please select a video first');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a title');
      return;
    }

    if (!prepTimeMinutes || !cookTimeMinutes || !servings) {
      Alert.alert('Error', 'Please fill in all time and serving information');
      return;
    }

    if (preparationSteps.some(step => !step.trim())) {
      Alert.alert('Error', 'Please fill in all preparation steps');
      return;
    }

    try {
      await uploadRecipe(videoUri, {
        title,
        description,
        ingredients: ingredients.map(ing => ({
          name: ing.name,
          quantity: ing.quantity,
          unit: ing.unit,
        })),
        diet_tags: dietTags,
        preparation_steps: preparationSteps,
        prep_time_minutes: parseInt(prepTimeMinutes, 10),
        cook_time_minutes: parseInt(cookTimeMinutes, 10),
        servings: parseInt(servings, 10),
        is_public: isPublic,
      });
      
      Alert.alert('Success', 'Recipe uploaded successfully');
      navigationProp.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to upload recipe');
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Video Preview */}
      <View style={styles.videoContainer}>
        {videoUri ? (
          <Video
            source={{ uri: videoUri }}
            style={styles.video}
            resizeMode="cover"
            repeat
            paused={false}
          />
        ) : (
          <View style={styles.placeholderVideo}>
            <Icon name="videocam" size={48} color="#666" />
            <Text style={styles.placeholderText}>No video selected</Text>
          </View>
        )}
        <View style={styles.videoControls}>
          <TouchableOpacity
            style={styles.videoButton}
            onPress={handleSelectVideo}
          >
            <Icon name="photo-library" size={24} color="#fff" />
            <Text style={styles.videoButtonText}>Select Video</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Form Fields */}
      <View style={styles.form}>
        {/* Title */}
        <TextInput
          style={styles.input}
          placeholder="Recipe Title"
          value={title}
          onChangeText={setTitle}
        />

        {/* Description */}
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />

        {/* Time and Servings */}
        <View style={styles.timeAndServingsContainer}>
          <View style={styles.timeInputContainer}>
            <Text style={styles.inputLabel}>Prep Time (minutes)</Text>
            <TextInput
              style={[styles.input, styles.timeInput]}
              placeholder="30"
              value={prepTimeMinutes}
              onChangeText={setPrepTimeMinutes}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.timeInputContainer}>
            <Text style={styles.inputLabel}>Cook Time (minutes)</Text>
            <TextInput
              style={[styles.input, styles.timeInput]}
              placeholder="45"
              value={cookTimeMinutes}
              onChangeText={setCookTimeMinutes}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.timeInputContainer}>
            <Text style={styles.inputLabel}>Servings</Text>
            <TextInput
              style={[styles.input, styles.timeInput]}
              placeholder="4"
              value={servings}
              onChangeText={setServings}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Preparation Steps */}
        <Text style={styles.sectionTitle}>Preparation Steps</Text>
        {preparationSteps.map((step, index) => (
          <View key={index} style={styles.stepContainer}>
            <Text style={styles.stepNumber}>Step {index + 1}</Text>
            <TextInput
              style={[styles.input, styles.stepInput]}
              placeholder={`Step ${index + 1}...`}
              value={step}
              onChangeText={(value) => handleStepChange(index, value)}
              multiline
            />
            {preparationSteps.length > 1 && (
              <TouchableOpacity
                style={styles.removeStepButton}
                onPress={() => handleRemoveStep(index)}
              >
                <Icon name="close" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        ))}
        <TouchableOpacity
          style={styles.addStepButton}
          onPress={handleAddStep}
        >
          <Icon name="add" size={24} color="#fff" />
          <Text style={styles.addStepButtonText}>Add Step</Text>
        </TouchableOpacity>

        {/* Diet Tags */}
        <Text style={styles.sectionTitle}>Dietary Tags</Text>
        <View style={styles.tagsContainer}>
          {DIET_TAGS.map(tag => (
            <TouchableOpacity
              key={tag}
              style={[
                styles.tag,
                dietTags.includes(tag) && styles.selectedTag,
              ]}
              onPress={() => handleTagToggle(tag)}
            >
              <Text style={[
                styles.tagText,
                dietTags.includes(tag) && styles.selectedTagText,
              ]}>
                {tag}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Ingredients */}
        <Text style={styles.sectionTitle}>Ingredients</Text>
        <View style={styles.ingredientsList}>
          {ingredients.map(ingredient => (
            <View key={ingredient.id} style={styles.ingredientItem}>
              <Text style={styles.ingredientText}>
                {ingredient.quantity} {ingredient.unit} {ingredient.name}
              </Text>
              <TouchableOpacity
                onPress={() => handleRemoveIngredient(ingredient.id)}
                style={styles.removeButton}
              >
                <Icon name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Add Ingredient Form */}
        <View style={styles.addIngredientForm}>
          <TextInput
            style={[styles.input, styles.ingredientInput]}
            placeholder="Ingredient name"
            value={newIngredient.name}
            onChangeText={name => setNewIngredient(prev => ({ ...prev, name }))}
          />
          <TextInput
            style={[styles.input, styles.quantityInput]}
            placeholder="Qty"
            value={newIngredient.quantity}
            onChangeText={quantity => setNewIngredient(prev => ({ ...prev, quantity }))}
            keyboardType="numeric"
          />
          <TextInput
            style={[styles.input, styles.unitInput]}
            placeholder="Unit"
            value={newIngredient.unit}
            onChangeText={unit => setNewIngredient(prev => ({ ...prev, unit }))}
          />
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleAddIngredient}
          >
            <Icon name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Visibility Toggle */}
        <View style={styles.visibilityContainer}>
          <Text style={styles.visibilityText}>Make Public</Text>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ false: '#767577', true: '#22c55e' }}
            thumbColor={isPublic ? '#fff' : '#f4f3f4'}
          />
        </View>

        {/* Publish Button */}
        <TouchableOpacity
          style={[styles.publishButton, isUploading && styles.publishButtonDisabled]}
          onPress={handlePublish}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.publishButtonText}>Publish Recipe</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  videoContainer: {
    width: '100%',
    height: 240,
    backgroundColor: '#f0f0f0',
    marginBottom: 20,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  placeholderVideo: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 8,
    color: '#666',
  },
  videoControls: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  videoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  videoButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
  },
  form: {
    padding: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    marginBottom: 8,
  },
  selectedTag: {
    backgroundColor: '#22c55e',
  },
  tagText: {
    color: '#666',
  },
  selectedTagText: {
    color: '#fff',
  },
  ingredientsList: {
    marginBottom: 16,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  ingredientText: {
    flex: 1,
    fontSize: 16,
  },
  removeButton: {
    padding: 4,
  },
  addIngredientForm: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  ingredientInput: {
    flex: 2,
    marginRight: 8,
    marginBottom: 0,
  },
  quantityInput: {
    flex: 1,
    marginRight: 8,
    marginBottom: 0,
  },
  unitInput: {
    flex: 1,
    marginRight: 8,
    marginBottom: 0,
  },
  addButton: {
    backgroundColor: '#22c55e',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  visibilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  visibilityText: {
    fontSize: 16,
    color: '#333',
  },
  publishButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  publishButtonDisabled: {
    opacity: 0.7,
  },
  publishButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  timeAndServingsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  timeInputContainer: {
    flex: 1,
    marginHorizontal: 4,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  timeInput: {
    marginBottom: 0,
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
    marginTop: 12,
  },
  stepInput: {
    flex: 1,
    marginBottom: 0,
  },
  removeStepButton: {
    padding: 8,
    marginLeft: 8,
  },
  addStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    justifyContent: 'center',
  },
  addStepButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default VideoRecipeUploaderScreen; 