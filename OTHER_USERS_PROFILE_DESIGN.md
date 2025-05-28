# 👥 OTHER USERS' PROFILE DESIGN SPECIFICATION

## 🎯 **Design Philosophy**

When viewing **other creators' profiles**, users should see:
- **Public information only** (recipes, bio, stats)
- **Social interaction tools** (follow button, recipe engagement)
- **Discovery-focused content** (their best recipes, not private data)

---

## 📱 **Profile Layout for Other Users**

### ✅ **Header Section** (Same as own profile)
```typescript
- Avatar (80x80, circular)
- Username with tier badge (if creator)
- Bio text
- Stats row: Posts | Followers | Following
- Action buttons: [Follow Button] [Share Profile]
```

### ✅ **Tab Structure** (Different from own profile)

#### **Option A: Single Tab (Recommended)**
```typescript
// Only show their public recipes
<Tabs.Container>
  <Tabs.Tab name="Recipes" label="Recipes">
    <PublicRecipesGrid recipes={profile.videos} />
  </Tabs.Tab>
</Tabs.Container>
```

#### **Option B: Two Tabs**
```typescript
// Show recipes + basic stats
<Tabs.Container>
  <Tabs.Tab name="Recipes" label="Recipes">
    <PublicRecipesGrid recipes={profile.videos} />
  </Tabs.Tab>
  <Tabs.Tab name="About" label="About">
    <CreatorAboutSection profile={profile} />
  </Tabs.Tab>
</Tabs.Container>
```

#### **Option C: Three Tabs (Most Comprehensive)**
```typescript
// Show recipes, popular, and about
<Tabs.Container>
  <Tabs.Tab name="Recent" label="Recent">
    <PublicRecipesGrid recipes={profile.videos} sortBy="recent" />
  </Tabs.Tab>
  <Tabs.Tab name="Popular" label="Popular">
    <PublicRecipesGrid recipes={profile.videos} sortBy="popular" />
  </Tabs.Tab>
  <Tabs.Tab name="About" label="About">
    <CreatorAboutSection profile={profile} />
  </Tabs.Tab>
</Tabs.Container>
```

---

## 🚫 **What NOT to Show**

### ❌ **Private Data**
- Saved recipes (private to user)
- Meal plans (private to user)
- Activity feed (private to user)
- Usage limits/tier details
- Edit profile options

### ❌ **Own Profile Features**
- "Add Recipe" button
- "Edit Profile" button
- Sign out menu
- Tier modal with usage stats

---

## 🎨 **Recommended Implementation: Option A (Single Tab)**

### **Why Single Tab?**
1. **Simplicity**: Focus on what matters - their recipes
2. **Performance**: Faster loading, less complexity
3. **Mobile UX**: Less cognitive load, cleaner interface
4. **Content Focus**: Highlights their culinary creations

### **Enhanced Single Tab Features**
```typescript
interface OtherUserProfileTab {
  // Recipe grid with enhanced features
  recipes: PublicRecipe[];
  
  // Sorting options
  sortOptions: ['Recent', 'Popular', 'Most Liked'];
  
  // Filter options
  filterOptions: ['All', 'Breakfast', 'Lunch', 'Dinner', 'Dessert'];
  
  // Search within their recipes
  searchEnabled: true;
  
  // Recipe interaction
  likeEnabled: true;
  saveEnabled: true;
  shareEnabled: true;
}
```

---

## 🔧 **Implementation Plan**

### **Step 1: Update ProfileScreen Logic**
```typescript
// In ProfileScreen.tsx
const renderTabsForProfile = () => {
  if (isOwnProfile) {
    return (
      <Tabs.Container>
        <Tabs.Tab name="My Recipes" label="My Recipes">...</Tabs.Tab>
        <Tabs.Tab name="Saved" label="Saved">...</Tabs.Tab>
        <Tabs.Tab name="Planner" label="Planner">...</Tabs.Tab>
        <Tabs.Tab name="Activity" label="Activity">...</Tabs.Tab>
      </Tabs.Container>
    );
  } else {
    return (
      <Tabs.Container>
        <Tabs.Tab name="Recipes" label="Recipes">
          <PublicRecipesTab 
            recipes={profile.videos}
            creatorId={profile.user_id}
            creatorName={profile.username}
          />
        </Tabs.Tab>
      </Tabs.Container>
    );
  }
};
```

