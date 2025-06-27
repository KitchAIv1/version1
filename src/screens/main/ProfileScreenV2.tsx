import React, { useState, useCallback, useMemo, Suspense } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  RefreshControl,
  Modal,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Tabs, MaterialTabBar } from 'react-native-collapsible-tab-view';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';

// Services and types
import { supabase } from '../../services/supabase';
import { MainStackParamList } from '../../navigation/types';
import { useAuth } from '../../providers/AuthProvider';

// Components
import ProfileRecipeCard from '../../components/ProfileRecipeCard';
import ActivityFeed from '../../components/ActivityFeed';
import MealPlannerV2Screen from './meal_planner_v2/MealPlannerV2Screen';
import { ProfileScreenSkeleton, RecipeGridSkeleton } from '../../components/ProfileScreenSkeletons';
import { FollowButton } from '../../components/FollowButton';
import { TierDisplay } from '../../components/TierDisplay';
import { NotificationBell } from '../../components/NotificationBell';
import { NotificationDrawer } from '../../components/NotificationDrawer';

// Hooks
import { useUserActivityFeed } from '../../hooks/useUserActivityFeed';
import { useAccessControl } from '../../hooks/useAccessControl';
import { useNotifications, useUnreadNotificationCount } from '../../hooks/useNotifications';

// Types
interface VideoPostData {
  recipe_id: string;
  recipe_name: string;
  video_url: string;
  thumbnail_url: string | null;
  created_at: string;
  creator_user_id: string;
  is_ai_generated?: boolean;
}

interface ProfileData {
  username: string;
  avatar_url?: string | null;
  followers: number;
  following: number;
  bio?: string | null;
  videos: VideoPostData[];
  saved_recipes: VideoPostData[];
  user_id?: string;
}

interface ProfileScreenParams {
  userId?: string;
}

type ProfileNavigationProp = NativeStackNavigationProp<MainStackParamList>;

// Constants
const ACTIVE_COLOR = '#10b981';
const RECIPE_CARD_HEIGHT = 200;

// 🎯 ROBUST DATA LAYER: Isolated profile management with proper error handling
class ProfileDataManager {
  private queryClient: any;

  constructor(queryClient: any) {
    this.queryClient = queryClient;
  }

  // 🔒 ISOLATED FETCH: No side effects, pure data fetching
  async fetchProfile(userId: string): Promise<ProfileData> {
    if (!userId) throw new Error('User ID is required');

    try {
      const { data: rawData, error } = await supabase.rpc('get_profile_details', {
        p_user_id: userId,
      });

      if (error) throw error;
      if (!rawData) throw new Error('Profile not found');

      const profileDataBackend = rawData as any;
      const profileInfo = profileDataBackend.profile || {};

      // Process recipes with proper error handling
      const processedUploadedVideos = this.processRecipes(
        profileDataBackend.recipes,
        userId,
        'uploaded'
      );
      
      const processedSavedRecipes = this.processRecipes(
        profileDataBackend.saved_recipes,
        userId,
        'saved'
      );

      return {
        username: profileInfo.username || 'Unknown User',
        avatar_url: profileInfo.avatar_url || null,
        followers: profileInfo.followers || 0,
        following: profileInfo.following || 0,
        bio: profileInfo.bio || null,
        videos: processedUploadedVideos,
        saved_recipes: processedSavedRecipes,
        user_id: userId,
      };
    } catch (error) {
      console.error('[ProfileDataManager] Fetch error:', error);
      throw error;
    }
  }

  // 🔧 HELPER: Process recipes with proper validation
  private processRecipes(recipes: any[], userId: string, type: 'uploaded' | 'saved'): VideoPostData[] {
    if (!Array.isArray(recipes)) return [];

    return recipes
      .map((recipe, index) => ({
        recipe_id: recipe.recipe_id || `${type}_${index}`,
        recipe_name: recipe.title || 'Untitled Recipe',
        video_url: recipe.video_url || '',
        thumbnail_url: recipe.thumbnail_url || null,
        created_at: recipe.created_at || new Date().toISOString(),
        creator_user_id: recipe.creator_user_id || userId,
        is_ai_generated: recipe.is_ai_generated || false,
      }))
      .filter(recipe => recipe.recipe_id && recipe.recipe_name);
  }

