import React from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
// Temporarily use expo-av due to expo-video import issues
// TODO: Switch back to expo-video once import issues are resolved
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av'; // Import AVPlaybackStatus for onLoad type
import { useNavigation } from '@react-navigation/native';
import { MainStackParamList } from '../navigation/types'; // Adjust path if needed
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Define the type for the navigation prop within this context
type ProfileScreenNavigationProp = NativeStackNavigationProp<
  MainStackParamList, // Assuming RecipeDetail is in the MainStack
  'RecipeDetail'
>;

// Define the structure of the item prop, matching VideoPostData from ProfileScreen
interface VideoPostData {
  recipe_id: string;
  recipe_name: string;
  video_url: string;
}

interface UploadGridItemProps {
  item: VideoPostData;
}

export const UploadGridItem: React.FC<UploadGridItemProps> = ({ item }) => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();

  const handlePress = () => {
    console.log('Navigating to RecipeDetail for ID:', item.recipe_id);
    // Navigate to RecipeDetailScreen, passing the recipe_id as 'id' parameter
    navigation.navigate('RecipeDetail', { id: item.recipe_id });
  };

  const handleLoadStart = () => {
    console.log(`UploadGridItem (${item.recipe_id}): Video load start...`);
  };

  const handleLoad = (status: AVPlaybackStatus) => {
    // Check if status is loaded, expo-av might have different status properties
    if (status.isLoaded) {
      // console.log(`UploadGridItem (${item.recipe_id}): Video loaded successfully.`); // Can be commented out later
    } else if (status.error) {
       console.error(`UploadGridItem (${item.recipe_id}): Video load error (from onLoad):`, status.error);
    }
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.8}>
      <Video
        style={styles.video}
        source={{
          uri: item.video_url,
        }}
        useNativeControls={false} // Hide default controls
        resizeMode={ResizeMode.COVER} // Use ResizeMode from expo-av
        isLooping={false}
        shouldPlay={false} // IMPORTANT: Do not autoplay in grid
        onError={(error: string) => 
          console.error(`Error loading video ${item.recipe_id} (onError): ${error}`)
        }
        onLoadStart={handleLoadStart} // Added load start handler
        onLoad={handleLoad} // Added load handler
        usePoster={true} // Added usePoster prop
        posterStyle={{ resizeMode: 'cover' }} // Style for the poster image
      />
      {/* Optional: Add an overlay with recipe name or icon */}
      {/* <View style={styles.overlay}>
        <Text style={styles.overlayText} numberOfLines={1}>{item.recipe_name}</Text>
      </View> */}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1/3, // Takes up 1/3 of the row (for numColumns=3)
    aspectRatio: 1, // Creates a square item
    margin: 1.5, // Small margin between items
    overflow: 'hidden', // Ensure video doesn't spill out
  },
  video: {
    ...StyleSheet.absoluteFillObject, // Fill the container
    width: '100%', // Added explicit width
    height: '100%', // Added explicit height
  },
  // Optional overlay styles
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 4,
  },
  overlayText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default UploadGridItem; 