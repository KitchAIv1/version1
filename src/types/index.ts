// src/types/index.ts
export interface RecipeItem {
  id: string;                 // Unique identifier for the recipe
  recipe_id: string;          // From your log data
  title: string;              // From your log data
  video_url?: string;         // From your log data (main video/image)
  video?: string;             // Alternative video property for compatibility
  thumbnail_url?: string;     // From your log data (specific thumbnail)
  created_at?: string;        // From your log data
  
  // Fields from original RecipeItem that might still be relevant or populated elsewhere:
  description?: string;
  pantryMatchPct?: number;
  liked?: boolean;
  likes?: number;
  saved?: boolean; // This could be crucial for your new requirement!
  saves?: number;
  userName?: string;
  creatorAvatarUrl?: string | null;
  creator_user_id?: string;   // Added for navigation to user profiles
  
  // comments?: any;
  commentsCount?: number;
  // feedType?: string;
  // userId?: string; // This would be the creator's ID, recipe_id is the recipe's unique ID
  // dietaryCategoryIds?: string[];

  // Internal client-side state (added by FeedScreen)
  onLike?: () => void;
  onSave?: () => void;

  _userIngredientsCount?: number;
  _totalIngredientsCount?: number;
  cursor?: string | null;

  // Add a flag if the backend can provide it for distinguishing saved vs created
  source?: 'saved' | 'created_by_user' | 'feed'; 
} 