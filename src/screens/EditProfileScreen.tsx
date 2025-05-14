import React, { useState, useEffect } from 'react';
import { 
  View, 
  ScrollView, 
  Alert, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  ActivityIndicator 
} from 'react-native';
import { AvatarEditorAndBio } from '../components/AvatarEditorAndBio'; // Check path
import { Button } from 'react-native-paper';
// import { COLORS } from '../constants/colors'; // Removed invalid import
import { supabase } from '../services/supabase'; // Corrected path
import { useQueryClient } from '@tanstack/react-query'; // Import useQueryClient
import Icon from 'react-native-vector-icons/MaterialIcons'; // For CollapsibleCard

// Placeholder colors - replace with your actual theme colors later
const PLACEHOLDER_BACKGROUND = '#f5f5f5';
const PLACEHOLDER_PRIMARY = '#22c55e'; // Using the green from profile

// Reusable CollapsibleCard (copied from EditRecipeScreen.tsx)
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

// Define route params type if not already defined elsewhere
// Assuming MainStackParamList includes EditProfileScreen
type EditProfileRouteParams = {
  initialProfileData?: { 
    bio?: string | null;
    avatar_url?: string | null;
    username?: string | null; // Add username to route params
  };
  userId?: string;
};

// Define navigation prop type if needed
// import { NativeStackScreenProps } from '@react-navigation/native-stack';
// type Props = NativeStackScreenProps<MainStackParamList, 'EditProfileScreen'>;
// const EditProfileScreen = ({ navigation, route }: Props) => { ... }

const EditProfileScreen = ({ navigation, route }: any) => { // Using any temporarily for navigation/route types
  const queryClient = useQueryClient(); // Get queryClient instance
  const { initialProfileData = {}, userId } = route.params || {}; // Ensure initialProfileData is an object
  
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialProfileData) {
      setBio(initialProfileData.bio || '');
      setAvatarUrl(initialProfileData.avatar_url || null);
      setUsername(initialProfileData.username || ''); // Populate username
      
      // Set screen title dynamically based on username
      if (initialProfileData.username) {
        navigation.setOptions({ title: `Editing: ${initialProfileData.username}` });
      } else {
        navigation.setOptions({ title: 'Edit Profile' });
      }
    }
  }, [initialProfileData, navigation]);

  // Handler for when AvatarEditorAndBio successfully uploads/changes URL
  const handleAvatarUrlUpdate = (newUrl: string) => {
    setAvatarUrl(newUrl);
  };

  const updateProfile = async () => {
    if (!userId) {
      Alert.alert("Error", "User ID missing. Cannot update profile.");
      return;
    }
    if (!username.trim()) { // Ensure username is not just whitespace
        Alert.alert("Validation Error", "Username cannot be empty.");
        return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.rpc('update_profile', {
        p_avatar_url: avatarUrl,
        p_bio: bio,
        p_username: username.trim(), // Send trimmed username
      });

      if (error) throw error;

      Alert.alert("Profile Updated", "Your profile has been saved.", [
        { text: "OK", onPress: () => {
            queryClient.invalidateQueries({ queryKey: ['profile', userId] }); 
            navigation.goBack();
          } 
        },
      ]);
    } catch (e: any) {
      console.error("Update profile error:", e);
      Alert.alert("Error", e.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContentContainer}>
      <Text style={styles.screenTitle}>Edit Profile Details</Text>

      <CollapsibleCard title="Avatar & Bio" defaultCollapsed={false}>
        <AvatarEditorAndBio
          userId={userId ?? ''}
          initialAvatarUrl={avatarUrl}
          initialBio={bio}
          onAvatarChange={handleAvatarUrlUpdate}
          onBioChange={setBio}
          // Potentially pass styles or configuration for consistency if needed
        />
      </CollapsibleCard>
      
      {/* Username could be in another card if it becomes more complex, for now, it's handled by RPC */}
      {/* We could add a non-editable display of username, or an editable one if logic changes */}

      <TouchableOpacity 
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={updateProfile} 
        disabled={saving || !userId}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save Profile Changes</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8f8f8' 
  },
  scrollContentContainer: { 
    paddingBottom: 100 
  },
  screenTitle: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    textAlign: 'center', 
    marginVertical: 16, 
    color: '#333' 
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
    shadowRadius: 2 
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    padding: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee' 
  },
  cardTitle: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#444' 
  },
  cardContent: { 
    padding: 12 
  },
  // Styles for the save button, adapted from EditRecipeScreen
  saveButton: { 
    backgroundColor: '#10B981', // Primary green color
    paddingVertical: 14, 
    marginHorizontal: 16, 
    marginTop: 24, 
    borderRadius: 8, 
    alignItems: 'center' 
  },
  saveButtonDisabled: { 
    backgroundColor: '#A3A3A3' // Disabled color
  },
  saveButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  // Add any other styles needed from EditRecipeScreen or new ones for EditProfileScreen
});

export default EditProfileScreen; 