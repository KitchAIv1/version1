import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Alert,
  RefreshControl,
  Modal,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useQuery, QueryKey, useQueryClient } from '@tanstack/react-query';
import {
  useSafeAreaInsets,
  SafeAreaView,
} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native'; // Added useFocusEffect import
import { NativeStackNavigationProp } from '@react-navigation/native-stack'; // Import navigation type
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { supabase } from '../../services/supabase';
import ProfileRecipeCard from '../../components/ProfileRecipeCard'; // Import the new card
import ActivityFeed from '../../components/ActivityFeed'; // Import ActivityFeed instead of ActivityList
import { MainStackParamList } from '../../navigation/types'; // Import param list
import { useAuth } from '../../providers/AuthProvider'; // Import useAuth
// import MealPlannerScreen from './meal_planner/MealPlannerScreen'; // REMOVED Existing planner
import MealPlannerV2Screen from './meal_planner_v2/MealPlannerV2Screen'; // New V2 planner
import {
  ProfileScreenSkeleton,
  RecipeGridSkeleton,
} from '../../components/ProfileScreenSkeletons';
import { useUserActivityFeed } from '../../hooks/useUserActivityFeed'; // Import the activity feed hook
import { useAccessControl } from '../../hooks/useAccessControl'; // Import access control hook
import { TierDisplay } from '../../components/TierDisplay'; // Added TierDisplay import
import { FollowButton } from '../../components/FollowButton';
import { FollowButtonOptimized } from '../../components/FollowButtonOptimized';
import { useFollowDataPreloader } from '../../hooks/useFollowDataPreloader';
import { CreatorAccountModal } from '../../components/CreatorAccountModal';
import { PremiumUpgradeModal } from '../../components/PremiumUpgradeModal';
import { PremiumFeaturesModal } from '../../components/PremiumFeaturesModal';
import { PrismaticCelebration } from '../../components/PrismaticCelebration';

// import { useCacheDebug } from '../../hooks/useCacheDebug'; // REMOVED - no longer needed

// Import notification components
import {
  useNotifications,
  useUnreadNotificationCount,
  useNotificationsSubscription,
} from '../../hooks/useNotifications';
import { NotificationBell } from '../../components/NotificationBell';
import { NotificationDrawer } from '../../components/NotificationDrawer';
import { ToastNotification } from '../../components/ToastNotification';

// Define types for profile and post data
interface VideoPostData {
  recipe_id: string;
  recipe_name: string; // Frontend expects this name
  video_url: string;
  thumbnail_url: string | null;
  created_at: string;
  creator_user_id: string; // Added creator's user ID
  is_ai_generated?: boolean; // Added to support AI recipe indicators
}

interface ProfileData {
  username: string;
  avatar_url?: string | null;
  followers: number;
  following: number;
  bio?: string | null;
  videos: VideoPostData[]; // User's uploaded videos/recipes
  saved_recipes: VideoPostData[]; // Add array for saved recipes
  user_id?: string; // Add user_id for follow functionality
}

// Route params for ProfileScreen
interface ProfileScreenParams {
  userId?: string; // Optional userId to view other users' profiles
}

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;
const FIXED_HEADER_HEIGHT = 72; // Height for fixed "Kitch Hub" header - match grocery list
const HEADER_HEIGHT = screenHeight * 0.25; // Reduced from 35% to 25% since fixed header takes space
const ACTIVE_COLOR = '#10b981'; // Green color for active elements

