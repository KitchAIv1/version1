# RecipeCard Component Documentation

## Overview

The `RecipeCard` is a core UI component that displays recipe information in a card format throughout the KitchAI v2 application. It serves as the primary interface for recipe discovery, social interactions, and pantry integration within the community feed and search results.

## Location
`src/components/RecipeCard.tsx`

## Purpose

- **Recipe Display**: Present recipe information in an attractive, consistent format
- **Social Interactions**: Enable likes, saves, and comments functionality
- **Pantry Integration**: Show ingredient availability based on user's pantry
- **Navigation**: Provide seamless navigation to detailed recipe views
- **Performance**: Optimized rendering for feed scrolling

## Architecture

### Component Structure

```typescript
interface RecipeCardProps {
  recipe: Recipe;
  onPress?: () => void;
  showPantryMatch?: boolean;
  style?: ViewStyle;
}

interface Recipe {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  video_url?: string;
  user_id: string;
  username?: string;
  avatar_url?: string;
  likes: number;
  comments_count: number;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  servings?: number;
  diet_tags?: string[];
  ingredients?: Ingredient[];
  is_liked?: boolean;
  is_saved?: boolean;
  pantry_match?: PantryMatch;
}
```

### Visual Layout

```
┌─────────────────────────────────────┐
│ User Avatar | Username | Time        │
├─────────────────────────────────────┤
│                                     │
│         Recipe Thumbnail            │
│         (Video Preview)             │
│                                     │
├─────────────────────────────────────┤
│ Recipe Title                        │
│ Description (truncated)             │
├─────────────────────────────────────┤
│ Pantry Match Indicator              │
│ Available: 5/8 ingredients          │
├─────────────────────────────────────┤
│ ❤️ 24  💬 5  ⏱️ 30min  🍽️ 4 servings │
├─────────────────────────────────────┤
│ [Like] [Save] [Comment] [Share]     │
└─────────────────────────────────────┘
```

## Key Features

### 1. Recipe Information Display

**Header Section**:
- User avatar and username
- Recipe creation timestamp
- Creator role indicator

**Content Section**:
- High-quality thumbnail image
- Video preview indicator
- Recipe title and description
- Diet tags and categories

**Metadata Section**:
- Preparation and cooking time
- Serving size information
- Difficulty level (if available)

### 2. Social Interaction Features

**Like System**:
- Heart icon with like count
- Optimistic UI updates
- Real-time like synchronization

**Save Functionality**:
- Bookmark icon for saving recipes
- Personal recipe collection integration
- Quick save/unsave toggle

**Comment Integration**:
- Comment count display
- Direct navigation to comments
- Real-time comment updates

### 3. Pantry Integration

**Ingredient Matching**:
- Shows available vs. required ingredients
- Visual indicators for ingredient availability
- Color-coded availability status

**Smart Recommendations**:
- Highlights recipes that can be made with current pantry
- Shows missing ingredient count
- Suggests similar recipes with better matches

### 4. Performance Optimizations

**Image Loading**:
- Progressive image loading
- Placeholder images during load
- Cached image management

**Lazy Rendering**:
- Optimized for FlatList performance
- Minimal re-renders
- Efficient memory usage

## Implementation Details

### Component Structure

```typescript
export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  onPress,
  showPantryMatch = true,
  style,
}) => {
  const { user } = useAuth();
  const navigation = useNavigation();
  
  // Social interaction hooks
  const { mutate: toggleLike, isLoading: likingLoading } = useToggleLike();
  const { mutate: toggleSave, isLoading: savingLoading } = useToggleSave();
  
  // Pantry matching
  const { data: pantryMatch } = usePantryMatch(recipe.id, {
    enabled: showPantryMatch && !!user?.id,
  });

  return (
    <Pressable style={[styles.card, style]} onPress={onPress}>
      <RecipeHeader recipe={recipe} />
      <RecipeImage recipe={recipe} />
      <RecipeContent recipe={recipe} />
      {showPantryMatch && <PantryMatchIndicator match={pantryMatch} />}
      <RecipeMetadata recipe={recipe} />
      <RecipeActions 
        recipe={recipe}
        onLike={handleLike}
        onSave={handleSave}
        onComment={handleComment}
        onShare={handleShare}
      />
    </Pressable>
  );
};
```

