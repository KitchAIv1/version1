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
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { supabase } from '../../services/supabase';
import ProfileRecipeCard from '../../components/ProfileRecipeCard'; // Import the new card
import ActivityList from '../../components/ActivityList'; // Import ActivityList
import { useNavigation } from '@react-navigation/native'; // Import useNavigation
import { NativeStackNavigationProp } from '@react-navigation/native-stack'; // Import navigation type
import { MainStackParamList } from '../../navigation/types'; // Import param list
import { useAuth } from '../../providers/AuthProvider'; // Import useAuth
import { Feather } from '@expo/vector-icons';
// import MealPlannerScreen from './meal_planner/MealPlannerScreen'; // REMOVED Existing planner
import MealPlannerV2Screen from './meal_planner_v2/MealPlannerV2Screen'; // New V2 planner
import { ProfileScreenSkeleton, RecipeGridSkeleton } from '../../components/ProfileScreenSkeletons';

// Define types for profile and post data
interface VideoPostData { 
  recipe_id: string;
  recipe_name: string; // Frontend expects this name
  video_url: string;
  thumbnail_url: string | null;
  created_at: string;
  creator_user_id: string; // Added creator's user ID
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
          creator_user_id: recipe.creator_user_id, // Corrected mapping
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
          creator_user_id: recipe.creator_user_id, // Corrected mapping
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
    staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh
    gcTime: 10 * 60 * 1000, // 10 minutes - cache retention (renamed from cacheTime)
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on mount if data exists
    retry: 2, // Retry failed requests 2 times
  });
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------
const AvatarRow: React.FC<{ profile: ProfileData; postsCount: number }> = React.memo(({ profile, postsCount }) => {
  console.log(`[AvatarRow] Rendering. Avatar URL: ${profile.avatar_url}, Timestamp: ${Date.now()}`);
  return (
    <View style={styles.avatarRow}>
      {profile.avatar_url ? (
        <Image 
          source={{ uri: profile.avatar_url }} 
          style={styles.avatar} 
          loadingIndicatorSource={{ uri: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' }}
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
});

const Stat: React.FC<{ label: string; value: number }> = React.memo(({ label, value }) => (
  <View style={{ alignItems: 'center' }}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
));

const Bio: React.FC<{ profile: ProfileData }> = React.memo(({ profile }) => (
  <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
    <Text style={styles.bioName}>{profile.username}</Text>
    {profile.bio ? (
      <Text style={styles.bioText}>{profile.bio}</Text>
    ) : (
      <Text style={styles.bioEmpty}>No bio yet.</Text>
    )}
  </View>
));

// Lazy Tab Content Component
const LazyTabContent: React.FC<{ 
  data: VideoPostData[]; 
  context: 'myRecipes' | 'savedRecipes';
  emptyLabel: string;
}> = React.memo(({ data, context, emptyLabel }) => {
  const navigation = useNavigation<ProfileNavigationProp>();
  
  const renderItem = React.useCallback(({ item }: { item: VideoPostData }) => (
    <ProfileRecipeCard 
      item={item} 
      onPress={() => navigation.navigate('RecipeDetail', { id: item.recipe_id })}
      context={context}
    />
  ), [navigation, context]);

  const keyExtractor = React.useCallback((item: VideoPostData) => 
    context === 'savedRecipes' ? `saved-${item.recipe_id}` : item.recipe_id, 
    [context]
  );

  return (
    <Tabs.FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={2}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={<Empty label={emptyLabel} />}
      contentContainerStyle={styles.gridContentContainer}
      style={styles.fullScreenTabContent}
      removeClippedSubviews={true} // Performance optimization
      maxToRenderPerBatch={4} // Render 4 items per batch
      windowSize={10} // Keep 10 items in memory
      initialNumToRender={6} // Render 6 items initially
    />
  );
});

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

  if (profileLoading) return <ProfileScreenSkeleton />;
  
  if (isError || !profile || typeof profile !== 'object') {
    console.error('[ProfileScreen] Profile error or profile is not an object:', { profileFetchError, profile });
    const message = profileFetchError?.message || "Failed to load profile. Please try again later.";
    return <ErrorMsg message={message} />;
  }

  // Navigation handler for "Edit Profile"
  const handleEditProfilePress = () => {
    if (!profile) return; // Guard against profile being null/undefined
    navigation.navigate('EditProfile', { 
      initialProfileData: {
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        username: profile.username
      }
    });
  };

  const renderProfileInfo = () => (
    <View style={styles.profileInfoContainer}>
      {/* Header content moved here - now part of scrollable content */}
      <View style={styles.scrollableHeader}>
        <View style={styles.headerSpacer} />
        <Text style={styles.scrollableHeaderTitle}>Kitch Hub</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleAddRecipePress}>
            <Icon name="add-box" size={26} color="#10b981" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleSignOut}>
            <Icon name="menu" size={26} color="#1f2937" />
          </TouchableOpacity>
        </View>
      </View>
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

  return (
    <View style={styles.container}>
      {/* Fixed Green Header - covers status bar area and stays fixed */}
      <View style={styles.fixedGreenHeader}>
        <SafeAreaView edges={['top']} />
      </View>
      
      {/* Scrollable Content - includes Kitch Hub content above avatar */}
      <View style={styles.tabsContainer}>
        <Tabs.Container
          renderHeader={renderProfileInfo}
          headerHeight={undefined} 
          allowHeaderOverscroll={false}
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
                if (iconProps.route.name === 'Planner') iconName = 'calendar-today'; // Changed from Planner V2
                if (iconProps.route.name === 'Activity') iconName = 'notifications';

                return <Icon name={iconName} size={20} color={iconProps.focused ? ACTIVE_COLOR : '#525252'} style={{ marginRight: 0, paddingRight:0 }}/>;
              }}
            />
          )}
        >
          <Tabs.Tab name="My Recipes" label="My Recipes">
            <LazyTabContent 
              data={profile.videos} 
              context="myRecipes" 
              emptyLabel="No recipes uploaded yet."
            />
          </Tabs.Tab>
          <Tabs.Tab name="Saved" label="Saved">
            <LazyTabContent 
              data={profile.saved_recipes} 
              context="savedRecipes" 
              emptyLabel="No saved recipes yet."
            />
          </Tabs.Tab>
          <Tabs.Tab name="Planner" label="Planner">
            <Tabs.ScrollView style={styles.fullScreenTabContent}>
              <MealPlannerV2Screen />
            </Tabs.ScrollView>
          </Tabs.Tab>
          <Tabs.Tab name="Activity" label="Activity">
            <View style={styles.fullScreenTabContentWithPadding}>
               <ActivityList data={[]} />
            </View>
          </Tabs.Tab>
        </Tabs.Container>
      </View>
    </View>
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
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#fff',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#10b981',
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#e0e0e0',
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginLeft: 20,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#262626',
  },
  statLabel: {
    fontSize: 13,
    color: '#737373',
    marginTop: 2,
    fontWeight: '500',
  },
  bioName: {
    fontWeight: 'bold',
    marginBottom: 6,
    fontSize: 16,
    color: '#262626',
  },
  bioText: {
    lineHeight: 20,
    fontSize: 14,
    color: '#525252',
  },
  bioEmpty: {
    lineHeight: 20,
    fontSize: 14,
    color: '#a3a3a3',
    fontStyle: 'italic',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  editButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginRight: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  editButtonText: {
    fontWeight: '600',
    color: '#fff',
    fontSize: 15,
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  shareButtonText: {
    fontWeight: '600',
    color: '#495057',
    fontSize: 15,
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
    paddingBottom: 20,
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
  profileInfoContainer: {
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  safeAreaContainer: {
    backgroundColor: '#10b981',
  },
  tabsContainer: {
    flex: 1,
    zIndex: 1,
    paddingTop: 50,
  },
  scrollableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  scrollableHeaderTitle: {
    color: '#1f2937',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
    letterSpacing: 0.5,
  },
  headerSpacer: {
    width: 40,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
    justifyContent: 'flex-end',
  },
  iconBtn: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  fixedGreenHeader: {
    backgroundColor: '#10b981',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
});

// Add Navigation Prop Type for ProfileScreen context
type ProfileNavigationProp = NativeStackNavigationProp<MainStackParamList>; // Changed to be more general for MainStack

export default ProfileScreen;
