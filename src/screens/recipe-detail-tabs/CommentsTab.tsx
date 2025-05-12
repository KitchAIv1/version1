import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Dimensions,
  Easing,
  ScrollView,
  SafeAreaView,
  KeyboardEvent,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../providers/AuthProvider';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { COLORS } from '../../constants/theme';
import { formatDistance } from 'date-fns';
import { RecipeDetailsData } from '../../hooks/useRecipeDetails';

interface Comment {
  id: string;
  comment_text: string;
  created_at: string;
  username: string;
  avatar_url: string | null;
}

// Memoized Comment component for better performance
const CommentItem = memo(({ comment, formatCommentDate }: { 
  comment: Comment, 
  formatCommentDate: (date: string) => string 
}) => {
  return (
    <View style={styles.commentItem}>
      <View style={styles.commentHeader}>
        {comment.avatar_url ? (
          <Image 
            source={{ uri: comment.avatar_url }} 
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Feather name="user" size={16} color={COLORS.primary} />
          </View>
        )}
        <View style={styles.commentInfo}>
          <Text style={styles.username}>{comment.username || 'Anonymous'}</Text>
          <Text style={styles.timestamp}>{formatCommentDate(comment.created_at)}</Text>
        </View>
      </View>
      <Text style={styles.commentText}>{comment.comment_text}</Text>
    </View>
  );
});

// Empty state component
const EmptyComments = memo(() => (
  <View style={styles.emptyState}>
    <Feather name="message-circle" size={24} color={COLORS.textSecondary} />
    <Text style={styles.emptyText}>No comments yet. Be the first to comment!</Text>
  </View>
));

