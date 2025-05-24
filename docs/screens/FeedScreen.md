# FeedScreen Component Documentation

## Overview

The `FeedScreen` is the primary discovery interface in KitchAI v2, serving as the main hub for users to explore community recipes, interact with content, and discover new cooking ideas. It implements an infinite-scrolling feed with intelligent pantry matching and social features.

## Location
`src/screens/main/FeedScreen.tsx`

## Purpose

- **Recipe Discovery**: Present a curated feed of community recipes
- **Social Interaction**: Enable likes, saves, comments, and sharing
- **Pantry Integration**: Highlight recipes that match user's pantry items
- **Content Filtering**: Provide search and filtering capabilities
- **Performance**: Smooth scrolling with optimized rendering

## Architecture

### Screen Structure

```typescript
interface FeedScreenProps {
  navigation: NavigationProp<MainStackParamList>;
  route: RouteProp<MainTabsParamList, 'Feed'>;
}

interface FeedItem {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  video_url?: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  likes: number;
  comments_count: number;
  created_at: string;
  pantry_match?: PantryMatchData;
  is_liked: boolean;
  is_saved: boolean;
}
```

### Visual Layout

```
┌─────────────────────────────────────┐
│ [Search] [Filter] [Profile]         │ ← Header
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │        Recipe Card 1            │ │ ← Feed Items
│ │  [User Info] [Recipe Image]     │ │
│ │  [Title] [Description]          │ │
│ │  [Pantry Match] [Actions]       │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │        Recipe Card 2            │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │        Recipe Card 3            │ │
│ └─────────────────────────────────┘ │
│              [Loading...]           │ ← Infinite Scroll
└─────────────────────────────────────┘
```

## Key Features

### 1. Infinite Scroll Feed

**Pagination System**:
- Loads 10 recipes per page initially
- Automatic loading on scroll
- Smooth loading indicators
- Error handling for failed loads

**Performance Optimization**:
- Virtual scrolling for large datasets
- Image lazy loading
- Optimized re-rendering
- Memory management

### 2. Pantry-Based Recommendations

**Smart Matching**:
- Prioritizes recipes with high pantry match
- Shows ingredient availability status
- Highlights "can make" recipes
- Suggests missing ingredients

**Real-time Updates**:
- Updates when pantry changes
- Refreshes match percentages
- Maintains scroll position

### 3. Social Features

**Interaction System**:
- Like/unlike recipes
- Save/unsave to collections
- Comment on recipes
- Share functionality

**Real-time Updates**:
- Live like count updates
- Comment notifications
- Social activity tracking

### 4. Search and Filtering

**Search Capabilities**:
- Recipe title search
- Ingredient-based search
- User search
- Tag-based filtering

**Filter Options**:
- Diet preferences
- Cooking time
- Difficulty level
- Pantry match percentage

## Implementation Details

### Main Component Structure

```typescript
export const FeedScreen: React.FC<FeedScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Feed data management
  const {
    data: feedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useFeed(user?.id);

  // Flatten paginated data
  const recipes = useMemo(() => 
    feedData?.pages.flatMap(page => page.data) ?? [],
    [feedData]
  );

  return (
    <SafeAreaView style={styles.container}>
      <FeedHeader 
        onSearch={handleSearch}
        onFilter={handleFilter}
        searchQuery={searchQuery}
      />
      <FlatList
        data={recipes}
        renderItem={renderRecipeCard}
        keyExtractor={keyExtractor}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={10}
      />
    </SafeAreaView>
  );
};
```

### Feed Data Management

```typescript
const useFeed = (userId?: string) => {
  return useInfiniteQuery({
    queryKey: ['recipes', 'feed', userId],
    queryFn: ({ pageParam = 0 }) => fetchFeedPage(userId, pageParam),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.data.length < 10) return undefined;
      return pages.length;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  });
};

const fetchFeedPage = async (userId: string, page: number) => {
  const { data, error } = await supabase
    .rpc('get_community_feed_pantry_match_v4', {
      user_id: userId,
      limit_count: 10,
      offset_count: page * 10,
    });

  if (error) throw error;
  return { data, page };
};
```

### Recipe Card Rendering

```typescript
const renderRecipeCard = useCallback(({ item, index }: ListRenderItemInfo<FeedItem>) => (
  <RecipeCard
    recipe={item}
    onPress={() => handleRecipePress(item)}
    showPantryMatch={true}
    style={[
      styles.recipeCard,
      index === 0 && styles.firstCard,
    ]}
  />
), [handleRecipePress]);

const handleRecipePress = useCallback((recipe: FeedItem) => {
  navigation.navigate('RecipeDetail', {
    id: recipe.id,
    recipe: recipe,
  });
}, [navigation]);

const keyExtractor = useCallback((item: FeedItem) => item.id, []);
```

### Search and Filter Implementation

