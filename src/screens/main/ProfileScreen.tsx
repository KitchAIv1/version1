import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import { useQuery, QueryKey, useQueryClient } from '@tanstack/react-query';
import { Tabs, MaterialTabBar } from 'react-native-collapsible-tab-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { supabase } from '../../services/supabase';
import ProfileRecipeCard from '../../components/ProfileRecipeCard'; // Import the new card
import ActivityList from '../../components/ActivityList'; // Import ActivityList
import { useNavigation } from '@react-navigation/native'; // Import useNavigation
import { NativeStackNavigationProp } from '@react-navigation/native-stack'; // Import navigation type
import { MainStackParamList } from '../../navigation/types'; // Import param list
import { useAuth } from '../../providers/AuthProvider'; // Import useAuth
import { Feather } from '@expo/vector-icons';
import MealPlannerScreen from './meal_planner/MealPlannerScreen'; // Added import for MealPlannerScreen

// Define types for profile and post data
interface VideoPostData { 
  recipe_id: string;
  recipe_name: string; // Frontend expects this name
  video_url: string;
  thumbnail_url: string | null;
  created_at: string;
}

interface ProfileData { 
  username: string;
  avatar_url?: string | null;
  followers: number;
  following: number;
  bio?: string | null;
  videos: VideoPostData[]; // User's uploaded videos/recipes
  saved_recipes: VideoPostData[]; // Add array for saved recipes
  // Add other fields from get_profile_details if needed
}

const ACTIVE_COLOR = '#22c55e'; // Defined active color

// Props for Header component to include onAddPress
interface HeaderProps {
  profile: ProfileData;
  onMenuPress?: () => void;
  onAddPress?: () => void; // New prop for add button
}

