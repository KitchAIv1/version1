import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  TextInput, // Added TextInput
} from 'react-native';
import { Button } from 'react-native-paper';
import { useQueryClient } from '@tanstack/react-query'; // Import useQueryClient
import Icon from 'react-native-vector-icons/MaterialIcons'; // For CollapsibleCard
import { AvatarEditorAndBio } from '../components/AvatarEditorAndBio';
// import { COLORS } from '../constants/colors'; // Removed invalid import
import { supabase } from '../services/supabase'; // Corrected path
import { useAuth } from '../providers/AuthProvider'; // Corrected path
import FoodPreferencesSelector from '../components/FoodPreferencesSelector'; // Added import

// Placeholder colors - replace with your actual theme colors later
const PLACEHOLDER_BACKGROUND = '#f5f5f5';
const PLACEHOLDER_PRIMARY = '#22c55e'; // Using the green from profile

// Reusable CollapsibleCard (copied from EditRecipeScreen.tsx)
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

// Define route params type if not already defined elsewhere
// Assuming MainStackParamList includes EditProfileScreen
type EditProfileRouteParams = {
  initialProfileData?: {
    bio?: string | null;
    avatar_url?: string | null;
    username?: string | null;
    diet_tags?: string[] | null; // Added diet_tags
  };
  userId?: string;
};

// Define navigation prop type if needed
// import { NativeStackScreenProps } from '@react-navigation/native-stack';
// type Props = NativeStackScreenProps<MainStackParamList, 'EditProfileScreen'>;
// const EditProfileScreen = ({ navigation, route }: Props) => { ... }

