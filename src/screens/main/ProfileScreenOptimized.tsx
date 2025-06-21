import React, { useState, useCallback, useMemo, useRef, Suspense } from 'react';
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
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tabs, MaterialTabBar } from 'react-native-collapsible-tab-view';
import {
  useSafeAreaInsets,
  SafeAreaView,
} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';

// Optimized imports
import { useAuth } from '../../providers/AuthProvider';
import { useScreenLoadTracking } from '../../hooks/usePerformanceMonitoring';
import {
  ProfileSkeleton,
  RecipeGridSkeleton,
} from '../../components/skeletons';
import { OptimizedFlatList } from '../../components/optimized/OptimizedFlatList';
import { supabase } from '../../services/supabase';
import { MainStackParamList } from '../../navigation/types';

// Import these directly since they may not have default exports
import { FollowButton } from '../../components/FollowButton';
import { NotificationBell } from '../../components/NotificationBell';
import { NotificationDrawer } from '../../components/NotificationDrawer';
import { ToastNotification } from '../../components/ToastNotification';
import { TierDisplay } from '../../components/TierDisplay';

// Lazy-loaded components for better performance - fix default exports
const ProfileRecipeCard = React.lazy(
  () => import('../../components/ProfileRecipeCard'),
);
const ActivityFeed = React.lazy(() => import('../../components/ActivityFeed'));
const MealPlannerV2Screen = React.lazy(
  () => import('./meal_planner_v2/MealPlannerV2Screen'),
);