// -----------------------------------------------------------------------------
// Hooks (data)
// -----------------------------------------------------------------------------
const useProfile = () => {
  const { user } = useAuth(); 
  const userId = user?.id;

  return useQuery<ProfileData, Error, ProfileData, QueryKey>({
    queryKey: ['profile', userId], 
    queryFn: async () => {
      if (!userId) throw new Error("User ID is required for profile fetch");
      
      const { data: rawData, error: rpcError } = await supabase
        .rpc('get_profile_details', { p_user_id: userId }); 

      if (rpcError) {
        console.error('[useProfile] Supabase RPC Error:', rpcError);
        throw rpcError;
      }
      if (!rawData) {
        console.error('[useProfile] No data received from RPC for user:', userId);
        throw new Error('Profile data not found.'); 
      }
      
      console.log('[useProfile] rawData from RPC:', JSON.stringify(rawData, null, 2)); // Log the raw data
      const profileDataBackend = rawData as any;
      
      // Map uploaded recipes (from backend 'recipes' to frontend 'videos')
      let processedUploadedVideos: VideoPostData[] = [];
      if (Array.isArray(profileDataBackend.recipes)) {
        processedUploadedVideos = profileDataBackend.recipes.map((recipe: any) => ({
          recipe_id: recipe.recipe_id,
          recipe_name: recipe.title, // Map title to recipe_name
          video_url: recipe.video_url,
          thumbnail_url: recipe.thumbnail_url,
          created_at: recipe.created_at,
        }));
      } else {
        console.warn('[useProfile] profileDataBackend.recipes is not an array or is missing.');
      }

      // Map saved recipes (from backend 'saved_recipes' to frontend 'saved_recipes')
      let processedSavedRecipes: VideoPostData[] = [];
      if (Array.isArray(profileDataBackend.saved_recipes)) {
        processedSavedRecipes = profileDataBackend.saved_recipes.map((recipe: any) => ({
          recipe_id: recipe.recipe_id,
          recipe_name: recipe.title, // Map title to recipe_name
          video_url: recipe.video_url,
          thumbnail_url: recipe.thumbnail_url,
          created_at: recipe.created_at,
        }));
      } else {
        console.warn('[useProfile] profileDataBackend.saved_recipes is not an array or is missing.');
      }
      
      // Construct the final ProfileData object for the frontend
      const processedFrontendData: ProfileData = { 
        username: profileDataBackend.username,
        avatar_url: profileDataBackend.avatar_url,
        followers: profileDataBackend.followers ?? 0,
        following: profileDataBackend.following ?? 0,
        bio: profileDataBackend.bio,
        videos: processedUploadedVideos, // Use the processed uploaded videos
        saved_recipes: processedSavedRecipes // Use the processed saved recipes
      };
      
      console.log(`[useProfile] Processed ${processedUploadedVideos.length} uploaded, ${processedSavedRecipes.length} saved recipes.`);
      return processedFrontendData;
    },
    enabled: !!userId, 
  });
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------
const Header: React.FC<HeaderProps> = ({ profile, onMenuPress, onAddPress }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <View style={styles.headerSpacer} />
      <Text style={styles.headerTitle}>Kitch Hub</Text>
      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.iconBtn} onPress={onAddPress}>
          <Icon name="add-box" size={26} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={onMenuPress}>
          <Icon name="menu" size={26} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const AvatarRow: React.FC<{ profile: ProfileData; postsCount: number }> = ({ profile, postsCount }) => {
  console.log(`[AvatarRow] Rendering. Avatar URL: ${profile.avatar_url}, Timestamp: ${Date.now()}`);
  return (
    <View style={styles.avatarRow}>
      {profile.avatar_url ? (
        <Image 
          source={{ uri: `${profile.avatar_url}?cache=${Date.now()}` }} 
          style={styles.avatar} 
        />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Icon name="person" size={36} color="#a3a3a3" />
        </View>
      )}
      <View style={styles.statsRow}>
        <Stat label="Posts" value={postsCount} />
        <Stat label="Followers" value={profile.followers ?? 0} />
        <Stat label="Following" value={profile.following ?? 0} />
      </View>
    </View>
  );
};

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <View style={{ alignItems: 'center' }}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const Bio: React.FC<{ profile: ProfileData }> = ({ profile }) => (
  <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
    <Text style={styles.bioName}>{profile.username}</Text>
    {profile.bio ? (
      <Text style={styles.bioText}>{profile.bio}</Text>
    ) : (
      <Text style={styles.bioEmpty}>No bio yet.</Text>
    )}
  </View>
);

// -----------------------------------------------------------------------------
// Screen
// -----------------------------------------------------------------------------
export const ProfileScreen: React.FC = () => {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading, isError, error: profileFetchError } = useProfile();
  const navigation = useNavigation<ProfileNavigationProp>();
  const queryClient = useQueryClient(); // Get query client instance

  // --- Navigation Handler for Add Recipe --- (New Handler)
  const handleAddRecipePress = () => {
    navigation.navigate('VideoRecipeUploader');
  };
  // --- End Navigation Handler for Add Recipe ---

  // --- Sign Out Handler ---
  const handleSignOut = async () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase.auth.signOut();
              if (error) {
                console.error('Supabase signOut error:', error);
                throw error; // Rethrow to be caught by the outer catch block
              }
              console.log('User signed out successfully from Supabase.');
              queryClient.clear();
            } catch (signOutError: any) {
              console.error('Error during sign out process:', signOutError);
              Alert.alert('Sign Out Failed', signOutError.message || 'Could not sign out. Please try again.');
            }
          },
        },
      ]
    );
  };
  // --- End Sign Out Handler ---

  if (profileLoading) return <Loader />;
  
  if (isError || !profile || typeof profile !== 'object') {
    console.error('[ProfileScreen] Profile error or profile is not an object:', { profileFetchError, profile });
    const message = profileFetchError?.message || "Failed to load profile. Please try again later.";
    return <ErrorMsg message={message} />;
  }

  // Navigation handler for "Edit Profile"
  const handleEditProfilePress = () => {
    navigation.navigate('EditProfile', {}); // Pass empty params object
  };
  
  const renderHeader = () => (
    <View style={styles.profileHeaderContainer}>
      <Header 
        profile={profile} 
        onMenuPress={handleSignOut} 
        onAddPress={handleAddRecipePress} 
      />
      <AvatarRow profile={profile} postsCount={profile.videos?.length || 0} />
      <Bio profile={profile} />
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.editButton} onPress={handleEditProfilePress}>
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareButton} onPress={() => Alert.alert("Share Profile", "Share functionality to be implemented.")}>
          <Text style={styles.shareButtonText}>Share Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderProfileCardItem = ({ item }: { item: VideoPostData }) => (
    <ProfileRecipeCard 
      item={item} 
      onPress={() => navigation.navigate('RecipeDetail', { id: item.recipe_id })} 
    />
  );

  return (
    <Tabs.Container
      renderHeader={renderHeader}
      headerHeight={undefined} 
      allowHeaderOverscroll={true}
      renderTabBar={(props) => (
        <MaterialTabBar
          {...props}
          activeColor={ACTIVE_COLOR}
          inactiveColor="#525252"
          labelStyle={styles.tabLabel}
          indicatorStyle={styles.tabIndicator}
          style={styles.materialTabBar}
          getLabelText={(name: string) => name}
          // @ts-ignore 
          renderIcon={(iconProps) => { 
            let iconName = 'video-library'; 
            if (iconProps.route.name === 'My Recipes') iconName = 'video-library';
            if (iconProps.route.name === 'Saved') iconName = 'bookmark';
            if (iconProps.route.name === 'Planner') iconName = 'event'; 
            if (iconProps.route.name === 'Activity') iconName = 'notifications';

            return <Icon name={iconName} size={20} color={iconProps.focused ? ACTIVE_COLOR : '#525252'} style={{ marginRight: 0, paddingRight:0 }}/>;
          }}
        />
      )}
    >
      <Tabs.Tab name="My Recipes" label="My Recipes">
        <Tabs.FlatList
          data={profile.videos}
          renderItem={renderProfileCardItem}
          keyExtractor={(item) => item.recipe_id}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Empty label="No recipes uploaded yet." />}
          contentContainerStyle={styles.gridContentContainer} // Use this for padding
          style={styles.fullScreenTabContent} // Ensures FlatList takes full available space
        />
      </Tabs.Tab>
      <Tabs.Tab name="Saved" label="Saved">
        <Tabs.FlatList
          data={profile.saved_recipes}
          renderItem={renderProfileCardItem}
          keyExtractor={(item) => `saved-${item.recipe_id}`}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Empty label="No saved recipes yet." />}
          contentContainerStyle={styles.gridContentContainer} // Use this for padding
          style={styles.fullScreenTabContent} // Ensures FlatList takes full available space
        />
      </Tabs.Tab>
      <Tabs.Tab name="Planner" label="Planner">
        <View style={styles.fullScreenTabContentWithPadding}>
          <MealPlannerScreen />
        </View>
      </Tabs.Tab>
      <Tabs.Tab name="Activity" label="Activity">
        {/* Assuming ActivityList can be wrapped or is already scrollable */}
        <View style={styles.fullScreenTabContentWithPadding}>
           <ActivityList data={[]} />
        </View>
      </Tabs.Tab>
    </Tabs.Container>
  );
};