### Sub-Components

#### RecipeHeader

```typescript
const RecipeHeader: React.FC<{ recipe: Recipe }> = ({ recipe }) => (
  <View style={styles.header}>
    <Image 
      source={{ uri: recipe.avatar_url || defaultAvatar }} 
      style={styles.avatar}
    />
    <View style={styles.userInfo}>
      <Text style={styles.username}>{recipe.username}</Text>
      <Text style={styles.timestamp}>
        {formatTimeAgo(recipe.created_at)}
      </Text>
    </View>
    {recipe.user_role === 'creator' && (
      <CreatorBadge />
    )}
  </View>
);
```

#### RecipeImage

```typescript
const RecipeImage: React.FC<{ recipe: Recipe }> = ({ recipe }) => {
  const [imageLoading, setImageLoading] = useState(true);
  
  return (
    <View style={styles.imageContainer}>
      {imageLoading && <ImagePlaceholder />}
      <Image
        source={{ uri: recipe.thumbnail_url }}
        style={styles.thumbnail}
        onLoadStart={() => setImageLoading(true)}
        onLoadEnd={() => setImageLoading(false)}
        resizeMode="cover"
      />
      {recipe.video_url && <VideoIndicator />}
    </View>
  );
};
```

#### PantryMatchIndicator

```typescript
const PantryMatchIndicator: React.FC<{ match?: PantryMatch }> = ({ match }) => {
  if (!match) return null;
  
  const { available, total, percentage } = match;
  const canMake = percentage >= 80; // 80% threshold
  
  return (
    <View style={[styles.pantryMatch, canMake && styles.canMake]}>
      <Icon 
        name={canMake ? "checkmark-circle" : "alert-circle"} 
        color={canMake ? colors.success : colors.warning}
      />
      <Text style={styles.pantryText}>
        {available}/{total} ingredients available
      </Text>
      {canMake && <Text style={styles.canMakeText}>You can make this!</Text>}
    </View>
  );
};
```

#### RecipeActions

```typescript
const RecipeActions: React.FC<RecipeActionsProps> = ({
  recipe,
  onLike,
  onSave,
  onComment,
  onShare,
}) => (
  <View style={styles.actions}>
    <ActionButton
      icon={recipe.is_liked ? "heart" : "heart-outline"}
      count={recipe.likes}
      onPress={onLike}
      color={recipe.is_liked ? colors.primary : colors.gray}
    />
    <ActionButton
      icon={recipe.is_saved ? "bookmark" : "bookmark-outline"}
      onPress={onSave}
      color={recipe.is_saved ? colors.secondary : colors.gray}
    />
    <ActionButton
      icon="chatbubble-outline"
      count={recipe.comments_count}
      onPress={onComment}
    />
    <ActionButton
      icon="share-outline"
      onPress={onShare}
    />
  </View>
);
```

### Social Interaction Handlers

```typescript
const handleLike = useCallback(async () => {
  if (!user?.id) {
    navigation.navigate('AuthStack');
    return;
  }
  
  try {
    await toggleLike({
      userId: user.id,
      recipeId: recipe.id,
      currentlyLiked: recipe.is_liked,
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    // Show error toast
  }
}, [user?.id, recipe.id, recipe.is_liked, toggleLike]);

const handleSave = useCallback(async () => {
  if (!user?.id) {
    navigation.navigate('AuthStack');
    return;
  }
  
  try {
    await toggleSave({
      userId: user.id,
      recipeId: recipe.id,
      currentlySaved: recipe.is_saved,
    });
  } catch (error) {
    console.error('Error toggling save:', error);
    // Show error toast
  }
}, [user?.id, recipe.id, recipe.is_saved, toggleSave]);
```

## Usage Examples

### Basic Recipe Card

```typescript
import { RecipeCard } from '../components/RecipeCard';

const FeedScreen = () => {
  const { data: recipes } = useFeed();
  
  return (
    <FlatList
      data={recipes}
      renderItem={({ item }) => (
        <RecipeCard
          recipe={item}
          onPress={() => navigation.navigate('RecipeDetail', { id: item.id })}
          showPantryMatch={true}
        />
      )}
      keyExtractor={(item) => item.id}
    />
  );
};
```