// -----------------------------------------------------------------------------
// Hooks (data)
// -----------------------------------------------------------------------------
// 🚀 PERFORMANCE OPTIMIZATION: Enhanced profile hook with better caching
const useProfile = (targetUserId?: string) => {
  const { user } = useAuth();
  const userId = targetUserId || user?.id;
  const isOwnProfile = !targetUserId || targetUserId === user?.id;

  return useQuery<ProfileData, Error, ProfileData, QueryKey>({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required for profile fetch');

      const { data: rawData, error: rpcError } = await supabase.rpc(
        'get_profile_details',
        { p_user_id: userId },
      );

      if (rpcError) {
        console.error('[useProfile] Supabase RPC Error:', rpcError);
        throw rpcError;
      }
      if (!rawData) {
        console.error(
          '[useProfile] No data received from RPC for user:',
          userId,
        );
        throw new Error('Profile data not found.');
      }

      const profileDataBackend = rawData as any;
      console.log('[useProfile] New backend structure received:', {
        hasProfile: !!profileDataBackend.profile,
        hasRecipes: !!profileDataBackend.recipes,
        hasSavedRecipes: !!profileDataBackend.saved_recipes,
        profileKeys: profileDataBackend.profile ? Object.keys(profileDataBackend.profile) : [],
        recipesCount: Array.isArray(profileDataBackend.recipes) ? profileDataBackend.recipes.length : 0,
        savedRecipesCount: Array.isArray(profileDataBackend.saved_recipes) ? profileDataBackend.saved_recipes.length : 0,
      });

      // Extract profile data from new structure
      const profileInfo = profileDataBackend.profile || {};

      // Process uploaded recipes with new structure
      let processedUploadedVideos: VideoPostData[] = [];
      if (Array.isArray(profileDataBackend.recipes)) {
        processedUploadedVideos = profileDataBackend.recipes.map(
          (recipe: any, index: number) => ({
            recipe_id: recipe.recipe_id || `recipe_${index}`,
            recipe_name: recipe.title || 'Untitled Recipe',
            video_url: recipe.video_url || '',
            thumbnail_url: recipe.thumbnail_url || null,
            created_at: recipe.created_at || new Date().toISOString(),
            creator_user_id: recipe.creator_user_id || userId,
            is_ai_generated: recipe.is_ai_generated || false,
          }),
                 ).filter((recipe: VideoPostData) => recipe.recipe_id && recipe.recipe_name);
         
         console.log(`[useProfile] Processed ${processedUploadedVideos.length} uploaded recipes`);
      }

      // Process saved recipes with new structure
      let processedSavedRecipes: VideoPostData[] = [];
      if (Array.isArray(profileDataBackend.saved_recipes)) {
        processedSavedRecipes = profileDataBackend.saved_recipes.map(
          (recipe: any, index: number) => ({
            recipe_id: recipe.recipe_id || `saved_recipe_${index}`,
            recipe_name: recipe.title || 'Untitled Recipe',
            video_url: recipe.video_url || '',
            thumbnail_url: recipe.thumbnail_url || null,
            created_at: recipe.created_at || new Date().toISOString(),
            creator_user_id: recipe.creator_user_id || userId,
            is_ai_generated: recipe.is_ai_generated || false,
          }),
                 ).filter((recipe: VideoPostData) => recipe.recipe_id && recipe.recipe_name);
         
         console.log(`[useProfile] Processed ${processedSavedRecipes.length} saved recipes`);
      }

      // Construct the final ProfileData object using new backend structure
      const processedFrontendData: ProfileData = {
        username: profileInfo.username || 'Unknown User',
        avatar_url: profileInfo.avatar_url || null,
        followers: profileInfo.followers || 0,
        following: profileInfo.following || 0,
        bio: profileInfo.bio || null,
        videos: processedUploadedVideos,
        saved_recipes: processedSavedRecipes,
        user_id: userId,
      };

      return processedFrontendData;
    },
    enabled: !!userId,
    // 🚀 PERFORMANCE OPTIMIZATION: Extended cache times
    staleTime: isOwnProfile ? 2 * 60 * 1000 : 10 * 60 * 1000, // Own profile: 2min, Others: 10min
    gcTime: isOwnProfile ? 5 * 60 * 1000 : 30 * 60 * 1000, // Own profile: 5min, Others: 30min
    refetchOnWindowFocus: false, // Disabled - causes unnecessary refetches
    refetchOnMount: false, // Disabled - rely on cache
    retry: 2,
  });
};

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------
const AvatarRow: React.FC<{ 
  profile: ProfileData; 
  postsCount: number;
  onFollowersPress: () => void;
  onFollowingPress: () => void;
}> = React.memo(({ profile, postsCount, onFollowersPress, onFollowingPress }) => {
    return (
      <View style={styles.avatarRow}>
        {profile.avatar_url ? (
          <Image
            source={{ uri: profile.avatar_url }}
            style={styles.avatar}
            loadingIndicatorSource={{
              uri: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
            }}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Icon name="person" size={36} color="#a3a3a3" />
          </View>
        )}
        <View style={styles.statsRow}>
          <Stat label="Posts" value={postsCount} />
          <Stat 
            label="Followers" 
            value={profile.followers ?? 0} 
            onPress={onFollowersPress}
            isClickable={true}
          />
          <Stat 
            label="Following" 
            value={profile.following ?? 0} 
            onPress={onFollowingPress}
            isClickable={true}
          />
        </View>
      </View>
    );
  });