// -----------------------------------------------------------------------------
// Utility Components
// -----------------------------------------------------------------------------
const Loader = () => (
  <View style={styles.center}><ActivityIndicator size="large" color={ACTIVE_COLOR} /></View>
);
const ErrorMsg: React.FC<{ message: string }> = ({ message }) => (
  <View style={styles.center}><Text>{message}</Text></View>
);
const Empty: React.FC<{ label: string }> = ({ label }) => (
  <View style={styles.emptyContainer}>
    <Feather name="book-open" size={48} color="#cbd5e1" style={styles.emptyIcon} />
    <Text style={styles.emptyText}>{label}</Text>
    <Text style={styles.emptySubText}>
      {label.includes("uploads") 
        ? "Share your culinary creations with the world."
        : "Bookmark recipes you'd like to try later."}
    </Text>
  </View>
);

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  username: {
    fontSize: 22,
    color: '#fff',
    fontWeight: 'bold',
  },
  listContentContainer: {
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: 'flex-start',
  },
  editButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  editProfileButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editProfileButtonText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#333',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  tabBar: {
    backgroundColor: '#fff',
  },
  profileHeaderContainer: {
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#10b981',
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
    justifyContent: 'flex-end',
  },
  iconBtn: {
    padding: 6,
    marginLeft: 10,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e5e5e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginLeft: 16,
  },
  statValue: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#262626',
  },
  statLabel: {
    fontSize: 13,
    color: '#737373',
    marginTop: 2,
  },
  bioName: {
    fontWeight: 'bold',
    marginBottom: 4,
    fontSize: 15,
    color: '#262626',
  },
  bioText: {
    lineHeight: 18,
    fontSize: 14,
    color: '#525252',
  },
  bioEmpty: {
    lineHeight: 18,
    fontSize: 14,
    color: '#a3a3a3',
    fontStyle: 'italic',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    backgroundColor: '#fff',
  },
  editButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  editButtonText: {
    fontWeight: '600',
    color: '#333',
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  shareButtonText: {
    fontWeight: '600',
    color: '#333',
  },
  materialTabBar: {
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'none',
    textAlign: 'center',
    marginHorizontal: 4,
  },
  tabIndicator: {
    backgroundColor: ACTIVE_COLOR,
    height: 2.5,
  },
  gridContentContainer: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  fullScreenTabContent: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  fullScreenTabContentWithPadding: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 8,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// Add Navigation Prop Type for ProfileScreen context
type ProfileNavigationProp = NativeStackNavigationProp<MainStackParamList>; // Changed to be more general for MainStack

export default ProfileScreen;