function EditProfileScreen({ navigation, route }: any) {
  // Using any temporarily for navigation/route types
  const queryClient = useQueryClient(); // Get queryClient instance
  const { user, profile } = useAuth(); // Get user and profile from useAuth
  const { initialProfileData = {} } = route.params || {};

  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [foodPreferences, setFoodPreferences] = useState<string[]>([]); // Added state for food preferences
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false); // Track if just saved successfully

  // 🔍 DEBUG: Track component lifecycle and navigation changes
  useEffect(() => {
    console.log('[EDIT_PROFILE] Component mounted');
    console.log('[EDIT_PROFILE] Initial navigation state:', navigation.getState());
    
    // Track navigation state changes
    const unsubscribe = navigation.addListener('state', (e: any) => {
      console.log('[EDIT_PROFILE] Navigation state changed:', e.data.state);
    });
    
    // Track when component is about to unmount
    return () => {
      console.log('[EDIT_PROFILE] Component unmounting');
      unsubscribe();
    };
  }, [navigation]);

  // 🔍 DEBUG: Track when profile updates
  useEffect(() => {
    console.log('[EDIT_PROFILE] Profile state changed:', profile);
  }, [profile]);

  useEffect(() => {
    if (initialProfileData) {
      setBio(initialProfileData.bio || '');
      setAvatarUrl(initialProfileData.avatar_url || null);
      setUsername(initialProfileData.username || '');
      setFoodPreferences(initialProfileData.diet_tags || []); // Initialize food preferences

      if (initialProfileData.username) {
        navigation.setOptions({
          title: `Editing: ${initialProfileData.username}`,
        });
      } else {
        navigation.setOptions({ title: 'Edit Profile' });
      }
    }
  }, [initialProfileData, navigation]);

  const handleAvatarUrlUpdate = (newUrl: string) => {
    setAvatarUrl(newUrl);
  };

  const handlePreferencesChange = (newPreferences: string[]) => {
    setFoodPreferences(newPreferences);
  };

  const updateProfile = async () => {
    if (!user || !user.id) {
      Alert.alert('Error', 'User not available. Cannot update profile.');
      return;
    }
    if (!username.trim()) {
      Alert.alert('Validation Error', 'Username cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      const processedFoodPreferences = foodPreferences.map(pref =>
        pref.toLowerCase().replace(/\s+/g, '-'),
      );

      const profileUpdatePayload = {
        p_user_id: user.id,
        p_avatar_url: avatarUrl,
        p_bio: bio,
        p_username: username.trim(),
        p_role: profile?.role,
        p_onboarded: profile?.onboarded,
        p_diet_tags: processedFoodPreferences,
      };

      console.log('[EDIT_PROFILE] Profile update payload:', profileUpdatePayload);
      console.log('[EDIT_PROFILE] Original profile role:', profile?.role);

      const { data, error } = await supabase.rpc(
        'update_profile',
        profileUpdatePayload,
      );

      if (error) {
        console.error('Error updating profile:', error.message);
        Alert.alert('Failed to update profile', error.message);
        setSaving(false);
        return;
      }

      // 🎯 IMPROVED UX: No modal, direct success feedback
      console.log('[EDIT_PROFILE] Profile updated successfully');
      console.log('[EDIT_PROFILE] Current navigation state:', navigation.getState());
      console.log('[EDIT_PROFILE] Can go back:', navigation.canGoBack());
      
      // 🎯 SIMPLE SOLUTION: Just invalidate cache without triggering profile refresh
      // This prevents navigation stack resets while still updating the UI
      queryClient.invalidateQueries({ 
        queryKey: ['profile', user.id] 
      });
      console.log('[EDIT_PROFILE] Cache invalidated - UI will update without navigation disruption');
      
      // Show visual success feedback immediately
      setJustSaved(true);
      console.log('[EDIT_PROFILE] Success state set to true');
      
      // Reset success state after 3 seconds
      setTimeout(() => {
        setJustSaved(false);
        console.log('[EDIT_PROFILE] Success state reset to false');
      }, 3000);
      
      console.log('[EDIT_PROFILE] Profile saved successfully - staying on edit screen');
    } catch (e: any) {
      console.error('Update profile error (generic catch):', e);
      Alert.alert('Error', e.message || 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContentContainer}>
      <Text style={styles.screenTitle}>Edit Profile Details</Text>

      <CollapsibleCard title="Avatar & Bio" defaultCollapsed={false}>
        <AvatarEditorAndBio
          userId={user?.id ?? ''} // Pass user.id from useAuth() to AvatarEditorAndBio
          initialAvatarUrl={avatarUrl}
          initialBio={bio}
          onAvatarChange={handleAvatarUrlUpdate}
          onBioChange={setBio}
          // Potentially pass styles or configuration for consistency if needed
        />
      </CollapsibleCard>

      <CollapsibleCard title="Account Information" defaultCollapsed={false}>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Username</Text>
          <TextInput
            style={styles.textInput}
            value={username}
            onChangeText={setUsername}
            placeholder="Enter your username"
            placeholderTextColor="#999"
            autoCapitalize="none"
          />
        </View>
      </CollapsibleCard>

      <CollapsibleCard title="Food Preferences" defaultCollapsed={false}>
        <FoodPreferencesSelector
          currentPreferences={foodPreferences}
          onPreferencesChange={handlePreferencesChange}
        />
      </CollapsibleCard>

      <TouchableOpacity
        style={[
          styles.saveButton, 
          saving && styles.saveButtonDisabled,
          justSaved && styles.saveButtonSuccess
        ]}
        onPress={updateProfile}
        disabled={saving || !user || !user.id} // Disable button if no user.id
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : justSaved ? (
          <>
            <Text style={styles.saveButtonText}>✓ Saved Successfully!</Text>
          </>
        ) : (
          <Text style={styles.saveButtonText}>Save Profile Changes</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollContentContainer: {
    paddingBottom: 100,
  },
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#444',
  },
  cardContent: {
    padding: 12,
  },
  inputContainer: {
    // Added style for TextInput container
    marginBottom: 12,
  },
  inputLabel: {
    // Added style for TextInput label
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
  },
  textInput: {
    // Added style for TextInput
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  // Styles for the save button, adapted from EditRecipeScreen
  saveButton: {
    backgroundColor: '#10B981', // Primary green color
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#A3A3A3', // Disabled color
  },
  saveButtonSuccess: {
    backgroundColor: '#059669', // Darker green for success state
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Add any other styles needed from EditRecipeScreen or new ones for EditProfileScreen
});

export default EditProfileScreen;