### **Step 2: Create PublicRecipesTab Component**
```typescript
// New component: src/components/PublicRecipesTab.tsx
interface PublicRecipesTabProps {
  recipes: VideoPostData[];
  creatorId: string;
  creatorName: string;
}

export const PublicRecipesTab: React.FC<PublicRecipesTabProps> = ({
  recipes,
  creatorId,
  creatorName
}) => {
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredRecipes = useMemo(() => {
    let filtered = recipes;
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(recipe => 
        recipe.recipe_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply sorting
    if (sortBy === 'recent') {
      filtered = filtered.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else if (sortBy === 'popular') {
      // Sort by likes (would need to add likes count to recipe data)
      filtered = filtered.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    }
    
    return filtered;
  }, [recipes, searchQuery, sortBy]);
  
  return (
    <View style={styles.container}>
      {/* Search and Sort Header */}
      <View style={styles.header}>
        <SearchBar 
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={`Search ${creatorName}'s recipes...`}
        />
        <SortToggle 
          value={sortBy}
          onChange={setSortBy}
          options={['recent', 'popular']}
        />
      </View>
      
      {/* Recipe Grid */}
      <FlatList
        data={filteredRecipes}
        renderItem={({ item }) => (
          <PublicRecipeCard 
            recipe={item}
            showCreator={false} // Don't show creator since we're on their profile
            onPress={() => navigation.navigate('RecipeDetail', { id: item.recipe_id })}
          />
        )}
        numColumns={2}
        keyExtractor={(item) => item.recipe_id}
        ListEmptyComponent={
          <EmptyState 
            title="No recipes yet"
            subtitle={`${creatorName} hasn't shared any recipes yet.`}
          />
        }
      />
    </View>
  );
};
```

### **Step 3: Update Backend Data**
```typescript
// Ensure we only fetch public recipes for other users
const useProfile = (targetUserId?: string) => {
  const { user } = useAuth();
  const isOwnProfile = !targetUserId || targetUserId === user?.id;
  
  return useQuery({
    queryKey: ['profile', targetUserId, isOwnProfile],
    queryFn: async () => {
      if (isOwnProfile) {
        // Fetch full profile with saved recipes, etc.
        return await supabase.rpc('get_profile_details', { p_user_id: userId });
      } else {
        // Fetch public profile only
        return await supabase.rpc('get_public_profile_details', { p_user_id: targetUserId });
      }
    }
  });
};
```

---

## 🎨 **Visual Design Mockup**

```
┌─────────────────────────────────┐
│ ← Back                    Share │ <- Navigation header
├─────────────────────────────────┤
│  [Avatar]    @username ⭐       │ <- Profile header
│              "Bio text here"    │
│                                 │
│  📱 12    👥 1.2K    👤 234    │ <- Stats
│  Posts    Followers  Following  │
│                                 │
│  [Follow] [Share Profile]       │ <- Action buttons
├─────────────────────────────────┤
│           Recipes               │ <- Single tab
├─────────────────────────────────┤
│ 🔍 Search recipes...  [Recent▼]│ <- Search & sort
├─────────────────────────────────┤
│ [Recipe1] [Recipe2]             │ <- Recipe grid
│ [Recipe3] [Recipe4]             │
│ [Recipe5] [Recipe6]             │
│                                 │
└─────────────────────────────────┘
```

---

## 🚀 **Benefits of This Approach**

### **For Users**
- **Clear Focus**: See what the creator is known for (their recipes)
- **Easy Discovery**: Search and sort through their content
- **Social Interaction**: Like, save, and share their recipes
- **Privacy Respected**: No access to private data

### **For Creators**
- **Showcase Platform**: Clean way to display their work
- **Engagement Tools**: Users can interact with their content
- **Growth Potential**: Follow button encourages community building
- **Professional Look**: Clean, focused profile presentation

### **For App**
- **Performance**: Simpler UI = faster loading
- **Maintenance**: Less complex code to maintain
- **Scalability**: Easy to add features later (filters, categories)
- **User Retention**: Focus on content discovery

---

## 🔄 **Future Enhancements**

### **Phase 2 Features**
1. **Recipe Categories**: Filter by meal type, cuisine, etc.
2. **Creator Stats**: Total likes, saves, views
3. **Featured Recipes**: Highlight their best content
4. **Recipe Collections**: Group recipes into themed collections

### **Phase 3 Features**
1. **Creator About Tab**: Detailed bio, cooking style, achievements
2. **Recipe Reviews**: User reviews on their recipes
3. **Cooking Tips**: Creator's tips and techniques
4. **Live Cooking**: Integration with live streaming features

---

**Recommendation**: Start with **Option A (Single Tab)** for simplicity and user focus, then iterate based on user feedback and usage patterns. 