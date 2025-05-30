import React, { useState, useRef, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Animated,
  PanResponder,
  Keyboard,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../providers/AuthProvider';
import { supabase } from '../services/supabase';
import { COLORS } from '../constants/theme';
import { formatDistance } from 'date-fns';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecipeDetailsData } from '../hooks/useRecipeDetails';

interface Comment {
  id: string;
  comment_text: string;
  created_at: string;
  username: string;
  avatar_url: string | null;
}

interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
  recipeId: string;
}

// Memoized Comment Item Component
const CommentItem = memo(({ comment }: { comment: Comment }) => {
  const formatCommentDate = useCallback((dateString: string) => {
    try {
      return formatDistance(new Date(dateString), new Date(), { addSuffix: true });
    } catch (e) {
      return 'recently';
    }
  }, []);

  return (
    <View style={styles.commentItem}>
      <View style={styles.commentHeader}>
        {comment.avatar_url ? (
          <Image source={{ uri: comment.avatar_url }} style={styles.avatar} />
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

// Empty State Component
const EmptyComments = memo(() => (
  <View style={styles.emptyState}>
    <Feather name="message-circle" size={48} color={COLORS.textSecondary} />
    <Text style={styles.emptyText}>No comments yet.</Text>
    <Text style={styles.emptySubtext}>Be the first to share your thoughts!</Text>
  </View>
));

export default function CommentsModal({ visible, onClose, recipeId }: CommentsModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { top, bottom } = useSafeAreaInsets();
  const [commentText, setCommentText] = useState('');
  const inputRef = useRef<TextInput>(null);
  
  // Animation for modal slide up/down
  const slideAnim = useRef(new Animated.Value(0)).current;
  
  // Keyboard animation for Instagram-style behavior
  const keyboardAnim = useRef(new Animated.Value(0)).current;
  
  // Track if modal has been opened to defer heavy operations
  const hasOpenedRef = useRef(false);
  
  // Pan responder for swipe to dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return gestureState.dy > 0 && gestureState.dy > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 100) {
          handleClose();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Keyboard listeners for Instagram-style behavior
  React.useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        const keyboardHeight = e.endCoordinates.height;
        const keyboardDuration = e.duration || 250;
        
        const gapSize = 20;
        const moveUpDistance = keyboardHeight - gapSize;
        
        Animated.timing(keyboardAnim, {
          toValue: -moveUpDistance,
          duration: keyboardDuration,
          useNativeDriver: true,
        }).start();
      }
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (e) => {
        const keyboardDuration = e.duration || 250;
        
        Animated.timing(keyboardAnim, {
          toValue: 0,
          duration: keyboardDuration,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, [keyboardAnim]);

  // Fetch comments - only when modal is visible
  const {
    data: comments = [],
    isLoading,
    error,
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
    enabled: !!recipeId && visible,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Lightweight cache sync - only update comment count when comments actually change
  // Defer this operation to avoid blocking modal animations
  React.useEffect(() => {
    if (!visible || !hasOpenedRef.current || !comments || !Array.isArray(comments)) return;
    
    // Use setTimeout to defer cache updates until after animation completes
    const timeoutId = setTimeout(() => {
      const currentDetails = queryClient.getQueryData<RecipeDetailsData>(['recipeDetails', recipeId, user?.id]);
      
      if (currentDetails && currentDetails.comments_count !== comments.length) {
        // Update recipe details cache
        queryClient.setQueryData<RecipeDetailsData>(['recipeDetails', recipeId, user?.id], {
          ...currentDetails,
          comments_count: comments.length
        });
        
        // Also update feed cache to keep counts in sync
        queryClient.setQueryData(['feed'], (oldFeedData: any) => {
          if (!oldFeedData || !Array.isArray(oldFeedData)) return oldFeedData;
          
          return oldFeedData.map((item: any) => {
            if (item.id === recipeId || item.recipe_id === recipeId) {
              return {
                ...item,
                commentsCount: comments.length
              };
            }
            return item;
          });
        });
      }
    }, 100); // Small delay to ensure smooth animations
    
    return () => clearTimeout(timeoutId);
  }, [comments?.length, visible, recipeId, queryClient, user?.id]);

  // Optimized comment posting with reduced cache operations
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
    onMutate: async (text: string) => {
      // Cancel only essential queries to avoid blocking UI
      await queryClient.cancelQueries({ queryKey: ['recipe-comments', recipeId] });
      
      const previousComments = queryClient.getQueryData(['recipe-comments', recipeId]);
      
      // Create optimistic comment
      const optimisticComment = {
        id: `temp-${Date.now()}`,
        comment_text: text,
        created_at: new Date().toISOString(),
        username: user?.user_metadata?.username || user?.email || 'You',
        avatar_url: user?.user_metadata?.avatar_url || null,
      };
      
      // Only update comments list optimistically - defer other cache updates
      queryClient.setQueryData(['recipe-comments', recipeId], (oldComments: Comment[] = []) => {
        return [optimisticComment, ...oldComments];
      });
      
      return { previousComments };
    },
    onSuccess: () => {
      setCommentText('');
      
      // Invalidate comment queries immediately for fresh data
      queryClient.invalidateQueries({ queryKey: ['recipe-comments', recipeId] });
      
      // Immediately update both caches with optimistic comment count
      const currentCommentCount = (comments?.length || 0) + 1;
      
      // Update recipe details cache immediately
      queryClient.setQueryData(['recipeDetails', recipeId, user?.id], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          comments_count: currentCommentCount
        };
      });
      
      // Update feed cache immediately
      queryClient.setQueryData(['feed'], (oldFeedData: any) => {
        if (!oldFeedData || !Array.isArray(oldFeedData)) return oldFeedData;
        
        return oldFeedData.map((item: any) => {
          if (item.id === recipeId || item.recipe_id === recipeId) {
            return {
              ...item,
              commentsCount: currentCommentCount
            };
          }
          return item;
        });
      });
      
      console.log(`[CommentsModal] Comment posted, updated count to ${currentCommentCount} in all caches`);
    },
    onError: (error, variables, context) => {
      // Simple rollback
      if (context?.previousComments) {
        queryClient.setQueryData(['recipe-comments', recipeId], context.previousComments);
      }
      console.error('Failed to post comment:', error);
    }
  });

  const handlePostComment = useCallback(() => {
    if (!commentText.trim()) return;
    postCommentMutation.mutate(commentText.trim());
  }, [commentText, postCommentMutation]);

  const handleClose = useCallback(() => {
    // Dismiss keyboard first
    Keyboard.dismiss();
    
    // Smooth parallel animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 250, // Faster for snappier feel
        useNativeDriver: true,
      }),
      Animated.timing(keyboardAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      })
    ]).start(() => {
      onClose();
      // Reset animations after modal is closed
      slideAnim.setValue(0);
      keyboardAnim.setValue(0);
      hasOpenedRef.current = false;
    });
  }, [onClose, slideAnim, keyboardAnim]);

  // Optimized modal opening animation
  React.useEffect(() => {
    if (visible) {
      // Reset animations
      slideAnim.setValue(300);
      keyboardAnim.setValue(0);
      
      // Fast, smooth spring animation
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80, // Higher tension for snappier animation
        friction: 8,
        useNativeDriver: true,
      }).start(() => {
        // Mark as opened after animation completes
        hasOpenedRef.current = true;
      });
    }
  }, [visible, slideAnim, keyboardAnim]);

  const renderComment = useCallback(({ item }: { item: Comment }) => (
    <CommentItem comment={item} />
  ), []);

  const keyExtractor = useCallback((item: Comment, index: number) => {
    return item.id ? `comment-${item.id}` : `comment-${index}-${item.created_at}`;
  }, []);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.backdrop} 
          activeOpacity={1} 
          onPress={handleClose}
        />
        
        <Animated.View
          style={[
            styles.modalContainer,
            {
              paddingTop: top,
              transform: [
                { translateY: slideAnim },
                { translateY: keyboardAnim },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.dragHandle} />
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Comments</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Feather name="x" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Comments List */}
          <View style={styles.content}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>Could not load comments.</Text>
              </View>
            ) : (
              <FlatList
                data={comments}
                renderItem={renderComment}
                keyExtractor={keyExtractor}
                contentContainerStyle={styles.commentsList}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={EmptyComments}
                keyboardShouldPersistTaps="handled"
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={10}
                initialNumToRender={8}
              />
            )}

            {/* Input Bar */}
            <View style={[styles.inputContainer, { paddingBottom: bottom }]}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Add a comment..."
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
                placeholderTextColor={COLORS.textSecondary}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  !commentText.trim() && styles.sendButtonDisabled
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
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '60%',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 16,
    textAlign: 'center',
  },
  commentsList: {
    padding: 20,
    paddingBottom: 120, // More space for input to prevent overlap
  },
  commentItem: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
    backgroundColor: COLORS.surface,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  commentInfo: {
    marginLeft: 12,
    flex: 1,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  commentText: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.text,
    paddingLeft: 44,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    maxHeight: 100,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 44,
  },
  sendButton: {
    marginLeft: 12,
    backgroundColor: COLORS.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.border,
    opacity: 0.6,
  },
}); 