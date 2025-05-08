import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  StyleSheet,
} from 'react-native';
import { useQuery, QueryKey } from '@tanstack/react-query';
import { Tabs, MaterialTabBar } from 'react-native-collapsible-tab-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { supabase } from '../../services/supabase';
import UploadGridItem from '../../components/UploadGridItem'; // Import the actual component
import SavedGrid from '../../components/SavedGrid'; // Import SavedGrid
import ActivityList from '../../components/ActivityList'; // Import ActivityList
import { useNavigation } from '@react-navigation/native'; // Import useNavigation
import { NativeStackNavigationProp } from '@react-navigation/native-stack'; // Import navigation type
import { MainStackParamList } from '../../navigation/types'; // Import param list

// Define types for profile and post data
interface VideoPostData { // Renamed from PostData for clarity
  recipe_id: string;
  recipe_name: string;
  video_url: string;
  // thumbnail_url?: string; // Desirable, to be added if backend provides it
}

interface ProfileData { 
  username: string;
  avatar_url?: string | null;
  followers: number;
  following: number;
  bio?: string | null;
  videos: VideoPostData[]; // Embed video posts data here
  // Add other fields from get_profile_details
}

const ACTIVE_COLOR = '#22c55e'; // Defined active color

// -----------------------------------------------------------------------------
// Hooks (data)
// -----------------------------------------------------------------------------
const useProfile = () =>
  useQuery<ProfileData, Error, ProfileData, QueryKey>({
    queryKey: ['profile'], 
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_profile_details');
      if (error) throw error;
      if (!data) throw new Error('Profile data not found.'); 
      // The RPC returns a single JSON object which is ProfileData
      // Ensure the `videos` field is an array, default to empty if not.
      const profileData = data as any; // Cast to any temporarily to check videos
      return { 
        ...profileData,
        videos: Array.isArray(profileData.videos) ? profileData.videos : [] 
      } as ProfileData;
    }
  });

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------
const Header: React.FC<{ profile: ProfileData }> = ({ profile }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.username}>{profile.username}</Text>
      <View style={styles.headerActions}>
        <TouchableOpacity style={styles.iconBtn}>
          <Icon name="add-box" size={26} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}>
          <Icon name="menu" size={26} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const AvatarRow: React.FC<{ profile: ProfileData; postsCount: number }> = ({ profile, postsCount }) => (
  <View style={styles.avatarRow}>
    {profile.avatar_url ? (
      <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
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
  const { data: profile, isLoading: profileLoading, isError: profileError } = useProfile();
  const [savedItems, setSavedItems] = React.useState<any[]>([]); // Placeholder state
  const [activityItems, setActivityItems] = React.useState<any[]>([]); // Placeholder state
  const navigation = useNavigation<ProfileNavigationProp>(); // Hook for navigation

  if (profileLoading) return <Loader />;
  if (profileError || !profile || typeof profile !== 'object') return <ErrorMsg message="Could not load profile" />;

  // Get user ID to pass to Edit screen (safer than relying on route params there)
  // Note: useProfile already fetches data based on auth.uid() in the RPC
  // We might pass the user ID from auth state if readily available, or fetch it here
  // For now, assuming profile includes user id, or Edit screen refetches based on auth.
  // Let's refine how userId is obtained if needed.
  // const { data: { user } } = await supabase.auth.getUser(); // Example of getting user ID

  // Add handler for navigating to Edit Profile
  const handleEditProfilePress = () => {
    // Pass the necessary initial data and potentially the user ID
    // If profile.id exists from the RPC, use that, otherwise need another way to get user ID
    const userIdFromProfile = (profile as any).id; // Assuming 'id' is returned by get_profile_details
    if (!userIdFromProfile) {
      console.warn('User ID not found in profile data for EditProfile navigation');
      // Optionally get from auth state here if needed
    }
    navigation.navigate('EditProfile', { 
      initialProfileData: {
        bio: profile.bio,
        avatar_url: profile.avatar_url
      },
      userId: userIdFromProfile // Pass the user ID
    });
  };

  const renderHeader = () => (
    <View>
      <Header profile={profile} /> 
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

  const renderGridItem = ({ item }: { item: VideoPostData }) => (
    <UploadGridItem item={item} />
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
            numColumns={3}
            keyExtractor={(item) => item.recipe_id}
            renderItem={renderGridItem} 
            contentContainerStyle={styles.listContentContainer} // Use shared list style
          />
        ) : (
          <Empty label="No uploads yet" />
        )}
      </Tabs.Tab>
      <Tabs.Tab name="Saved" label="Saved">
        {/* Use SavedGrid component */}
        {/* TODO: Replace [] with actual savedItems data when fetched */}
        <SavedGrid data={savedItems} /> 
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
  <View style={styles.center}><Text>{label}</Text></View>
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
  listContentContainer: { // Added shared style for FlatList content padding
     paddingBottom: 80, // Example padding, adjust as needed
     paddingHorizontal: 1.5, // Match grid item margin for alignment
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
});

// Add Navigation Prop Type for ProfileScreen context
type ProfileNavigationProp = NativeStackNavigationProp<MainStackParamList>; // Changed to be more general for MainStack

export default ProfileScreen;
