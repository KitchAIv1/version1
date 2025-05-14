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
      <Text style={styles.username}>{profile.username}</Text>
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
  const { data: profile, isLoading: profileLoading, isError: profileError } = useProfile();
  const [savedItems, setSavedItems] = React.useState<any[]>([]);
  const [activityItems, setActivityItems] = React.useState<any[]>([]);
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
                throw error;
              }
              // Clear cache AFTER successful sign out
              queryClient.clear(); 
              console.log('User signed out, navigating to Login');
              // Navigate to Login screen - Ensure 'Login' is the correct route name
              // If using nested navigators, might need navigation.navigate('AuthStack', { screen: 'Login' });
              navigation.navigate('Login' as any); // Use 'as any' for now if type checking is complex
            } catch (signOutError: any) {
              console.error('Error signing out:', signOutError);
              Alert.alert('Sign Out Failed', signOutError.message || 'Could not sign out. Please try again.');
            }
          },
        },
      ]
    );
  };
  // --- End Sign Out Handler ---

  if (profileLoading) return <Loader />;
  
  if (profileError || !profile || typeof profile !== 'object') {
    return <ErrorMsg message="Could not load profile" />;
  }

  console.log(`[ProfileScreen] Rendering. Avatar URL from useProfile: ${profile?.avatar_url}, Timestamp: ${Date.now()}`);

  // Add handler for navigating to Edit Profile
  const handleEditProfilePress = () => {
    const userIdToPass = (profile as any)?.id || user?.id; 
    if (!userIdToPass) {
      console.warn('User ID not found for EditProfile navigation');
      return;
    }
    navigation.navigate('EditProfile', { 
      // Pass only the data EditProfileScreen expects
      initialProfileData: {
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        username: profile.username // Pass the username
      },
      userId: userIdToPass // Ensure userId is also passed if EditProfileScreen needs it directly
    });
  };

  const renderHeader = () => (
    <View>
      <Header profile={profile} onMenuPress={handleSignOut} onAddPress={handleAddRecipePress} /> 
      <AvatarRow profile={profile} postsCount={profile.videos?.length ?? 0} />
      <Bio profile={profile} />
      {/* Add Edit Profile Button */}
      <View style={styles.editButtonContainer}>
        <TouchableOpacity style={styles.editProfileButton} onPress={handleEditProfilePress}>
            <Text style={styles.editProfileButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Update renderItem to use ProfileRecipeCard with navigation
  const renderProfileCardItem = ({ item }: { item: VideoPostData }) => (
    <ProfileRecipeCard 
      item={item}
      onPress={() => navigation.navigate('RecipeDetail', { id: item.recipe_id })} 
    />
  );

  return (
    <Tabs.Container 
      renderHeader={renderHeader} 
      headerHeight={320} 
      renderTabBar={props => (
        <MaterialTabBar
          {...props}
          activeColor={ACTIVE_COLOR}
          inactiveColor="#6b7280"
          labelStyle={styles.tabLabel}
          indicatorStyle={{ backgroundColor: ACTIVE_COLOR, height: 2 }}
        />
      )}
    >
      <Tabs.Tab name="Uploads" label={`Uploads (${profile.videos?.length ?? 0})`}>
        {profile.videos && profile.videos.length > 0 ? (
          <Tabs.FlatList
            data={profile.videos} 
            numColumns={2}
            keyExtractor={(item) => item.recipe_id}
            renderItem={renderProfileCardItem} 
            contentContainerStyle={styles.listContentContainer}
            showsVerticalScrollIndicator={false}
            initialNumToRender={6}
            columnWrapperStyle={styles.columnWrapper} // Add column wrapper style for more control
          />
        ) : (
          <Empty label="No uploads yet" />
        )}
      </Tabs.Tab>
      <Tabs.Tab name="Saved" label={`Saved (${profile.saved_recipes?.length ?? 0})`}>
        {profile.saved_recipes && profile.saved_recipes.length > 0 ? (
          <Tabs.FlatList
            data={profile.saved_recipes} 
            numColumns={2} 
            keyExtractor={(item) => item.recipe_id}
            renderItem={renderProfileCardItem}
            contentContainerStyle={styles.listContentContainer}
            showsVerticalScrollIndicator={false}
            initialNumToRender={6}
            columnWrapperStyle={styles.columnWrapper} // Add column wrapper style for more control
          />
        ) : (
          <Empty label="No saved recipes yet" />
        )}
      </Tabs.Tab>
      <Tabs.Tab name="Activity" label="Activity">
        {/* Use ActivityList component */}
        {/* TODO: Replace [] with actual activityItems data when fetched */}
        <ActivityList data={activityItems} />
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
  header: {
    backgroundColor: ACTIVE_COLOR, 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  username: {
    fontSize: 22,
    color: '#fff',
    fontWeight: 'bold',
  },
  headerActions: { flexDirection: 'row' },
  iconBtn: {
    marginLeft: 12,
  },
  avatarRow: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
  },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statValue: { fontSize: 18, fontWeight: '600' },
  statLabel: { color: '#6b7280' },
  bioName: { fontWeight: '600', marginBottom: 2 },
  bioText: { color: '#374151' },
  bioEmpty: { color: '#9ca3af', fontStyle: 'italic' },
  tabLabel: { 
    textTransform: 'capitalize',
    fontSize: 14,
  },
  listContentContainer: {
    paddingHorizontal: 6, // Match card margin for consistent spacing
    paddingTop: 8,
    paddingBottom: 24, // More bottom space
  },
  columnWrapper: {
    justifyContent: 'space-around', // More evenly distributed cards
  },
  editButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10, 
    backgroundColor: '#fff', // Match background of bio/avatar row
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
});

// Add Navigation Prop Type for ProfileScreen context
type ProfileNavigationProp = NativeStackNavigationProp<MainStackParamList>; // Changed to be more general for MainStack

export default ProfileScreen;