const Stat: React.FC<{ 
  label: string; 
  value: number; 
  onPress?: () => void;
  isClickable?: boolean;
}> = React.memo(({ label, value, onPress, isClickable = false }) => {
  if (isClickable && onPress) {
    return (
      <TouchableOpacity 
        style={styles.statContainer} 
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.statContainer}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
});

const Bio: React.FC<{
  profile: ProfileData;
  onTierBadgePress: () => void;
  tierDisplay: string;
  showTierBadge: boolean;
}> = React.memo(({ profile, onTierBadgePress, tierDisplay, showTierBadge }) => (
  <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
    <View style={styles.usernameRow}>
      <Text style={styles.bioName}>{profile.username}</Text>
      {showTierBadge && (
        <TouchableOpacity
          style={[
            styles.tierBadge,
            tierDisplay === 'PREMIUM' || tierDisplay.includes('CREATOR')
              ? styles.tierBadgePremium
              : styles.tierBadgeFreemium,
          ]}
          onPress={onTierBadgePress}
          activeOpacity={0.7}>
          {tierDisplay === 'PREMIUM' || tierDisplay.includes('CREATOR') ? (
            <Icon
              name="star"
              size={12}
              color="#333"
              style={styles.tierBadgeIcon}
            />
          ) : null}
          <Text
            style={[
              styles.tierBadgeText,
              tierDisplay === 'PREMIUM' || tierDisplay.includes('CREATOR')
                ? styles.tierBadgeTextPremium
                : styles.tierBadgeTextFreemium,
            ]}>
            {tierDisplay.includes('CREATOR') ? 'Creator' : tierDisplay}
          </Text>
        </TouchableOpacity>
      )}
    </View>
    {profile.bio ? (
      <Text style={styles.bioText}>{profile.bio}</Text>
    ) : (
      <Text style={styles.bioEmpty}>No bio yet.</Text>
    )}
  </View>
));

// -----------------------------------------------------------------------------
// Screen
// -----------------------------------------------------------------------------
export const ProfileScreen: React.FC = () => {
  const { user } = useAuth();
  const route = useRoute();
  const navigation = useNavigation<ProfileNavigationProp>();
  const queryClient = useQueryClient();

  // Get userId from route params (for viewing other users' profiles)
  const routeParams = route.params as ProfileScreenParams | undefined;
  const targetUserId = routeParams?.userId;
  const isOwnProfile = !targetUserId || targetUserId === user?.id;

  // 🎯 PRELOAD FOLLOW DATA (Industry best practice) - TEMPORARILY DISABLED
  // const profileUserId = targetUserId || user?.id;
  // const { isPreloaded } = useFollowDataPreloader(profileUserId, {
  //   priority: 'high', // High priority since user is actively viewing profile
  //   enabled: !!profileUserId,
  // });

  // Use the profile hook with targetUserId
  const {
    data: profile,
    isLoading: profileLoading,
    isError,
    error: profileFetchError,
    refetch: refetchProfile,
  } = useProfile(targetUserId);

  // Add access control hook (only for own profile)
  const { getUsageDisplay } = useAccessControl();
  const usageData = getUsageDisplay();

  // Modal state for tier badge
  const [showTierModal, setShowTierModal] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);

  // NEW: Toast notification state
  const [toastNotification, setToastNotification] = useState<any>(null);

  // NEW: Global confetti state for upgrade celebration
  const [showPrismaticCelebration, setShowPrismaticCelebration] = useState(false);

  // 🚀 PERFORMANCE OPTIMIZATION: Conditional data loading
  // Only load activity feed for own profile and when on activity tab
  const isActivityTab = tabIndex === 3; // Activity is now tab index 3
  
  const {
    data: activityData,
    isLoading: activityLoading,
    error: activityError,
    refetch: refetchActivity,
  } = useUserActivityFeed(isOwnProfile && isActivityTab ? user?.id : undefined);

  // Pull-to-refresh state and functionality
  const [isRefreshing, setIsRefreshing] = useState(false);

  // NEW: Notification state
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);

  // 🚀 PERFORMANCE OPTIMIZATION: Only load notifications for own profile
  const { data: notifications = [] } = useNotifications(isOwnProfile ? user?.id : undefined);
  const unreadCount = useUnreadNotificationCount(notifications);

  // 🚀 PERFORMANCE OPTIMIZATION: Only setup subscription for own profile
  useNotificationsSubscription(isOwnProfile ? user?.id : undefined, notification => {
    // Show toast for urgent notifications
    if (
      notification.priority === 'urgent' ||
      notification.priority === 'high'
    ) {
      setToastNotification(notification);
    }
  });

  // 🎯 ROBUST SOLUTION: No focus effects needed
  // The robust profile state manager handles all updates properly
  // React Query's intelligent caching ensures data freshness when needed

  // 🚀 OPTIMIZED REFRESH: TikTok/Instagram-style instant feedback
  const handleRefresh = useCallback(async () => {
    // INSTANT FEEDBACK: Set refreshing immediately (no await)
    setIsRefreshing(true);
    
    // OPTIMISTIC UPDATE: Hide refresh indicator quickly like TikTok
    const hideRefreshIndicator = () => {
      setTimeout(() => setIsRefreshing(false), 500); // 500ms max like social apps
    };
    
    try {
      // PARALLEL LOADING: Start all requests simultaneously (no await between them)
      const refreshPromises = [];
      
      // Always refresh profile data
      refreshPromises.push(refetchProfile());
      
      // Only add activity refresh for own profile
      if (isOwnProfile && refetchActivity) {
        refreshPromises.push(refetchActivity());
      }
      
      // BACKGROUND EXECUTION: Don't wait for completion, let React Query handle caching
      Promise.allSettled(refreshPromises).then(() => {
        console.log('[ProfileScreen] 🚀 Background refresh completed');
      }).catch((error) => {
        console.error('[ProfileScreen] Background refresh error:', error);
      });
      
      // INSTANT FEEDBACK: Hide indicator immediately like TikTok/Instagram
      hideRefreshIndicator();
      
    } catch (error) {
      console.error('[ProfileScreen] Refresh error:', error);
      // Even on error, hide quickly to maintain smooth UX
      hideRefreshIndicator();
    }
  }, [refetchProfile, refetchActivity, isOwnProfile]);

  // Create RefreshControl component with TikTok/Instagram-style performance
  const refreshControl = (
    <RefreshControl
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      tintColor={ACTIVE_COLOR}
      colors={[ACTIVE_COLOR]}
      progressBackgroundColor="#fff"
      progressViewOffset={0}
      // Optimized for fast performance like TikTok/Instagram
    />
  );



  // --- Navigation Handler for Upgrade --- (Updated Handler)
  const handleUpgradePress = () => {
    // NEW: Direct modal-based upgrade instead of navigating to old screen
    setShowTierModal(true);
  };
  // --- End Navigation Handler for Upgrade ---

  // --- Navigation Handler for Become Creator --- (Fixed Handler)
  const handleBecomeCreatorPress = () => {
    console.log('[ProfileScreen] ⭐ Navigate to video uploader to start creating content');
    // Navigate directly to video uploader screen for content creation
    navigation.navigate('VideoRecipeUploader');
  };
  // --- End Navigation Handler for Become Creator ---

  // --- Recipe Navigation Handler --- (Fixed to prevent re-renders)
  const handleRecipePress = useCallback((recipeId: string) => {
    navigation.navigate('RecipeDetail', { id: recipeId });
  }, [navigation]);
  // --- End Recipe Navigation Handler ---

  // --- Tier Badge Press Handler ---
  const handleTierBadgePress = () => {
    console.log('[ProfileScreen] 🎯 Tier badge pressed, showing tier modal');
    console.log('[ProfileScreen] Current tierDisplay:', usageData.tierDisplay);
    console.log('[ProfileScreen] Modal logic will show:', 
      usageData.tierDisplay.includes('CREATOR') ? 'CreatorAccountModal' :
      usageData.tierDisplay === 'PREMIUM' ? 'PREMIUM Confirmation Modal' :
      'PremiumUpgradeModal'
    );
    setShowTierModal(true);
  };
  // --- End Tier Badge Press Handler ---

  // --- Sign Out Handler ---
  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
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
            Alert.alert(
              'Sign Out Failed',
              signOutError.message || 'Could not sign out. Please try again.',
            );
          }
        },
      },
    ]);
  };
  // --- End Sign Out Handler ---

  // NEW: Notification handlers
  const handleNotificationBellPress = useCallback(() => {
    setShowNotificationDrawer(true);
  }, []);

  const handleCloseNotificationDrawer = useCallback(() => {
    setShowNotificationDrawer(false);
  }, []);

  const handleNotificationAction = useCallback(
    (notification: any) => {
      // Handle notification actions based on type
      if (notification.metadata?.recipe_id) {
        navigation.navigate('RecipeDetail', {
          id: notification.metadata.recipe_id,
        });
      }
      // Add more action handlers as needed
    },
    [navigation],
  );

  const handleDismissToast = useCallback(() => {
    setToastNotification(null);
  }, []);

  // NEW: Handle upgrade success with global confetti
  const handleUpgradeSuccess = useCallback(() => {
    console.log('[ProfileScreen] 🎆 Triggering upgrade success prismatic celebration');
    setShowPrismaticCelebration(true);
    
    // Auto-hide celebration after prismatic sequence
    setTimeout(() => {
      setShowPrismaticCelebration(false);
    }, 3000); // 3 seconds for premium celebration
  }, []);

  // Navigation handler for "Edit Profile"
  const handleEditProfilePress = () => {
    if (!profile) return; // Guard against profile being null/undefined
    navigation.navigate('EditProfile', {
      initialProfileData: {
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        username: profile.username,
      },
    });
  };

  // Navigation handlers for followers/following
  const handleFollowersPress = useCallback(() => {
    if (!profile) return;
    navigation.navigate('FollowersDetail', {
      userId: targetUserId || profile.user_id || user?.id || '',
      username: profile.username,
      initialTab: 'followers',
    });
  }, [profile, targetUserId, user?.id, navigation]);

  const handleFollowingPress = useCallback(() => {
    if (!profile) return;
    navigation.navigate('FollowersDetail', {
      userId: targetUserId || profile.user_id || user?.id || '',
      username: profile.username,
      initialTab: 'following',
    });
  }, [profile, targetUserId, user?.id, navigation]);

  // Fixed Header Component (stays in place during refresh)
  const renderFixedHeader = () => {
    if (!profile) return null;
    
    return isOwnProfile ? (
      // Own Profile: Show "Kitch Hub" header with actions
      <View style={styles.fixedProfileHeader}>
        <View style={styles.headerSpacer} />
        <Text style={styles.scrollableHeaderTitle}>Kitch Hub</Text>
        <View style={styles.headerActions}>
          <NotificationBell
            unreadCount={unreadCount}
            onPress={handleNotificationBellPress}
            size={26}
            color="#1f2937"
            style={styles.iconBtn}
          />
          <TouchableOpacity style={styles.iconBtn} onPress={handleSignOut}>
            <Icon name="menu" size={26} color="#1f2937" />
          </TouchableOpacity>
        </View>
      </View>
    ) : (
      // Other User's Profile: Show back button and username  
      <View style={styles.fixedProfileHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.scrollableHeaderTitle}>@{profile.username}</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() =>
            Alert.alert(
              'Share Profile',
              'Share functionality to be implemented.',
            )
          }>
          <Icon name="share" size={24} color="#1f2937" />
        </TouchableOpacity>
      </View>
    );
  };

  // Scrollable Profile Content (participates in refresh)
  const renderScrollableProfileContent = () => {
    if (!profile) return <View />;
    
    return (
      <View style={styles.profileInfoContainer}>
        <AvatarRow 
          profile={profile} 
          postsCount={profile.videos?.length || 0}
          onFollowersPress={handleFollowersPress}
          onFollowingPress={handleFollowingPress}
        />
        <Bio
          profile={profile}
          onTierBadgePress={handleTierBadgePress}
          tierDisplay={usageData.tierDisplay}
          showTierBadge={isOwnProfile} // Only show tier badge for own profile
        />

        <View style={styles.buttonRow}>
          {isOwnProfile ? (
            <>
              <TouchableOpacity
                style={styles.editButton}
                onPress={handleEditProfilePress}>
                <Text style={styles.editButtonText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() =>
                  Alert.alert(
                    'Share Profile',
                    'Share functionality to be implemented.',
                  )
                }>
                <Text style={styles.shareButtonText}>Share Profile</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <FollowButton
                targetUserId={profile.user_id || targetUserId || ''}
                style={styles.editButton}
              />
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() =>
                  Alert.alert(
                    'Share Profile',
                    'Share functionality to be implemented.',
                  )
                }>
                <Text style={styles.shareButtonText}>Share Profile</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  // Render current tab content based on selected tab
  const renderCurrentTabContent = () => {
    if (!profile) return <View />;
    
    // For other users' profiles, only show their recipes
    if (!isOwnProfile) {
      return (
        <View style={styles.tabContentContainer}>
          {profile.videos && profile.videos.length > 0 ? (
            <View style={styles.recipeGrid}>
              {profile.videos.map((item) => (
                <ProfileRecipeCard
                  key={item.recipe_id}
                  item={item}
                  onPress={() => navigation.navigate('RecipeDetail', { id: item.recipe_id })}
                  context="otherUserRecipes"
                />
              ))}
            </View>
          ) : (
            <Empty label={`${profile?.username || 'User'} hasn't shared any recipes yet.`} />
          )}
        </View>
      );
    }
    
    // For own profile, show content based on selected tab
    switch (tabIndex) {
      case 0: // My Recipes
        return (
          <View style={styles.tabContentContainer}>
            {profile.videos && profile.videos.length > 0 ? (
              <View style={styles.recipeGrid}>
                {profile.videos.map((item) => (
                  <ProfileRecipeCard
                    key={item.recipe_id}
                    item={item}
                    onPress={() => navigation.navigate('RecipeDetail', { id: item.recipe_id })}
                    context="myRecipes"
                  />
                ))}
              </View>
            ) : (
              <Empty label="No recipes uploaded yet." />
            )}
          </View>
        );
      case 1: // Saved
        return (
          <View style={styles.tabContentContainer}>
            {profile.saved_recipes && profile.saved_recipes.length > 0 ? (
              <View style={styles.recipeGrid}>
                {profile.saved_recipes.map((item) => (
                  <ProfileRecipeCard
                    key={item.recipe_id}
                    item={item}
                    onPress={() => navigation.navigate('RecipeDetail', { id: item.recipe_id })}
                    context="savedRecipes"
                  />
                ))}
              </View>
            ) : (
              <Empty label="No saved recipes yet." />
            )}
          </View>
        );
      case 2: // Planner
        return (
          <View style={styles.tabContentContainer}>
            <MealPlannerV2Screen />
          </View>
        );
      case 3: // Planner
        return (
          <View style={styles.tabContentContainer}>
            <MealPlannerV2Screen />
          </View>
        );
      case 3: // Activity
        return (
          <View style={styles.tabContentContainer}>
            <ActivityFeed
              data={activityData}
              isLoading={activityLoading}
              error={activityError}
            />
          </View>
        );
      default:
        return <View />;
    }
  };

  // Custom tab selector component
  const renderTabSelector = () => (
    <View style={styles.tabSelectorContainer}>
      {isOwnProfile ? (
        <>
          <TouchableOpacity
            style={[styles.tabButton, tabIndex === 0 && styles.activeTabButton]}
            onPress={() => setTabIndex(0)}>
            <View style={styles.tabLabelContainer}>
              <Text style={[
                styles.tabButtonText, 
                tabIndex === 0 && styles.activeTabButtonText,
                { fontSize: tabIndex === 0 ? 13 : 12, lineHeight: 16 }
              ]}>
                My
              </Text>
              <Text style={[
                styles.tabButtonText, 
                tabIndex === 0 && styles.activeTabButtonText,
                { fontSize: tabIndex === 0 ? 13 : 12, lineHeight: 16, marginTop: -2 }
              ]}>
                Recipes
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, tabIndex === 1 && styles.activeTabButton]}
            onPress={() => setTabIndex(1)}>
            <Text style={[styles.tabButtonText, tabIndex === 1 && styles.activeTabButtonText]}>
              Saved
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, tabIndex === 2 && styles.activeTabButton]}
            onPress={() => setTabIndex(2)}>
            <Text style={[styles.tabButtonText, tabIndex === 2 && styles.activeTabButtonText]}>
              Planner
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, tabIndex === 3 && styles.activeTabButton]}
            onPress={() => setTabIndex(3)}>
            <Text style={[styles.tabButtonText, tabIndex === 3 && styles.activeTabButtonText]}>
              Activity
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity
          style={[styles.tabButton, styles.activeTabButton]}
          onPress={() => setTabIndex(0)}>
          <Text style={[styles.tabButtonText, styles.activeTabButtonText]}>
            Recipes
          </Text>
        </TouchableOpacity>
      )}
      <View style={[
        styles.tabIndicator, 
        { 
          left: isOwnProfile 
            ? `${(100 / 4) * tabIndex + (100 / 8) - 5}%`  // Own profile: 4 tabs now
            : '30%'  // Other profile: center single tab
        }
      ]} />
    </View>
  );

  if (profileLoading) return <ProfileScreenSkeleton />;

  if (isError || !profile || typeof profile !== 'object') {
    console.error(
      '[ProfileScreen] Profile error or profile is not an object:',
      { profileFetchError, profile },
    );
    const message =
      profileFetchError?.message ||
      'Failed to load profile. Please try again later.';
    return <ErrorMsg message={message} />;
  }

  return (
    <View style={styles.container}>
      {/* Fixed Green Header - covers status bar area and stays fixed */}
      <View style={styles.fixedGreenHeader}>
        <SafeAreaView edges={['top']} />
      </View>

      {/* Fixed Profile Header - like "My Grocery List" */}
      {renderFixedHeader()}

      {/* Single Unified ScrollView - Everything Below Fixed Header */}
      <ScrollView
        style={styles.unifiedScrollContainer}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
        bounces={true}
        scrollEventThrottle={16}>
        
        {/* Profile Content */}
        {renderScrollableProfileContent()}
        
        {/* Tab Selector */}
        {renderTabSelector()}
        
        {/* Current Tab Content */}
        {renderCurrentTabContent()}
        
      </ScrollView>

      {/* Enhanced Creator/Tier Modal */}
      {usageData.tierDisplay.includes('CREATOR') ? (
        <CreatorAccountModal
          visible={showTierModal}
          onClose={() => setShowTierModal(false)}
          onCreateRecipe={() => navigation.navigate('VideoRecipeUploader')}
          username={profile?.username || 'Creator'}
        />
      ) : usageData.tierDisplay === 'PREMIUM' ? (
        <PremiumFeaturesModal
          visible={showTierModal}
          onClose={() => setShowTierModal(false)}
          onBecomeCreator={handleBecomeCreatorPress}
          username={profile?.username || 'Chef'}
        />
      ) : (
        <PremiumUpgradeModal
          visible={showTierModal}
          onClose={() => setShowTierModal(false)}
          onBecomeCreator={handleBecomeCreatorPress}
          onUpgradeSuccess={handleUpgradeSuccess}
          username={profile?.username || 'Chef'}
        />
      )}

      {/* NEW: Notification Drawer */}
      <NotificationDrawer
        visible={showNotificationDrawer}
        notifications={notifications}
        onClose={handleCloseNotificationDrawer}
        onNotificationAction={handleNotificationAction}
        userId={user?.id}
      />

      {/* NEW: Toast Notification for urgent alerts */}
      {toastNotification && (
        <ToastNotification
          notification={toastNotification}
          visible={!!toastNotification}
          onDismiss={handleDismissToast}
          onPress={() => {
            handleNotificationAction(toastNotification);
            handleDismissToast();
          }}
          position="top"
          duration={6000} // 6 seconds for urgent notifications
        />
      )}

      {/* NEW: Global Prismatic Celebration for Upgrades */}
      <PrismaticCelebration
        visible={showPrismaticCelebration}
        intensity="ultra"
        theme="prismatic"
        onComplete={() => setShowPrismaticCelebration(false)}
      />
    </View>
  );
};

