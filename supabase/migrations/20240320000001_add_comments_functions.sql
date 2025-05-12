-- Create recipe_comments table if it doesn't exist
CREATE TABLE IF NOT EXISTS recipe_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create function to get recipe comments with user info
CREATE OR REPLACE FUNCTION get_recipe_comments(p_recipe_id UUID)
RETURNS TABLE (
  id UUID,
  recipe_id UUID,
  user_id UUID,
  comment_text TEXT,
  created_at TIMESTAMPTZ,
  username TEXT,
  avatar_url TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.recipe_id,
    c.user_id,
    c.comment_text,
    c.created_at,
    p.username,
    p.avatar_url
  FROM 
    recipe_comments c
  LEFT JOIN 
    profiles p ON c.user_id = p.id
  WHERE 
    c.recipe_id = p_recipe_id
  ORDER BY 
    c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add appropriate permissions
ALTER TABLE recipe_comments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view comments
CREATE POLICY "Anyone can view recipe comments" ON recipe_comments
  FOR SELECT USING (true);

-- Allow authenticated users to create comments
CREATE POLICY "Authenticated users can add comments" ON recipe_comments
  FOR INSERT TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own comments
CREATE POLICY "Users can update their own comments" ON recipe_comments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own comments
CREATE POLICY "Users can delete their own comments" ON recipe_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Update recipes_comments trigger function to increment comment count on recipes
CREATE OR REPLACE FUNCTION update_recipe_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE recipes SET comments_count = comments_count + 1 WHERE id = NEW.recipe_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE recipes SET comments_count = comments_count - 1 WHERE id = OLD.recipe_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for comment count
DROP TRIGGER IF EXISTS trigger_update_recipe_comments_count ON recipe_comments;
CREATE TRIGGER trigger_update_recipe_comments_count
  AFTER INSERT OR DELETE ON recipe_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_recipe_comments_count(); 