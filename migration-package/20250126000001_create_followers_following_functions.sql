-- Create missing get_user_followers and get_user_following RPC functions
-- These are required by the FollowersDetailScreen component

-- Function to get list of users following a specific user (followers)
CREATE OR REPLACE FUNCTION public.get_user_followers(
    user_id_param UUID,
    limit_param INTEGER DEFAULT 50
)
RETURNS JSON AS $$
DECLARE
    followers_list JSON;
BEGIN
    -- Get list of followers with their profile information
    SELECT json_agg(
        json_build_object(
            'user_id', follower_profiles.user_id,
            'username', COALESCE(follower_profiles.username, 'Anonymous'),
            'avatar_url', COALESCE(follower_users.raw_user_meta_data ->> 'avatar_url', ''),
            'bio', COALESCE(follower_profiles.bio, ''),
            'followed_at', uf.created_at,
            'is_following_back', CASE 
                WHEN mutual_follows.follower_id IS NOT NULL THEN true 
                ELSE false 
            END
        ) ORDER BY uf.created_at DESC
    ) INTO followers_list
    FROM user_follows uf
    JOIN profiles follower_profiles ON uf.follower_id = follower_profiles.user_id
    JOIN auth.users follower_users ON uf.follower_id = follower_users.id
    LEFT JOIN user_follows mutual_follows ON (
        mutual_follows.follower_id = user_id_param 
        AND mutual_follows.followed_id = uf.follower_id
    )
    WHERE uf.followed_id = user_id_param
    LIMIT limit_param;

    RETURN COALESCE(followers_list, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get list of users that a specific user is following (following)
CREATE OR REPLACE FUNCTION public.get_user_following(
    user_id_param UUID,
    limit_param INTEGER DEFAULT 50
)
RETURNS JSON AS $$
DECLARE
    following_list JSON;
BEGIN
    -- Get list of users being followed with their profile information
    SELECT json_agg(
        json_build_object(
            'user_id', followed_profiles.user_id,
            'username', COALESCE(followed_profiles.username, 'Anonymous'),
            'avatar_url', COALESCE(followed_users.raw_user_meta_data ->> 'avatar_url', ''),
            'bio', COALESCE(followed_profiles.bio, ''),
            'followed_at', uf.created_at,
            'follows_back', CASE 
                WHEN mutual_follows.follower_id IS NOT NULL THEN true 
                ELSE false 
            END
        ) ORDER BY uf.created_at DESC
    ) INTO following_list
    FROM user_follows uf
    JOIN profiles followed_profiles ON uf.followed_id = followed_profiles.user_id
    JOIN auth.users followed_users ON uf.followed_id = followed_users.id
    LEFT JOIN user_follows mutual_follows ON (
        mutual_follows.follower_id = uf.followed_id 
        AND mutual_follows.followed_id = user_id_param
    )
    WHERE uf.follower_id = user_id_param
    LIMIT limit_param;

    RETURN COALESCE(following_list, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_user_followers(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_following(UUID, INTEGER) TO authenticated;

-- Add documentation
COMMENT ON FUNCTION public.get_user_followers(UUID, INTEGER) IS 'Get paginated list of users following the specified user with mutual follow detection';
COMMENT ON FUNCTION public.get_user_following(UUID, INTEGER) IS 'Get paginated list of users that the specified user is following with mutual follow detection'; 