```typescript
const handleSearch = useCallback((query: string) => {
  setSearchQuery(query);
  if (query.trim()) {
    navigation.navigate('SearchResults', { query: query.trim() });
  }
}, [navigation]);

const handleFilter = useCallback(() => {
  // Open filter modal
  navigation.navigate('FilterModal');
}, [navigation]);
```

### Pull-to-Refresh

```typescript
const onRefresh = useCallback(async () => {
  setRefreshing(true);
  try {
    await refetch();
  } catch (error) {
    console.error('Error refreshing feed:', error);
  } finally {
    setRefreshing(false);
  }
}, [refetch]);
```

### Infinite Scroll Loading

```typescript
const loadMore = useCallback(() => {
  if (hasNextPage && !isFetchingNextPage) {
    fetchNextPage();
  }
}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

const renderFooter = useCallback(() => {
  if (!isFetchingNextPage) return null;
  
  return (
    <View style={styles.loadingFooter}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.loadingText}>Loading more recipes...</Text>
    </View>
  );
}, [isFetchingNextPage]);
```

## Header Component

### FeedHeader Implementation

```typescript
const FeedHeader: React.FC<FeedHeaderProps> = ({
  onSearch,
  onFilter,
  searchQuery,
}) => {
  const { user } = useAuth();
  const navigation = useNavigation();

  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.title}>Discover</Text>
        <Pressable
          style={styles.profileButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <Image
            source={{ uri: user?.avatar_url || defaultAvatar }}
            style={styles.profileAvatar}
          />
        </Pressable>
      </View>
      
      <View style={styles.searchContainer}>
        <SearchBar
          placeholder="Search recipes, ingredients..."
          value={searchQuery}
          onChangeText={onSearch}
          onSubmitEditing={() => onSearch(searchQuery)}
          style={styles.searchBar}
        />
        <FilterButton onPress={onFilter} />
      </View>
    </View>
  );
};
```

### Search Bar Component

```typescript
const SearchBar: React.FC<SearchBarProps> = ({
  placeholder,
  value,
  onChangeText,
  onSubmitEditing,
  style,
}) => (
  <View style={[styles.searchBarContainer, style]}>
    <Icon name="search" size={20} color={colors.gray.medium} />
    <TextInput
      style={styles.searchInput}
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmitEditing}
      returnKeyType="search"
      placeholderTextColor={colors.gray.medium}
    />
    {value.length > 0 && (
      <Pressable onPress={() => onChangeText('')}>
        <Icon name="close-circle" size={20} color={colors.gray.medium} />
      </Pressable>
    )}
  </View>
);
```

## Error Handling

### Error States

```typescript
const renderErrorState = useCallback(() => (
  <View style={styles.errorContainer}>
    <Icon name="alert-circle" size={48} color={colors.error} />
    <Text style={styles.errorTitle}>Something went wrong</Text>
    <Text style={styles.errorMessage}>
      We couldn't load the recipes. Please try again.
    </Text>
    <Pressable style={styles.retryButton} onPress={() => refetch()}>
      <Text style={styles.retryText}>Try Again</Text>
    </Pressable>
  </View>
), [refetch]);

const renderEmptyState = useCallback(() => (
  <View style={styles.emptyContainer}>
    <Icon name="restaurant" size={64} color={colors.gray.light} />
    <Text style={styles.emptyTitle}>No recipes yet</Text>
    <Text style={styles.emptyMessage}>
      Be the first to share a recipe with the community!
    </Text>
    <Pressable
      style={styles.createButton}
      onPress={() => navigation.navigate('VideoRecipeUploader')}
    >
      <Text style={styles.createText}>Create Recipe</Text>
    </Pressable>
  </View>
), [navigation]);
```

### Network Error Handling

```typescript
const handleNetworkError = useCallback((error: Error) => {
  if (error.message.includes('network')) {
    showToast('Please check your internet connection');
  } else {
    showToast('Failed to load recipes. Please try again.');
  }
}, []);
```

## Performance Optimizations

### FlatList Optimization

```typescript
const getItemLayout = useCallback((data: FeedItem[] | null, index: number) => ({
  length: RECIPE_CARD_HEIGHT,
  offset: RECIPE_CARD_HEIGHT * index,
  index,
}), []);

const renderItem = useCallback(({ item, index }: ListRenderItemInfo<FeedItem>) => (
  <RecipeCard
    recipe={item}
    onPress={() => handleRecipePress(item)}
    showPantryMatch={true}
  />
), [handleRecipePress]);
```

### Memory Management

```typescript
const FeedScreen = () => {
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear any pending timeouts
      // Cancel ongoing requests
    };
  }, []);

  // Optimize re-renders
  const memoizedRecipes = useMemo(() => 
    feedData?.pages.flatMap(page => page.data) ?? [],
    [feedData]
  );

  return (
    <FlatList
      data={memoizedRecipes}
      removeClippedSubviews={true}
      maxToRenderPerBatch={5}
      windowSize={10}
      initialNumToRender={3}
      updateCellsBatchingPeriod={50}
    />
  );
};
```

