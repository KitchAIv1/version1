-- Create missing user_follows table for the follow system
-- This table is required by get_profile_details and all follow functionality

CREATE TABLE IF NOT EXISTS public.user_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent users from following themselves
  CONSTRAINT user_follows_no_self_follow CHECK (follower_id != followed_id),
  
  -- Prevent duplicate follows
  CONSTRAINT user_follows_unique UNIQUE (follower_id, followed_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_followed_id ON public.user_follows(followed_id);

-- Enable RLS (Row Level Security)
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all follows"
  ON public.user_follows
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can follow others"
  ON public.user_follows
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow others"
  ON public.user_follows
  FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON public.user_follows TO authenticated;
GRANT USAGE ON SEQUENCE user_follows_id_seq TO authenticated; 