// -----------------------------------------------------------------------------
// Utility Components
// -----------------------------------------------------------------------------
function Loader() {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={ACTIVE_COLOR} />
    </View>
  );
}
const ErrorMsg: React.FC<{ message: string }> = ({ message }) => (
  <View style={styles.center}>
    <Text>{message}</Text>
  </View>
);
const Empty: React.FC<{ label: string }> = ({ label }) => (
  <View style={styles.emptyContainer}>
    <Feather
      name="book-open"
      size={48}
      color="#cbd5e1"
      style={styles.emptyIcon}
    />
    <Text style={styles.emptyText}>{label}</Text>
    <Text style={styles.emptySubText}>
      {label.includes('uploads')
        ? 'Share your culinary creations with the world.'
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
    backgroundColor: '#f5f5f5',
  },
  fullScreenTabContentWithPadding: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfoContainer: {
    backgroundColor: '#fff',
    marginTop: 60, // Further increased spacing for better separation
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
    marginTop: 0,
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
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
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
  tierSection: {
    padding: 16,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginLeft: 10,
    minHeight: 24,
    justifyContent: 'center',
  },
  tierBadgePremium: {
    backgroundColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  tierBadgeFreemium: {
    backgroundColor: '#E8E8E8',
    borderWidth: 1,
    borderColor: '#D0D0D0',
  },
  tierBadgeIcon: {
    marginRight: 5,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  tierBadgeTextPremium: {
    color: '#333',
  },
  tierBadgeTextFreemium: {
    color: '#555',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    maxWidth: 400,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 10,
  },
  usageStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  usageStat: {
    alignItems: 'center',
  },
  usageStatLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  usageStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalSubMessage: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalCancelButton: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 5,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalUpgradeButton: {
    backgroundColor: '#10b981',
    padding: 10,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalUpgradeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 5,
  },
  modalCloseButton: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 5,
    flex: 1,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  statContainer: {
    alignItems: 'center',
  },
  sectionContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  activityContent: {
    padding: 16,
  },
  headerScrollContainer: {
    flex: 1,
  },
  fixedProfileHeader: {
    position: 'absolute',
    top: 50, // Position below green status bar (adjust based on status bar height)
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    height: FIXED_HEADER_HEIGHT,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  unifiedScrollContainer: {
    flex: 1,
    marginTop: FIXED_HEADER_HEIGHT, // Push content below fixed header
  },
  tabSelectorContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
    position: 'relative',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  activeTabButton: {
    // Active state handled by text color
  },
  tabButtonText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#888',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  activeTabButtonText: {
    color: ACTIVE_COLOR,
    fontWeight: '700',
    fontSize: 15,
  },
  tabLabelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContentContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 400,
  },
  recipeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    paddingHorizontal: 0,
    width: '100%',
  },
});

// Add Navigation Prop Type for ProfileScreen context
type ProfileNavigationProp = NativeStackNavigationProp<MainStackParamList>; // Changed to be more general for MainStack

export default ProfileScreen;
