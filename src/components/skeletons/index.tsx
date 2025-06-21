import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Base skeleton styles
const skeletonStyles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  shimmer: {
    backgroundColor: '#e0e0e0',
  },
  // Pantry Item Skeleton
  pantrySkeletonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  pantrySkeletonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  pantrySkeletonContent: {
    flex: 1,
  },
  pantrySkeletonTitle: {
    height: 16,
    width: '70%',
    marginBottom: 8,
    borderRadius: 4,
  },
  pantrySkeletonSubtitle: {
    height: 12,
    width: '50%',
    borderRadius: 4,
  },
  pantrySkeletonActions: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  // Feed Item Skeleton
  feedSkeletonContainer: {
    width: screenWidth,
    height: screenHeight,
    backgroundColor: '#000',
    position: 'relative',
  },
  feedSkeletonVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  feedSkeletonOverlay: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
  },
  feedSkeletonProfile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 12,
  },
  feedSkeletonTitle: {
    height: 16,
    width: '80%',
    marginBottom: 8,
    borderRadius: 4,
  },
  feedSkeletonActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  feedSkeletonAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  // Profile Skeleton
  profileSkeletonContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  profileSkeletonHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profileSkeletonAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
  },
  profileSkeletonName: {
    height: 20,
    width: 120,
    marginBottom: 8,
    borderRadius: 4,
  },
  profileSkeletonBio: {
    height: 14,
    width: 200,
    borderRadius: 4,
  },
  profileSkeletonStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  profileSkeletonStat: {
    alignItems: 'center',
  },
  profileSkeletonStatNumber: {
    width: 40,
    height: 16,
    marginBottom: 4,
    borderRadius: 4,
  },
  profileSkeletonStatLabel: {
    width: 60,
    height: 12,
    borderRadius: 4,
  },
  // Recipe Grid Skeleton
  recipeGridSkeletonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 16,
  },
  recipeGridSkeletonItem: {
    width: (screenWidth - 48) / 2,
    marginBottom: 16,
  },
  recipeGridSkeletonImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  recipeGridSkeletonTitle: {
    height: 14,
    width: '80%',
    borderRadius: 4,
  },
  // Search Results Skeleton
  searchSkeletonContainer: {
    padding: 16,
  },
  searchSkeletonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  searchSkeletonImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  searchSkeletonContent: {
    flex: 1,
  },
  searchSkeletonTitle: {
    height: 16,
    width: '70%',
    marginBottom: 6,
    borderRadius: 4,
  },
  searchSkeletonDescription: {
    height: 12,
    width: '90%',
    borderRadius: 4,
  },
});

/**
 * Pantry Item Skeleton Component
 * Used while loading pantry items
 */
export const PantryItemSkeleton = React.memo(() => (
  <View style={skeletonStyles.pantrySkeletonContainer}>
    <View
      style={[skeletonStyles.skeleton, skeletonStyles.pantrySkeletonIcon]}
    />
    <View style={skeletonStyles.pantrySkeletonContent}>
      <View
        style={[skeletonStyles.skeleton, skeletonStyles.pantrySkeletonTitle]}
      />
      <View
        style={[skeletonStyles.skeleton, skeletonStyles.pantrySkeletonSubtitle]}
      />
    </View>
    <View
      style={[skeletonStyles.skeleton, skeletonStyles.pantrySkeletonActions]}
    />
  </View>
));
PantryItemSkeleton.displayName = 'PantryItemSkeleton';

/**
 * Feed Item Skeleton Component
 * Used while loading feed videos
 */
export const FeedItemSkeleton = React.memo(() => (
  <View style={skeletonStyles.feedSkeletonContainer}>
    <View style={[skeletonStyles.skeleton, skeletonStyles.feedSkeletonVideo]} />
    <View style={skeletonStyles.feedSkeletonOverlay}>
      <View
        style={[skeletonStyles.skeleton, skeletonStyles.feedSkeletonProfile]}
      />
      <View
        style={[skeletonStyles.skeleton, skeletonStyles.feedSkeletonTitle]}
      />
      <View style={skeletonStyles.feedSkeletonActions}>
        <View
          style={[skeletonStyles.skeleton, skeletonStyles.feedSkeletonAction]}
        />
        <View
          style={[skeletonStyles.skeleton, skeletonStyles.feedSkeletonAction]}
        />
        <View
          style={[skeletonStyles.skeleton, skeletonStyles.feedSkeletonAction]}
        />
      </View>
    </View>
  </View>
));
FeedItemSkeleton.displayName = 'FeedItemSkeleton';

/**
 * Profile Skeleton Component
 * Used while loading user profiles
 */
