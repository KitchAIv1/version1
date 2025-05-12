import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
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

export default function CommentsTab() {
  const route = useRoute<any>();
  const recipeId = route.params?.id;
  const { user } = useAuth();
  const [commentText, setCommentText] = useState('');
  const queryClient = useQueryClient();
  
  // Use React Query to fetch comments
  const {
    data: comments,
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
        
        console.log(`Updated comment count from ${currentDetails.comments_count} to ${comments.length}`);
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
      
      // Log for debugging
      console.log('Comment posted successfully, invalidated both queries');
    }
  });

  const handlePostComment = () => {
    if (!commentText.trim()) return;
    postCommentMutation.mutate(commentText.trim());
  };
  
  const formatCommentDate = (dateString: string) => {
    try {
      return formatDistance(new Date(dateString), new Date(), { addSuffix: true });
    } catch (e) {
      return 'recently';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {comments && comments.length > 0 ? (
          comments.map((comment) => (
            <View key={comment.id} style={styles.commentItem}>
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
          ))
        ) : (
          <View style={styles.emptyState}>
            <Feather name="message-circle" size={24} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No comments yet. Be the first to comment!</Text>
          </View>
        )}
      </ScrollView>

      {/* Comment input section */}
      <View style={styles.inputContainer}>
        <TextInput
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white || '#fff',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white || '#fff',
  },
  errorText: {
    color: COLORS.error || 'red',
    fontSize: 16,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border || '#eee',
    backgroundColor: COLORS.white || '#fff',
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surface || '#f5f5f5',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    maxHeight: 100,
    color: COLORS.text || '#333',
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