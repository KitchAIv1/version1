import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface LoadingEnhancementProps {
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  skeletonCount?: number;
  showProgress?: boolean;
}

/**
 * Loading enhancement wrapper - improves perceived performance
 * NON-INTRUSIVE: Wraps existing loading states without changing logic
 */
export const LoadingEnhancement: React.FC<LoadingEnhancementProps> = ({
  isLoading,
  children,
  loadingText = 'Loading...',
  skeletonCount = 3,
  showProgress = false,
}) => {
  if (!isLoading) {
    return <>{children}</>;
  }

  return (
    <View style={styles.loadingContainer}>
      {/* Enhanced loading indicator */}
      <View style={styles.loadingContent}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={styles.loadingText}>{loadingText}</Text>
        
        {showProgress && (
          <Text style={styles.progressText}>
            Optimizing your experience...
          </Text>
        )}
      </View>
      
      {/* Simple skeleton items for better perceived performance */}
      <View style={styles.skeletonContainer}>
        {Array.from({ length: skeletonCount }, (_, index) => (
          <SkeletonItem key={index} delay={index * 100} />
        ))}
      </View>
    </View>
  );
};

/**
 * Simple skeleton item component
 */
const SkeletonItem: React.FC<{ delay: number }> = ({ delay }) => {
  return (
    <View style={[styles.skeletonItem, { opacity: 0.6 - (delay / 1000) }]}>
      <View style={styles.skeletonIcon} />
      <View style={styles.skeletonContent}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
      </View>
    </View>
  );
};

/**
 * Quick loading wrapper for search states
 */
export const SearchLoadingWrapper: React.FC<{
  isSearching: boolean;
  children: React.ReactNode;
}> = ({ isSearching, children }) => {
  return (
    <View style={styles.searchWrapper}>
      {children}
      {isSearching && (
        <View style={styles.searchIndicator}>
          <ActivityIndicator size="small" color="#10b981" />
          <Text style={styles.searchText}>Searching...</Text>
        </View>
      )}
    </View>
  );
};

/**
 * Performance feedback component
 */
export const PerformanceFeedback: React.FC<{
  loadTime?: number;
  showFeedback: boolean;
}> = ({ loadTime, showFeedback }) => {
  if (!showFeedback || !loadTime) return null;
  
  const getRating = (time: number) => {
    if (time <= 500) return { emoji: '🟢', text: 'Excellent' };
    if (time <= 800) return { emoji: '🟡', text: 'Good' };
    if (time <= 1200) return { emoji: '🟠', text: 'Acceptable' };
    return { emoji: '🔴', text: 'Optimizing...' };
  };
  
  const rating = getRating(loadTime);
  
  return (
    <View style={styles.performanceFeedback}>
      <Text style={styles.performanceText}>
        {rating.emoji} {rating.text} ({loadTime}ms)
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    padding: 20,
  },
  loadingContent: {
    alignItems: 'center',
    marginVertical: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 16,
    fontWeight: '500',
  },
  progressText: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
    fontStyle: 'italic',
  },
  skeletonContainer: {
    flex: 1,
  },
  skeletonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginVertical: 4,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  skeletonIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#e2e8f0',
    borderRadius: 20,
    marginRight: 16,
  },
  skeletonContent: {
    flex: 1,
  },
  skeletonLine: {
    height: 16,
    backgroundColor: '#e2e8f0',
    borderRadius: 8,
    marginBottom: 8,
  },
  skeletonLineShort: {
    width: '60%',
    height: 12,
  },
  searchWrapper: {
    position: 'relative',
  },
  searchIndicator: {
    position: 'absolute',
    top: 8,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  searchText: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 4,
    fontWeight: '500',
  },
  performanceFeedback: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 100,
  },
  performanceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default LoadingEnhancement; 