export const ProfileSkeleton = React.memo(() => (
  <View style={skeletonStyles.profileSkeletonContainer}>
    <View style={skeletonStyles.profileSkeletonHeader}>
      <View
        style={[skeletonStyles.skeleton, skeletonStyles.profileSkeletonAvatar]}
      />
      <View
        style={[skeletonStyles.skeleton, skeletonStyles.profileSkeletonName]}
      />
      <View
        style={[skeletonStyles.skeleton, skeletonStyles.profileSkeletonBio]}
      />
    </View>

    <View style={skeletonStyles.profileSkeletonStats}>
      {[1, 2, 3].map(index => (
        <View key={index} style={skeletonStyles.profileSkeletonStat}>
          <View
            style={[
              skeletonStyles.skeleton,
              skeletonStyles.profileSkeletonStatNumber,
            ]}
          />
          <View
            style={[
              skeletonStyles.skeleton,
              skeletonStyles.profileSkeletonStatLabel,
            ]}
          />
        </View>
      ))}
    </View>
  </View>
));
ProfileSkeleton.displayName = 'ProfileSkeleton';

/**
 * Recipe Grid Skeleton Component
 * Used while loading recipe grids
 */
export const RecipeGridSkeleton = React.memo(
  ({ itemCount = 6 }: { itemCount?: number }) => (
    <View style={skeletonStyles.recipeGridSkeletonContainer}>
      {Array(itemCount)
        .fill(null)
        .map((_, index) => (
          <View key={index} style={skeletonStyles.recipeGridSkeletonItem}>
            <View
              style={[
                skeletonStyles.skeleton,
                skeletonStyles.recipeGridSkeletonImage,
              ]}
            />
            <View
              style={[
                skeletonStyles.skeleton,
                skeletonStyles.recipeGridSkeletonTitle,
              ]}
            />
          </View>
        ))}
    </View>
  ),
);
RecipeGridSkeleton.displayName = 'RecipeGridSkeleton';

/**
 * Search Results Skeleton Component
 * Used while loading search results
 */
export const SearchResultsSkeleton = React.memo(
  ({ itemCount = 5 }: { itemCount?: number }) => (
    <View style={skeletonStyles.searchSkeletonContainer}>
      {Array(itemCount)
        .fill(null)
        .map((_, index) => (
          <View key={index} style={skeletonStyles.searchSkeletonItem}>
            <View
              style={[
                skeletonStyles.skeleton,
                skeletonStyles.searchSkeletonImage,
              ]}
            />
            <View style={skeletonStyles.searchSkeletonContent}>
              <View
                style={[
                  skeletonStyles.skeleton,
                  skeletonStyles.searchSkeletonTitle,
                ]}
              />
              <View
                style={[
                  skeletonStyles.skeleton,
                  skeletonStyles.searchSkeletonDescription,
                ]}
              />
            </View>
          </View>
        ))}
    </View>
  ),
);
SearchResultsSkeleton.displayName = 'SearchResultsSkeleton';

/**
 * Generic List Skeleton Component
 * Reusable skeleton for various list types
 */
export const ListSkeleton = React.memo(
  ({
    itemCount = 5,
    itemHeight = 80,
    showImage = true,
    showSubtitle = true,
  }: {
    itemCount?: number;
    itemHeight?: number;
    showImage?: boolean;
    showSubtitle?: boolean;
  }) => (
    <View>
      {Array(itemCount)
        .fill(null)
        .map((_, index) => (
          <View
            key={index}
            style={[
              skeletonStyles.pantrySkeletonContainer,
              { height: itemHeight },
            ]}>
            {showImage && (
              <View
                style={[
                  skeletonStyles.skeleton,
                  skeletonStyles.pantrySkeletonIcon,
                ]}
              />
            )}
            <View style={skeletonStyles.pantrySkeletonContent}>
              <View
                style={[
                  skeletonStyles.skeleton,
                  skeletonStyles.pantrySkeletonTitle,
                ]}
              />
              {showSubtitle && (
                <View
                  style={[
                    skeletonStyles.skeleton,
                    skeletonStyles.pantrySkeletonSubtitle,
                  ]}
                />
              )}
            </View>
          </View>
        ))}
    </View>
  ),
);
ListSkeleton.displayName = 'ListSkeleton';

/**
 * Tabs Skeleton Component
 * Used while loading tab content
 */
export const TabsSkeleton = React.memo(() => (
  <View style={{ padding: 16 }}>
    <View style={{ flexDirection: 'row', marginBottom: 16 }}>
      {[1, 2, 3].map(index => (
        <View
          key={index}
          style={[
            skeletonStyles.skeleton,
            {
              width: 80,
              height: 32,
              marginRight: 12,
              borderRadius: 16,
            },
          ]}
        />
      ))}
    </View>
    <RecipeGridSkeleton itemCount={4} />
  </View>
));
TabsSkeleton.displayName = 'TabsSkeleton';

// Export all skeleton components
export { skeletonStyles };
