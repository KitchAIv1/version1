import React from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

// Move styles to top to fix "styles used before defined" errors
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#10b981',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginLeft: 16,
  },
  statContainer: {
    alignItems: 'center',
    gap: 4,
  },
  bioContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  bioTextContainer: {
    gap: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  cardWrapper: {
    width: '48%',
    margin: '1%',
    marginBottom: 12,
  },
  cardContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardInfo: {
    padding: 12,
    gap: 6,
  },
});

// Animated skeleton placeholder
const SkeletonPlaceholder: React.FC<{
  width: number | string;
  height: number;
  borderRadius?: number;
}> = ({ width, height, borderRadius = 4 }) => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['#e1e5e9', '#f2f4f6'],
  });

  return (
    <Animated.View
      style={{
        width: width as any,
        height,
        borderRadius,
        backgroundColor,
      }}
    />
  );
};

// Avatar Row Skeleton
export const AvatarRowSkeleton: React.FC = () => (
  <View style={styles.avatarRow}>
    <SkeletonPlaceholder width={80} height={80} borderRadius={40} />
    <View style={styles.statsRow}>
      <View style={styles.statContainer}>
        <SkeletonPlaceholder width={30} height={20} borderRadius={4} />
        <SkeletonPlaceholder width={40} height={14} borderRadius={4} />
      </View>
      <View style={styles.statContainer}>
        <SkeletonPlaceholder width={30} height={20} borderRadius={4} />
        <SkeletonPlaceholder width={50} height={14} borderRadius={4} />
      </View>
      <View style={styles.statContainer}>
        <SkeletonPlaceholder width={30} height={20} borderRadius={4} />
        <SkeletonPlaceholder width={50} height={14} borderRadius={4} />
      </View>
    </View>
  </View>
);

// Bio Skeleton
export const BioSkeleton: React.FC = () => (
  <View style={styles.bioContainer}>
    <SkeletonPlaceholder width={120} height={18} borderRadius={4} />
    <View style={styles.bioTextContainer}>
      <SkeletonPlaceholder width="100%" height={14} borderRadius={4} />
      <SkeletonPlaceholder width="80%" height={14} borderRadius={4} />
    </View>
  </View>
);

// Recipe Card Skeleton
export const RecipeCardSkeleton: React.FC = () => (
  <View style={styles.cardWrapper}>
    <View style={styles.cardContainer}>
      <SkeletonPlaceholder width="100%" height={120} borderRadius={12} />
      <View style={styles.cardInfo}>
        <SkeletonPlaceholder width="90%" height={16} borderRadius={4} />
        <SkeletonPlaceholder width="60%" height={12} borderRadius={4} />
      </View>
    </View>
  </View>
);

// Recipe Grid Skeleton
export const RecipeGridSkeleton: React.FC = () => (
  <View style={styles.gridContainer}>
    {Array.from({ length: 6 }).map((_, index) => (
      <RecipeCardSkeleton key={index} />
    ))}
  </View>
);

// Full Profile Skeleton
export const ProfileScreenSkeleton: React.FC = () => (
  <View style={styles.container}>
    {/* Header Skeleton */}
    <View style={styles.header}>
      <SkeletonPlaceholder width={100} height={24} borderRadius={4} />
    </View>

    {/* Avatar Row Skeleton */}
    <AvatarRowSkeleton />

    {/* Bio Skeleton */}
    <BioSkeleton />

    {/* Buttons Skeleton */}
    <View style={styles.buttonRow}>
      <SkeletonPlaceholder width="45%" height={40} borderRadius={8} />
      <SkeletonPlaceholder width="45%" height={40} borderRadius={8} />
    </View>

    {/* Tab Bar Skeleton */}
    <View style={styles.tabBar}>
      <SkeletonPlaceholder width={80} height={40} borderRadius={4} />
      <SkeletonPlaceholder width={80} height={40} borderRadius={4} />
      <SkeletonPlaceholder width={80} height={40} borderRadius={4} />
      <SkeletonPlaceholder width={80} height={40} borderRadius={4} />
    </View>

    {/* Recipe Grid Skeleton */}
    <RecipeGridSkeleton />
  </View>
);