### Search Results

```typescript
const SearchResults = () => {
  const { data: searchResults } = useSearchRecipes(query);
  
  return (
    <FlatList
      data={searchResults}
      renderItem={({ item }) => (
        <RecipeCard
          recipe={item}
          onPress={() => handleRecipePress(item)}
          showPantryMatch={false} // Disable for search
          style={styles.searchCard}
        />
      )}
    />
  );
};
```

### Profile Recipe Grid

```typescript
const ProfileRecipes = () => {
  const { data: userRecipes } = useUserRecipes(userId);
  
  return (
    <FlatList
      data={userRecipes}
      numColumns={2}
      renderItem={({ item }) => (
        <RecipeCard
          recipe={item}
          onPress={() => handleRecipePress(item)}
          style={styles.gridCard}
        />
      )}
    />
  );
};
```

## Styling and Theming

### Style Structure

```typescript
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  timestamp: {
    fontSize: 12,
    color: colors.text.secondary,
    marginTop: 2,
  },
  imageContainer: {
    position: 'relative',
    aspectRatio: 16 / 9,
    backgroundColor: colors.gray.light,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  pantryMatch: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.warning.light,
  },
  canMake: {
    backgroundColor: colors.success.light,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.gray.light,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray.light,
  },
});
```

### Theme Integration

```typescript
const useThemedStyles = () => {
  const { theme } = useTheme();
  
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      shadowColor: theme.colors.shadow,
    },
    title: {
      color: theme.colors.text.primary,
    },
    description: {
      color: theme.colors.text.secondary,
    },
  });
};
```

## Performance Optimizations

### Memoization

```typescript
export const RecipeCard = React.memo<RecipeCardProps>(({
  recipe,
  onPress,
  showPantryMatch,
  style,
}) => {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison for optimal re-rendering
  return (
    prevProps.recipe.id === nextProps.recipe.id &&
    prevProps.recipe.likes === nextProps.recipe.likes &&
    prevProps.recipe.is_liked === nextProps.recipe.is_liked &&
    prevProps.recipe.is_saved === nextProps.recipe.is_saved &&
    prevProps.showPantryMatch === nextProps.showPantryMatch
  );
});
```

### Image Optimization

```typescript
const OptimizedImage: React.FC<{ uri: string }> = ({ uri }) => {
  const [imageError, setImageError] = useState(false);
  
  return (
    <FastImage
      source={{
        uri: imageError ? defaultThumbnail : uri,
        priority: FastImage.priority.normal,
        cache: FastImage.cacheControl.immutable,
      }}
      style={styles.thumbnail}
      onError={() => setImageError(true)}
      resizeMode={FastImage.resizeMode.cover}
    />
  );
};
```

### List Optimization

```typescript
const getItemLayout = (data: Recipe[] | null, index: number) => ({
  length: RECIPE_CARD_HEIGHT,
  offset: RECIPE_CARD_HEIGHT * index,
  index,
});

const keyExtractor = (item: Recipe) => item.id;

const renderItem = useCallback(({ item }: { item: Recipe }) => (
  <RecipeCard
    recipe={item}
    onPress={() => handleRecipePress(item)}
  />
), [handleRecipePress]);
```

## Accessibility

### Screen Reader Support

```typescript
const RecipeCard: React.FC<RecipeCardProps> = ({ recipe }) => (
  <Pressable
    style={styles.card}
    accessible={true}
    accessibilityRole="button"
    accessibilityLabel={`Recipe: ${recipe.title} by ${recipe.username}`}
    accessibilityHint="Double tap to view recipe details"
  >
    {/* Card content */}
  </Pressable>
);
```

### Action Accessibility

```typescript
const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  count,
  onPress,
  accessibilityLabel,
}) => (
  <Pressable
    onPress={onPress}
    accessible={true}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel}
    style={styles.actionButton}
  >
    <Icon name={icon} size={24} />
    {count !== undefined && (
      <Text style={styles.actionCount}>{count}</Text>
    )}
  </Pressable>
);
```

