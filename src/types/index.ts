// src/types/index.ts
export interface RecipeItem {
  id: string;                 // Maps from output_id
  title: string;              // Maps from output_name
  video: string;              // Maps from output_video_url
  pantryMatchPct?: number;    // Calculated
  liked?: boolean;            // Maps from output_is_liked
  likes?: number;             // Maps from output_likes (or maybe likes_count? Check RPC usage)
  saved?: boolean;            // Maps from output_is_saved
  saves?: number;             // Note: RPC doesn't return save count. Need to adjust UI or RPC.
  userName?: string;          // Maps from user_name
  creatorAvatarUrl?: string | null;  // Maps from out_creator_avatar_url, allow null based on RPC data
  // Add other fields returned by RPC if needed:
  // comments?: any;          // Maps from output_comments
  // commentsCount?: number;  // Maps from output_comments_count
  // feedType?: string;       // Maps from output_feed_type
  // createdAt?: string;      // Maps from output_created_at
  // userId?: string;         // Maps from output_user_id
  // dietaryCategoryIds?: string[]; // Maps from output_dietary_category_ids

  // Internal client-side state (added by FeedScreen)
  onLike?: () => void;
  onSave?: () => void;

  // Raw counts from RPC for calculation (optional)
  _userIngredientsCount?: number; // Maps from output_user_ingredients_count
  _totalIngredientsCount?: number; // Maps from output_total_ingredients_count

  // Assumed field for pagination cursor (needs confirmation from RPC)
  cursor?: string | null;
} 