export default function CommentsTab() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const recipeId = route.params?.id;
  const { user } = useAuth();
  const [commentText, setCommentText] = useState('');
  const queryClient = useQueryClient();
  const inputRef = useRef<TextInput>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showAllComments, setShowAllComments] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  
  const VISIBLE_COMMENTS_COUNT = 3; // Number of comments to show initially
  
  // Use React Query to fetch comments with optimized caching
  const {
    data: comments = [],
    isLoading,
    error
  } = useQuery<Comment[]>({
    queryKey: ['recipe-comments', recipeId],
    queryFn: async () => {
      if (!recipeId) return [];
      
      const { data, error } = await supabase
        .rpc('get_recipe_comments', {
          p_recipe_id: recipeId
        });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!recipeId,
    staleTime: 2 * 60 * 1000, // 2 minutes stale time
    gcTime: 10 * 60 * 1000, // 10 minutes cache time
  });
  
  // Update the comment count whenever comments change
  useEffect(() => {
    if (comments && Array.isArray(comments)) {
      // Get the current recipe details with correct typing
      const currentDetails = queryClient.getQueryData<RecipeDetailsData>(['recipeDetails', recipeId]);
      
      // If we have recipe details and the comment count doesn't match
      if (currentDetails && currentDetails.comments_count !== comments.length) {
        // Update the comment count in the recipe details
        queryClient.setQueryData<RecipeDetailsData>(['recipeDetails', recipeId], {
          ...currentDetails,
          comments_count: comments.length
        });
      }
    }
  }, [comments, recipeId, queryClient]);
  
  // Mutation for posting comments
  const postCommentMutation = useMutation({
    mutationFn: async (text: string) => {
      if (!user?.id || !recipeId) throw new Error('User or recipe ID missing');
      
      const { error } = await supabase
        .from('recipe_comments')
        .insert({
          recipe_id: recipeId,
          user_id: user.id,
          comment_text: text
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      // Clear input and refetch comments
      setCommentText('');
      
      // Invalidate both queries to ensure count is updated everywhere
      queryClient.invalidateQueries({ queryKey: ['recipe-comments', recipeId] });
      queryClient.invalidateQueries({ queryKey: ['recipeDetails', recipeId] });
      
      // After posting, show all comments to see the new one
      setShowAllComments(true);
    }
  });

  // Handle post comment
  const handlePostComment = useCallback(() => {
    if (!commentText.trim()) return;
    postCommentMutation.mutate(commentText.trim());
  }, [commentText, postCommentMutation]);
  
  // Enhanced keyboard monitoring to track both visibility and height
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e: KeyboardEvent) => {
        setIsKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

  // Function to focus the input
  const focusCommentInput = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Handle click on a comment
  const handleCommentPress = useCallback(() => {
    // Focus the input field when a comment is clicked
    focusCommentInput();
  }, [focusCommentInput]);

  // Function to handle viewing all comments
  const handleViewAllComments = () => {
    setShowAllComments(true);
  };

  // Get the comments to display based on showAllComments state
  const visibleComments = showAllComments 
    ? comments 
    : comments.slice(0, VISIBLE_COMMENTS_COUNT);
  
  // Memoize this function to prevent re-renders
  const formatCommentDate = useCallback((dateString: string) => {
    try {
      return formatDistance(new Date(dateString), new Date(), { addSuffix: true });
    } catch (e) {
      return 'recently';
    }
  }, []);

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          Could not load comments.
        </Text>
      </View>
    );
  }

  // Create a clickable comment item that focuses the input on press
  const renderCommentItem = (comment: Comment) => (
    <TouchableOpacity 
      key={`comment-${recipeId}-${comment.id || Math.random().toString()}`}
      onPress={handleCommentPress}
      activeOpacity={0.8}
    >
      <CommentItem
        comment={comment}
        formatCommentDate={formatCommentDate}
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Scrollable Comments Section */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.commentsContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {comments.length === 0 ? (
          <EmptyComments />
        ) : (
          <>
            {visibleComments.map(renderCommentItem)}
            
            {comments.length > VISIBLE_COMMENTS_COUNT && !showAllComments && (
              <TouchableOpacity 
                style={styles.viewAllButton} 
                onPress={handleViewAllComments}
              >
                <Text style={styles.viewAllText}>
                  View all {comments.length} comments
                </Text>
              </TouchableOpacity>
            )}
            
            {/* Extra space at the bottom to prevent the comment input from covering content */}
            <View style={{ height: 80 }} />
          </>
        )}
      </ScrollView>

      {/* Fixed comment input field - uses absolute positioning to stay at bottom */}
      <View 
        style={[
          styles.inputWrapper, 
          // Adjust position when keyboard is visible
          isKeyboardVisible && { bottom: Platform.OS === 'ios' ? keyboardHeight : 0 }
        ]}
      >
        <View style={[
          styles.inputContainer,
          { borderTopColor: isKeyboardVisible ? COLORS.primary : COLORS.border }
        ]}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Add a comment..."
            value={commentText}
            onChangeText={setCommentText}
            multiline={true}
            maxLength={500}
          />
          <TouchableOpacity 
            style={[
              styles.postButton, 
              !commentText.trim() && styles.disabledButton
            ]}
            onPress={handlePostComment}
            disabled={!commentText.trim() || postCommentMutation.isPending}
          >
            {postCommentMutation.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white || '#fff',
    position: 'relative', // Important for absolute positioning of child components
  },
  scrollView: {
    flex: 1,
  },
  commentsContainer: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white || '#fff',
    paddingVertical: 30,
  },
  errorText: {
    color: COLORS.error || 'red',
    fontSize: 16,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    marginTop: 12,
    color: COLORS.textSecondary || '#666',
    fontSize: 16,
    textAlign: 'center',
    maxWidth: '80%',
  },
  commentItem: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border || '#f0f0f0',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface || '#f0f0f0',
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface || '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border || '#eee',
  },
  commentInfo: {
    marginLeft: 12,
    flex: 1,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text || '#333',
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.textSecondary || '#888',
    marginTop: 2,
  },
  commentText: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.text || '#333',
    paddingLeft: 44, // Align with username
  },
  viewAllButton: {
    padding: 12,
    alignItems: 'center',
    marginVertical: 8,
  },
  viewAllText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary || '#00796b',
  },
  inputWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    backgroundColor: COLORS.white,
    zIndex: 999, // Ensure it's above other elements
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    backgroundColor: COLORS.white || '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    fontSize: 15,
    maxHeight: 100,
    color: COLORS.text || '#333',
    borderWidth: 1,
    borderColor: COLORS.border || '#e0e0e0',
  },
  postButton: {
    marginLeft: 12,
    backgroundColor: COLORS.primary || '#00796b',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: COLORS.border || '#ddd',
    opacity: 0.8,
  }
}); 