// Types
interface VideoPostData {
  recipe_id: string;
  recipe_name: string;
  video_url: string;
  thumbnail_url: string | null;
  created_at: string;
  creator_user_id: string;
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
const ACTIVE_COLOR = '#22c55e';
const RECIPE_CARD_HEIGHT = 200;
const AVATAR_SIZE = 80;

// Optimized hooks
const useOptimizedProfile = (targetUserId?: string) => {
  const { user } = useAuth();
  const userId = targetUserId || user?.id;

  return useQuery<ProfileData, Error>({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required for profile fetch');

      const { data: rawData, error: rpcError } = await supabase.rpc(
        'get_profile_details',
        { p_user_id: userId },
      );

      if (rpcError) {
        console.error('[useOptimizedProfile] Supabase RPC Error:', rpcError);
        throw rpcError;
      }
      if (!rawData) {
        console.error(
          '[useOptimizedProfile] No data received from RPC for user:',
          userId,
        );
        throw new Error('Profile data not found.');
      }

      const profileDataBackend = rawData as any;

      // Optimized data processing with better error handling
      const processedUploadedVideos: VideoPostData[] = Array.isArray(
        profileDataBackend.recipes,
      )
        ? profileDataBackend.recipes
            .map((recipe: any, index: number) => ({
              recipe_id: recipe.recipe_id || recipe.id || `recipe_${index}`,
              recipe_name:
                recipe.title ||
                recipe.recipe_name ||
                recipe.name ||
                'Untitled Recipe',
              video_url: recipe.video_url || recipe.videoUrl || '',
              thumbnail_url:
                recipe.thumbnail_url || recipe.thumbnailUrl || null,
              created_at:
                recipe.created_at ||
                recipe.createdAt ||
                new Date().toISOString(),
              creator_user_id:
                recipe.creator_user_id ||
                recipe.creatorUserId ||
                recipe.user_id ||
                userId,
            }))
            .filter(
              (recipe: VideoPostData) => recipe.recipe_id && recipe.recipe_name,
            )
        : [];

      const processedSavedRecipes: VideoPostData[] = Array.isArray(
        profileDataBackend.saved_recipes,
      )
        ? profileDataBackend.saved_recipes
            .map((recipe: any, index: number) => ({
              recipe_id:
                recipe.recipe_id || recipe.id || `saved_recipe_${index}`,
              recipe_name:
                recipe.title ||
                recipe.recipe_name ||
                recipe.name ||
                'Untitled Recipe',
              video_url: recipe.video_url || recipe.videoUrl || '',
              thumbnail_url:
                recipe.thumbnail_url || recipe.thumbnailUrl || null,
              created_at:
                recipe.created_at ||
                recipe.createdAt ||
                new Date().toISOString(),
              creator_user_id:
                recipe.creator_user_id ||
                recipe.creatorUserId ||
                recipe.user_id ||
                userId,
            }))
            .filter(
              (recipe: VideoPostData) => recipe.recipe_id && recipe.recipe_name,
            )
        : [];

      return {
        username: profileDataBackend.username || 'Unknown User',
        avatar_url: profileDataBackend.avatar_url || null,
        followers: profileDataBackend.followers || 0,
        following: profileDataBackend.following || 0,
        bio: profileDataBackend.bio || null,
        videos: processedUploadedVideos,
        saved_recipes: processedSavedRecipes,
        user_id: userId,
      };
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Lazy-loaded hooks for better performance
const useOptimizedNotifications = (userId?: string) => {
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return [];
      // Implement notification fetching logic
      return [];
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

const useOptimizedActivityFeed = (userId?: string) => {
  return useQuery({
    queryKey: ['activityFeed', userId],
    queryFn: async () => {
      if (!userId) return [];
      // Implement activity feed fetching logic
      return [];
    },
    enabled: !!userId,
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
};

const useOptimizedAccessControl = () => {
  return useMemo(
    () => ({
      getUsageDisplay: () => ({
        tierDisplay: 'FREEMIUM',
        usagePercentage: 0,
      }),
    }),
    [],
  );
};

// Memoized components
const OptimizedAvatar = React.memo<{
  avatarUrl?: string | null;
  size?: number;
}>(({ avatarUrl, size = AVATAR_SIZE }) => {
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[
          styles.avatar,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
        loadingIndicatorSource={{
          uri: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        }}
      />
    );
  }

  return (
    <View
      style={[
        styles.avatarPlaceholder,
        { width: size, height: size, borderRadius: size / 2 },
      ]}>
      <Icon name="person" size={size * 0.45} color="#a3a3a3" />
    </View>
  );
});
OptimizedAvatar.displayName = 'OptimizedAvatar';

const OptimizedStat = React.memo<{ label: string; value: number }>(
  ({ label, value }) => (
    <View style={styles.statContainer}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  ),
);
OptimizedStat.displayName = 'OptimizedStat';

const OptimizedAvatarRow = React.memo<{
  profile: ProfileData;
  postsCount: number;
}>(({ profile, postsCount }) => (
  <View style={styles.avatarRow}>
    <OptimizedAvatar avatarUrl={profile.avatar_url} />
    <View style={styles.statsRow}>
      <OptimizedStat label="Posts" value={postsCount} />
      <OptimizedStat label="Followers" value={profile.followers ?? 0} />
      <OptimizedStat label="Following" value={profile.following ?? 0} />
    </View>
  </View>
));
OptimizedAvatarRow.displayName = 'OptimizedAvatarRow';

const OptimizedBio = React.memo<{
  profile: ProfileData;
  onTierBadgePress: () => void;
  tierDisplay: string;
  showTierBadge: boolean;
}>(({ profile, onTierBadgePress, tierDisplay, showTierBadge }) => (
  <View style={styles.bioContainer}>
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
OptimizedBio.displayName = 'OptimizedBio';

// Optimized Tab Content with lazy loading
const OptimizedTabContent = React.memo<{
  data: VideoPostData[];
  context: 'myRecipes' | 'savedRecipes' | 'otherUserRecipes';
  emptyLabel: string;
  refreshControl?: any;
}>(({ data, context, emptyLabel, refreshControl }) => {
  const navigation = useNavigation<ProfileNavigationProp>();

  const renderItem = useCallback(
    ({ item }: { item: VideoPostData }) => (
      <Suspense fallback={<View style={styles.cardSkeleton} />}>
        <ProfileRecipeCard
          item={item}
          onPress={() =>
            navigation.navigate('RecipeDetail', { id: item.recipe_id })
          }
          context={context}
        />
      </Suspense>
    ),
    [navigation, context],
  );

  const keyExtractor = useCallback(
    (item: VideoPostData) =>
      context === 'savedRecipes' ? `saved-${item.recipe_id}` : item.recipe_id,
    [context],
  );

  const emptyComponent = useMemo(
    () => (
      <View style={styles.emptyContainer}>
        <Feather
          name="archive"
          size={48}
          color="#cbd5e1"
          style={styles.emptyIcon}
        />
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    ),
    [emptyLabel],
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
      style={styles.fullScreenTabContent}
      removeClippedSubviews
      maxToRenderPerBatch={6}
      windowSize={8}
      initialNumToRender={4}
      updateCellsBatchingPeriod={50}
      getItemLayout={(data, index) => ({
        length: RECIPE_CARD_HEIGHT,
        offset: RECIPE_CARD_HEIGHT * Math.floor(index / 2),
        index,
      })}
      refreshControl={refreshControl}
    />
  );
});
OptimizedTabContent.displayName = 'OptimizedTabContent';

// Main ProfileScreen component
export const ProfileScreenOptimized = React.memo(() => {
  const { user } = useAuth();
  const route = useRoute();
  const navigation = useNavigation<ProfileNavigationProp>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  // Performance tracking
  useScreenLoadTracking('ProfileScreen');

  // Route params
  const routeParams = route.params as ProfileScreenParams | undefined;
  const targetUserId = routeParams?.userId;
  const isOwnProfile = !targetUserId || targetUserId === user?.id;

  // Optimized data fetching
  const {
    data: profile,
    isLoading: profileLoading,
    isError,
    error: profileFetchError,
    refetch: refetchProfile,
  } = useOptimizedProfile(targetUserId);

  // Conditional hooks for better performance
  const { getUsageDisplay } = useOptimizedAccessControl();
  const usageData = getUsageDisplay();

  const { data: notifications = [] } = useOptimizedNotifications(
    isOwnProfile ? user?.id : undefined,
  );
  const { data: activityData = [] } = useOptimizedActivityFeed(
    isOwnProfile ? user?.id : undefined,
  );

  // State
  const [showTierModal, setShowTierModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);
  const [toastNotification, setToastNotification] = useState<any>(null);

  // Memoized values
  const unreadCount = useMemo(
    () => notifications.length,
    [notifications.length],
  );
  const postsCount = useMemo(
    () => profile?.videos?.length || 0,
    [profile?.videos?.length],
  );

  // Optimized handlers
  const handleAddRecipePress = useCallback(() => {
    navigation.navigate('CreateRecipe' as never);
  }, [navigation]);

  const handleTierBadgePress = useCallback(() => {
    setShowTierModal(true);
  }, []);

  const handleSignOut = useCallback(async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.auth.signOut();
          } catch (error) {
            console.error('[ProfileScreen] Sign out error:', error);
          }
        },
      },
    ]);
  }, []);

  const handleNotificationBellPress = useCallback(() => {
    setShowNotificationDrawer(true);
  }, []);

  const handleEditProfilePress = useCallback(() => {
    if (!profile) return;
    navigation.navigate('EditProfile', {
      initialProfileData: {
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        username: profile.username,
      },
    });
  }, [navigation, profile]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchProfile(),
        queryClient.invalidateQueries({
          queryKey: ['notifications', user?.id],
        }),
        queryClient.invalidateQueries({ queryKey: ['activityFeed', user?.id] }),
      ]);
    } catch (error) {
      console.error('[ProfileScreen] Refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchProfile, queryClient, user?.id]);

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={isRefreshing}
        onRefresh={onRefresh}
        colors={[ACTIVE_COLOR]}
        tintColor={ACTIVE_COLOR}
      />
    ),
    [isRefreshing, onRefresh],
  );

  // Memoized header component
  const renderProfileInfo = useCallback(
    () => (
      <View style={styles.profileInfoContainer}>
        {isOwnProfile ? (
          <View style={styles.scrollableHeader}>
            <View style={styles.headerSpacer} />
            <Text style={styles.scrollableHeaderTitle}>Kitch Hub</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={handleAddRecipePress}>
                <Icon name="add-box" size={26} color="#10b981" />
              </TouchableOpacity>
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
          <View style={styles.scrollableHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}>
              <Icon name="arrow-back" size={24} color="#1f2937" />
            </TouchableOpacity>
            <Text style={styles.scrollableHeaderTitle}>
              @{profile?.username}
            </Text>
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
        )}

        <OptimizedAvatarRow profile={profile!} postsCount={postsCount} />
        <OptimizedBio
          profile={profile!}
          onTierBadgePress={handleTierBadgePress}
          tierDisplay={usageData.tierDisplay}
          showTierBadge={isOwnProfile}
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
                targetUserId={profile?.user_id || targetUserId || ''}
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
    ),
    [
      isOwnProfile,
      profile,
      postsCount,
      usageData.tierDisplay,
      unreadCount,
      handleAddRecipePress,
      handleNotificationBellPress,
      handleSignOut,
      handleEditProfilePress,
      handleTierBadgePress,
      navigation,
      targetUserId,
    ],
  );

  // Loading state with skeleton
  if (profileLoading && !profile) {
    return (
      <View style={styles.container}>
        <View style={styles.fixedGreenHeader}>
          <SafeAreaView edges={['top']} />
        </View>
        <View style={[styles.tabsContainer, { paddingTop: insets.top + 50 }]}>
          <ProfileSkeleton />
        </View>
      </View>
    );
  }

  // Error state
  if (isError || !profile) {
    const message =
      profileFetchError?.message ||
      'Failed to load profile. Please try again later.';
    return (
      <View style={styles.container}>
        <View style={styles.fixedGreenHeader}>
          <SafeAreaView edges={['top']} />
        </View>
        <View style={[styles.errorContainer, { paddingTop: insets.top + 50 }]}>
          <Icon name="error-outline" size={48} color="#ef4444" />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{message}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.fixedGreenHeader}>
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
                getLabelText={(name: string) => name}
              />
            )}>
            <Tabs.Tab name="My Recipes" label="My Recipes">
              <OptimizedTabContent
                data={profile.videos}
                context="myRecipes"
                emptyLabel="No recipes uploaded yet."
                refreshControl={refreshControl}
              />
            </Tabs.Tab>
            <Tabs.Tab name="Saved" label="Saved">
              <OptimizedTabContent
                data={profile.saved_recipes}
                context="savedRecipes"
                emptyLabel="No saved recipes yet."
                refreshControl={refreshControl}
              />
            </Tabs.Tab>
            <Tabs.Tab name="Planner" label="Planner">
              <Tabs.ScrollView
                style={styles.fullScreenTabContent}
                refreshControl={refreshControl}>
                <Suspense fallback={<RecipeGridSkeleton itemCount={4} />}>
                  <MealPlannerV2Screen />
                </Suspense>
              </Tabs.ScrollView>
            </Tabs.Tab>
            <Tabs.Tab name="Activity" label="Activity">
              <Tabs.ScrollView
                style={styles.fullScreenTabContent}
                refreshControl={refreshControl}>
                <Suspense fallback={<RecipeGridSkeleton itemCount={4} />}>
                  <ActivityFeed
                    data={activityData}
                    isLoading={false}
                    error={null}
                  />
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
                getLabelText={(name: string) => name}
              />
            )}>
            <Tabs.Tab name="Recipes" label="Recipes">
              <OptimizedTabContent
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

      {/* Toast Notification */}
      {toastNotification && (
        <ToastNotification
          visible
          notification={toastNotification}
          onDismiss={() => setToastNotification(null)}
        />
      )}
    </View>
  );
});

ProfileScreenOptimized.displayName = 'ProfileScreenOptimized';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  fixedGreenHeader: {
    backgroundColor: '#10b981',
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
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#fff',
  },
  avatar: {
    borderWidth: 3,
    borderColor: '#10b981',
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
    fontSize: 13,
    color: '#737373',
    marginTop: 2,
    fontWeight: '500',
  },
  bioContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
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
    marginRight: 4,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tierBadgeTextPremium: {
    color: '#333',
  },
  tierBadgeTextFreemium: {
    color: '#666',
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
    textAlign: 'center',
  },
  cardSkeleton: {
    width: (Dimensions.get('window').width - 32) / 2,
    height: RECIPE_CARD_HEIGHT,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    margin: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: ACTIVE_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
});

export default ProfileScreenOptimized;