## Styling

### Style Structure

```typescript
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray.light,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  profileAvatar: {
    width: '100%',
    height: '100%',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray.light,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text.primary,
  },
  recipeCard: {
    marginBottom: 16,
  },
  firstCard: {
    marginTop: 16,
  },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
```

## Integration Points

### Navigation Integration

```typescript
// From MainTabs
<Tab.Screen
  name="Feed"
  component={FeedScreen}
  options={{
    tabBarIcon: ({ color, size }) => (
      <Icon name="home" size={size} color={color} />
    ),
    headerShown: false,
  }}
/>

// Navigation to other screens
navigation.navigate('RecipeDetail', { id: recipe.id });
navigation.navigate('SearchResults', { query });
navigation.navigate('Profile');
```

### Hook Integration

```typescript
// Authentication
const { user, isOnboarded } = useAuth();

// Feed data
const { data: feedData, fetchNextPage, hasNextPage } = useFeed(user?.id);

// Social interactions
const { mutate: toggleLike } = useToggleLike();
const { mutate: toggleSave } = useToggleSave();
```

## Testing

### Unit Tests

```typescript
describe('FeedScreen', () => {
  it('renders feed correctly', () => {
    render(<FeedScreen />);
    expect(screen.getByText('Discover')).toBeInTheDocument();
  });

  it('handles search input', () => {
    render(<FeedScreen />);
    const searchInput = screen.getByPlaceholderText('Search recipes, ingredients...');
    
    fireEvent.changeText(searchInput, 'pasta');
    expect(searchInput.props.value).toBe('pasta');
  });

  it('loads more recipes on scroll', async () => {
    const mockFetchNextPage = jest.fn();
    render(<FeedScreen />);
    
    const flatList = screen.getByTestId('feed-list');
    fireEvent.scroll(flatList, {
      nativeEvent: {
        contentOffset: { y: 1000 },
        contentSize: { height: 2000 },
        layoutMeasurement: { height: 800 },
      },
    });

    await waitFor(() => {
      expect(mockFetchNextPage).toHaveBeenCalled();
    });
  });
});
```

### Integration Tests

```typescript
describe('FeedScreen Integration', () => {
  it('navigates to recipe detail on card press', () => {
    const mockNavigation = { navigate: jest.fn() };
    render(<FeedScreen navigation={mockNavigation} />);
    
    const recipeCard = screen.getByTestId('recipe-card-1');
    fireEvent.press(recipeCard);
    
    expect(mockNavigation.navigate).toHaveBeenCalledWith('RecipeDetail', {
      id: '1',
      recipe: expect.any(Object),
    });
  });
});
```

## Accessibility

### Screen Reader Support

```typescript
<FlatList
  data={recipes}
  accessible={true}
  accessibilityLabel="Recipe feed"
  accessibilityHint="Scroll to browse recipes"
  renderItem={renderRecipeCard}
/>

<Pressable
  accessible={true}
  accessibilityRole="button"
  accessibilityLabel="Search recipes"
  accessibilityHint="Tap to search for recipes"
>
  <SearchBar />
</Pressable>
```

## Future Enhancements

### Planned Features

1. **Advanced Filtering**: Multiple filter criteria
2. **Personalized Feed**: AI-powered recommendations
3. **Video Previews**: Auto-playing video thumbnails
4. **Offline Support**: Cached feed content

### Performance Improvements

1. **Virtual Scrolling**: For very large feeds
2. **Progressive Loading**: Lazy load images and videos
3. **Background Sync**: Preload next page

## Dependencies

### Required Packages

```json
{
  "react": "^18.x.x",
  "react-native": "^0.x.x",
  "@react-navigation/native": "^6.x.x",
  "@tanstack/react-query": "^5.x.x",
  "react-native-vector-icons": "^10.x.x"
}
```

### Internal Dependencies

- `src/components/RecipeCard.tsx`: Recipe display component
- `src/hooks/useFeed.ts`: Feed data management
- `src/hooks/useAuth.ts`: Authentication context
- `src/providers/AuthProvider.tsx`: User authentication

## Troubleshooting

### Common Issues

1. **Feed Not Loading**: Check authentication and network
2. **Infinite Scroll Not Working**: Verify `onEndReached` threshold
3. **Performance Issues**: Check FlatList optimization settings

### Debug Tips

```typescript
// Enable debug logging
const DEBUG_FEED = __DEV__;

if (DEBUG_FEED) {
  console.log('Feed State:', {
    recipesCount: recipes.length,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  });
}
```

## Conclusion

The `FeedScreen` serves as the heart of the KitchAI v2 discovery experience, providing users with an engaging, performant interface for exploring community recipes while integrating seamlessly with pantry management and social features.

---

**Last Updated**: January 2025  
**Component Version**: 2.0.0  
**Maintainer**: KitchAI Development Team 