## Error Handling

### Image Loading Errors

```typescript
const handleImageError = useCallback(() => {
  setImageError(true);
  // Log error for analytics
  analytics.track('recipe_image_load_error', {
    recipe_id: recipe.id,
    image_url: recipe.thumbnail_url,
  });
}, [recipe.id, recipe.thumbnail_url]);
```

### Social Action Errors

```typescript
const handleLikeError = useCallback((error: Error) => {
  // Revert optimistic update
  queryClient.setQueryData(['recipe', recipe.id], (old: Recipe) => ({
    ...old,
    is_liked: !old.is_liked,
    likes: old.is_liked ? old.likes + 1 : old.likes - 1,
  }));
  
  // Show error message
  showToast('Failed to update like. Please try again.');
}, [recipe.id]);
```

## Testing

### Unit Tests

```typescript
describe('RecipeCard', () => {
  const mockRecipe: Recipe = {
    id: '1',
    title: 'Test Recipe',
    username: 'testuser',
    likes: 10,
    comments_count: 5,
    is_liked: false,
    is_saved: false,
  };

  it('renders recipe information correctly', () => {
    render(<RecipeCard recipe={mockRecipe} />);
    
    expect(screen.getByText('Test Recipe')).toBeInTheDocument();
    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('handles like action correctly', async () => {
    const mockToggleLike = jest.fn();
    render(<RecipeCard recipe={mockRecipe} />);
    
    fireEvent.press(screen.getByLabelText('Like recipe'));
    
    await waitFor(() => {
      expect(mockToggleLike).toHaveBeenCalledWith({
        userId: 'user1',
        recipeId: '1',
        currentlyLiked: false,
      });
    });
  });
});
```

### Integration Tests

```typescript
describe('RecipeCard Integration', () => {
  it('navigates to recipe detail on press', () => {
    const mockNavigation = { navigate: jest.fn() };
    render(
      <RecipeCard 
        recipe={mockRecipe} 
        onPress={() => mockNavigation.navigate('RecipeDetail', { id: '1' })}
      />
    );
    
    fireEvent.press(screen.getByRole('button'));
    
    expect(mockNavigation.navigate).toHaveBeenCalledWith('RecipeDetail', { id: '1' });
  });
});
```

## Future Enhancements

### Planned Features

1. **Video Previews**: Auto-playing video thumbnails
2. **Advanced Filtering**: Diet-based filtering options
3. **Nutrition Display**: Calorie and macro information
4. **Recipe Ratings**: Star rating system

### Performance Improvements

1. **Virtual Scrolling**: For very long feeds
2. **Progressive Loading**: Lazy load non-critical data
3. **Image Compression**: Automatic image optimization

## Dependencies

### Required Packages

```json
{
  "react": "^18.x.x",
  "react-native": "^0.x.x",
  "react-native-fast-image": "^8.x.x",
  "@react-navigation/native": "^6.x.x",
  "@tanstack/react-query": "^5.x.x"
}
```

### Internal Dependencies

- `src/hooks/useAuth.ts`: Authentication context
- `src/hooks/usePantryMatch.ts`: Pantry matching logic
- `src/components/ActionButton.tsx`: Reusable action buttons
- `src/utils/formatters.ts`: Date and number formatting

## Troubleshooting

### Common Issues

1. **Images Not Loading**: Check network connectivity and image URLs
2. **Social Actions Failing**: Verify authentication state
3. **Performance Issues**: Check for unnecessary re-renders

### Debug Tips

```typescript
// Enable debug logging
const DEBUG_RECIPE_CARD = __DEV__;

if (DEBUG_RECIPE_CARD) {
  console.log('RecipeCard render:', {
    id: recipe.id,
    title: recipe.title,
    likes: recipe.likes,
    is_liked: recipe.is_liked,
  });
}
```

## Conclusion

The `RecipeCard` component is a fundamental building block of the KitchAI v2 user interface, providing a rich, interactive way to display recipe information while maintaining excellent performance and accessibility standards.

---

**Last Updated**: January 2025  
**Component Version**: 2.0.0  
**Maintainer**: KitchAI Development Team 