  // 🔄 SMART REFRESH: Only invalidate when actually needed
  refreshProfile(userId: string) {
    console.log('[ProfileDataManager] Smart refresh for user:', userId);
    this.queryClient.invalidateQueries({ 
      queryKey: ['profile-v2', userId],
      exact: true 
    });
  }

  // 🧹 CLEANUP: Remove stale data
  clearProfileCache(userId: string) {
    this.queryClient.removeQueries({ 
      queryKey: ['profile-v2', userId] 
    });
  }
}

// 🎯 ROBUST PROFILE HOOK: Isolated, predictable, error-resistant
const useProfileV2 = (targetUserId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = targetUserId || user?.id;
  const isOwnProfile = !targetUserId || targetUserId === user?.id;

  // Create isolated data manager
  const dataManager = useMemo(
    () => new ProfileDataManager(queryClient),
    [queryClient]
  );

  const profileQuery = useQuery<ProfileData, Error>({
    queryKey: ['profile-v2', userId],
    queryFn: () => dataManager.fetchProfile(userId!),
    enabled: !!userId,
    staleTime: isOwnProfile ? 30 * 1000 : 5 * 60 * 1000, // Own: 30s, Others: 5min
    gcTime: isOwnProfile ? 2 * 60 * 1000 : 10 * 60 * 1000, // Own: 2min, Others: 10min
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // 🔄 MUTATION: Handle profile updates with proper state management
  const updateMutation = useMutation({
    mutationFn: async (updateData: Partial<ProfileData>) => {
      // Optimistic update - immediately update UI
      queryClient.setQueryData(['profile-v2', userId], (oldData: ProfileData | undefined) => {
        if (!oldData) return oldData;
        return { ...oldData, ...updateData };
      });

      // Background refresh to get real data
      setTimeout(() => {
        dataManager.refreshProfile(userId!);
      }, 500);

      return updateData;
    },
    onError: (error) => {
      console.error('[useProfileV2] Update error:', error);
      // Revert optimistic update on error
      dataManager.refreshProfile(userId!);
    },
  });

  return {
    ...profileQuery,
    isOwnProfile,
    dataManager,
    updateProfile: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
};

// 🎯 ISOLATED COMPONENT: Avatar with proper memoization
const Avatar = React.memo<{ avatarUrl?: string | null; size?: number }>(
  ({ avatarUrl, size = 80 }) => {
    if (avatarUrl) {
      return (
        <Image
          source={{ uri: avatarUrl }}
          style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
        />
      );
    }

    return (
      <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
        <Icon name="person" size={size * 0.45} color="#a3a3a3" />
      </View>
    );
  }
);

// 🎯 ISOLATED COMPONENT: Stats with proper memoization
const Stat = React.memo<{ label: string; value: number; onPress?: () => void }>(
  ({ label, value, onPress }) => (
    <TouchableOpacity style={styles.statContainer} onPress={onPress} disabled={!onPress}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </TouchableOpacity>
  )
);

// 🎯 ISOLATED COMPONENT: Bio section
const Bio = React.memo<{
  profile: ProfileData;
  onTierBadgePress: () => void;
  tierDisplay: string;
  showTierBadge: boolean;
}>(({ profile, onTierBadgePress, tierDisplay, showTierBadge }) => (
  <View style={styles.bioContainer}>
    <View style={styles.usernameRow}>
      <Text style={styles.bioName}>{profile.username}</Text>
      {showTierBadge && (
        <TouchableOpacity style={styles.tierBadge} onPress={onTierBadgePress}>
          <Text style={styles.tierBadgeText}>{tierDisplay}</Text>
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

// 🎯 ISOLATED COMPONENT: Recipe Tab Content
const RecipeTabContent = React.memo<{
  data: VideoPostData[];
  context: 'myRecipes' | 'savedRecipes' | 'otherUserRecipes';
  emptyLabel: string;
  refreshControl?: any;
}>(({ data, context, emptyLabel, refreshControl }) => {
  const navigation = useNavigation<ProfileNavigationProp>();

  const renderItem = useCallback(
    ({ item }: { item: VideoPostData }) => (
      <ProfileRecipeCard
        item={item}
        onPress={() => navigation.navigate('RecipeDetail', { id: item.recipe_id })}
        context={context}
      />
    ),
    [navigation, context]
  );

  const keyExtractor = useCallback(
    (item: VideoPostData) => `${context}-${item.recipe_id}`,
    [context]
  );

  const emptyComponent = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Feather name="archive" size={48} color="#cbd5e1" />
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    ),
    [emptyLabel]
  );

  return (
    <Tabs.FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={2}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={emptyComponent}
      contentContainerStyle={styles.gridContentContainer}
      removeClippedSubviews
      maxToRenderPerBatch={6}
      windowSize={8}
      initialNumToRender={4}
      refreshControl={refreshControl}
    />
  );
});

// 🎯 MAIN COMPONENT: ProfileScreenV2 with robust architecture
const ProfileScreenV2: React.FC = () => {
  const { user } = useAuth();
  const route = useRoute();
  const navigation = useNavigation<ProfileNavigationProp>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  // Route params
  const routeParams = route.params as ProfileScreenParams | undefined;
  const targetUserId = routeParams?.userId;

  // Data fetching with robust error handling
  const {
    data: profile,
    isLoading,
    isError,
    error,
    refetch,
    isOwnProfile,
    dataManager,
    updateProfile,
    isUpdating,
  } = useProfileV2(targetUserId);

  // Additional hooks only for own profile
  const { getUsageDisplay } = useAccessControl();
  const usageData = getUsageDisplay();
  
  const { data: notifications = [] } = useNotifications(isOwnProfile ? user?.id : undefined);
  const unreadCount = useUnreadNotificationCount(notifications);
  
  const { data: activityData = [] } = useUserActivityFeed(isOwnProfile ? user?.id : undefined);

  // State
  const [showTierModal, setShowTierModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);

  // 🎯 EVENT HANDLERS: Stable, isolated functions
  const handleEditProfilePress = useCallback(() => {
    if (!profile) return;
    
    // Pass update callback to EditProfile screen for immediate UI updates
    navigation.navigate('EditProfile', {
      initialProfileData: {
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        username: profile.username,
      },
      onProfileUpdate: (updatedData: Partial<ProfileData>) => {
        // Immediate optimistic update
        updateProfile(updatedData);
      },
    });
  }, [navigation, profile, updateProfile]);

  const handleRefresh = useCallback(async () => {
    if (!user?.id) return;
    
    setIsRefreshing(true);
    try {
      await refetch();
      
      // Also refresh related data
      queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
      queryClient.invalidateQueries({ queryKey: ['activityFeed', user.id] });
    } catch (error) {
      console.error('[ProfileScreenV2] Refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, queryClient, user?.id]);

  const handleFollowersPress = useCallback(() => {
    if (!profile) return;
    navigation.navigate('FollowersDetail', {
      userId: profile.user_id || user?.id || '',
      username: profile.username,
      initialTab: 'followers',
    });
  }, [navigation, profile, user?.id]);

  const handleFollowingPress = useCallback(() => {
    if (!profile) return;
    navigation.navigate('FollowersDetail', {
      userId: profile.user_id || user?.id || '',
      username: profile.username,
      initialTab: 'following',
    });
  }, [navigation, profile, user?.id]);

  // 🎯 MEMOIZED VALUES: Prevent unnecessary re-renders
  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        colors={[ACTIVE_COLOR]}
        tintColor={ACTIVE_COLOR}
      />
    ),
    [isRefreshing, handleRefresh]
  );

  const postsCount = useMemo(() => profile?.videos?.length || 0, [profile?.videos?.length]);

  // 🎯 RENDER HEADER: Memoized for performance
  const renderProfileInfo = useCallback(
    () => (
      <View style={styles.profileInfoContainer}>
        {/* Header */}
        <View style={styles.header}>
          {isOwnProfile ? (
            <>
              <Text style={styles.headerTitle}>Kitch Hub</Text>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => navigation.navigate('VideoRecipeUploader')}>
                  <Icon name="add-box" size={26} color={ACTIVE_COLOR} />
                </TouchableOpacity>
                <NotificationBell
                  unreadCount={unreadCount}
                  onPress={() => setShowNotificationDrawer(true)}
                />
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => Alert.alert('Menu', 'Settings coming soon!')}>
                  <Icon name="menu" size={26} color="#1f2937" />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}>
                <Icon name="arrow-back" size={24} color="#1f2937" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>@{profile?.username}</Text>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => Alert.alert('Share', 'Share functionality coming soon!')}>
                <Icon name="share" size={24} color="#1f2937" />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Avatar and Stats */}
        <View style={styles.avatarRow}>
          <Avatar avatarUrl={profile?.avatar_url} />
          <View style={styles.statsRow}>
            <Stat label="Posts" value={postsCount} />
            <Stat label="Followers" value={profile?.followers || 0} onPress={handleFollowersPress} />
            <Stat label="Following" value={profile?.following || 0} onPress={handleFollowingPress} />
          </View>
        </View>

        {/* Bio */}
        <Bio
          profile={profile!}
          onTierBadgePress={() => setShowTierModal(true)}
          tierDisplay={usageData.tierDisplay}
          showTierBadge={isOwnProfile}
        />

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          {isOwnProfile ? (
            <>
              <TouchableOpacity
                style={[styles.editButton, isUpdating && styles.editButtonDisabled]}
                onPress={handleEditProfilePress}
                disabled={isUpdating}>
                {isUpdating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.editButtonText}>Edit Profile</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => Alert.alert('Share', 'Share functionality coming soon!')}>
                <Text style={styles.shareButtonText}>Share Profile</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <FollowButton
                targetUserId={profile?.user_id || targetUserId || ''}
                style={styles.editButton}
              />
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => Alert.alert('Share', 'Share functionality coming soon!')}>
                <Text style={styles.shareButtonText}>Share Profile</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    ),
    [
      isOwnProfile,
      profile,
      postsCount,
      unreadCount,
      usageData.tierDisplay,
      isUpdating,
      navigation,
      targetUserId,
      handleEditProfilePress,
      handleFollowersPress,
      handleFollowingPress,
    ]
  );

  // 🎯 LOADING STATE
  if (isLoading && !profile) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <SafeAreaView edges={['top']} />
        </View>
        <ProfileScreenSkeleton />
      </View>
    );
  }

  // 🎯 ERROR STATE
  if (isError || !profile) {
    const message = error?.message || 'Failed to load profile. Please try again.';
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <SafeAreaView edges={['top']} />
        </View>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color="#ef4444" />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // 🎯 MAIN RENDER
  return (
    <View style={styles.container}>
      <View style={styles.fixedHeader}>
        <SafeAreaView edges={['top']} />
      </View>

      <View style={[styles.tabsContainer, { paddingTop: insets.top + 50 }]}>
        {isOwnProfile ? (
          <Tabs.Container
            renderHeader={renderProfileInfo}
            headerHeight={undefined}
            allowHeaderOverscroll={false}
            renderTabBar={props => (
              <MaterialTabBar
                {...props}
                activeColor={ACTIVE_COLOR}
                inactiveColor="#525252"
                labelStyle={styles.tabLabel}
                indicatorStyle={styles.tabIndicator}
                style={styles.materialTabBar}
              />
            )}>
            <Tabs.Tab name="My Recipes" label="My Recipes">
              <RecipeTabContent
                data={profile.videos}
                context="myRecipes"
                emptyLabel="No recipes uploaded yet."
                refreshControl={refreshControl}
              />
            </Tabs.Tab>
            <Tabs.Tab name="Saved" label="Saved">
              <RecipeTabContent
                data={profile.saved_recipes}
                context="savedRecipes"
                emptyLabel="No saved recipes yet."
                refreshControl={refreshControl}
              />
            </Tabs.Tab>
            <Tabs.Tab name="Planner" label="Planner">
              <Tabs.ScrollView refreshControl={refreshControl}>
                <Suspense fallback={<RecipeGridSkeleton itemCount={4} />}>
                  <MealPlannerV2Screen />
                </Suspense>
              </Tabs.ScrollView>
            </Tabs.Tab>
            <Tabs.Tab name="Activity" label="Activity">
              <Tabs.ScrollView refreshControl={refreshControl}>
                <Suspense fallback={<RecipeGridSkeleton itemCount={4} />}>
                  <ActivityFeed data={activityData} isLoading={false} error={null} />
                </Suspense>
              </Tabs.ScrollView>
            </Tabs.Tab>
          </Tabs.Container>
        ) : (
          <Tabs.Container
            renderHeader={renderProfileInfo}
            headerHeight={undefined}
            allowHeaderOverscroll={false}
            renderTabBar={props => (
              <MaterialTabBar
                {...props}
                activeColor={ACTIVE_COLOR}
                inactiveColor="#525252"
                labelStyle={styles.tabLabel}
                indicatorStyle={styles.tabIndicator}
                style={styles.materialTabBar}
              />
            )}>
            <Tabs.Tab name="Recipes" label="Recipes">
              <RecipeTabContent
                data={profile.videos}
                context="otherUserRecipes"
                emptyLabel={`${profile.username} hasn't shared any recipes yet.`}
                refreshControl={refreshControl}
              />
            </Tabs.Tab>
          </Tabs.Container>
        )}
      </View>

      {/* Tier Modal */}
      <Modal
        visible={showTierModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTierModal(false)}>
        <View style={styles.modalOverlay}>
          <Animated.View
            entering={SlideInDown.duration(300)}
            exiting={SlideOutDown.duration(200)}
            style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowTierModal(false)}>
              <Icon name="close" size={24} color="#666" />
            </TouchableOpacity>
            <TierDisplay />
          </Animated.View>
        </View>
      </Modal>

      {/* Notification Drawer */}
      <NotificationDrawer
        visible={showNotificationDrawer}
        onClose={() => setShowNotificationDrawer(false)}
        notifications={notifications}
      />
    </View>
  );
};

// 🎯 STYLES: Clean, organized styling
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  fixedHeader: {
    backgroundColor: ACTIVE_COLOR,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  tabsContainer: {
    flex: 1,
    zIndex: 1,
  },
  profileInfoContainer: {
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    padding: 8,
    marginLeft: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  avatar: {
    borderWidth: 3,
    borderColor: ACTIVE_COLOR,
  },
  avatarPlaceholder: {
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
  statContainer: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#262626',
  },
  statLabel: {
    fontSize: 12,
    color: '#737373',
    marginTop: 2,
  },
  bioContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  bioName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
  },
  tierBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  bioText: {
    fontSize: 14,
    color: '#525252',
    lineHeight: 20,
  },
  bioEmpty: {
    fontSize: 14,
    color: '#a3a3a3',
    fontStyle: 'italic',
  },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  editButton: {
    flex: 1,
    backgroundColor: ACTIVE_COLOR,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonDisabled: {
    opacity: 0.6,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 16,
    marginTop: 12,
  },
  gridContentContainer: {
    padding: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ef4444',
    marginTop: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    backgroundColor: ACTIVE_COLOR,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabIndicator: {
    backgroundColor: ACTIVE_COLOR,
  },
  materialTabBar: {
    backgroundColor: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
  },
});

ProfileScreenV2.displayName = 'ProfileScreenV2';

export default ProfileScreenV2; 