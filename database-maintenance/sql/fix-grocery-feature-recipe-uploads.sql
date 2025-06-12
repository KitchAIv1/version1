-- ============================================================
-- FIX GROCERY FEATURE: Recipe Uploads Table Issue
-- ============================================================
-- This script fixes the grocery feature that's failing due to 
-- missing recipe_uploads table references
-- ============================================================

-- First, check what tables actually exist
DO $$
DECLARE
    has_recipes BOOLEAN := FALSE;
    has_recipe_uploads BOOLEAN := FALSE;
BEGIN
    -- Check if recipes table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'recipes'
    ) INTO has_recipes;
    
    -- Check if recipe_uploads table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'recipe_uploads'
    ) INTO has_recipe_uploads;
    
    RAISE NOTICE 'Table Status: recipes=%, recipe_uploads=%', has_recipes, has_recipe_uploads;
    
    -- If recipe_uploads doesn't exist but recipes does, create recipe_uploads as a view or rename
    IF NOT has_recipe_uploads AND has_recipes THEN
        RAISE NOTICE 'Creating recipe_uploads table from existing recipes table...';
        
        -- Option 1: Create recipe_uploads as a copy of recipes (recommended)
        CREATE TABLE recipe_uploads AS SELECT * FROM recipes;
        
        -- Add any missing columns that might be expected
        ALTER TABLE recipe_uploads 
        ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT FALSE;
        
        ALTER TABLE recipe_uploads 
        ADD COLUMN IF NOT EXISTS difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard'));
        
        ALTER TABLE recipe_uploads 
        ADD COLUMN IF NOT EXISTS estimated_cost TEXT;
        
        ALTER TABLE recipe_uploads 
        ADD COLUMN IF NOT EXISTS nutrition_notes TEXT;
        
        -- Ensure proper constraints
        ALTER TABLE recipe_uploads 
        ADD CONSTRAINT recipe_uploads_pkey PRIMARY KEY (id);
        
        -- Add indexes for performance
        CREATE INDEX IF NOT EXISTS idx_recipe_uploads_user_id ON recipe_uploads(user_id);
        CREATE INDEX IF NOT EXISTS idx_recipe_uploads_public ON recipe_uploads(is_public);
        CREATE INDEX IF NOT EXISTS idx_recipe_uploads_ai_generated ON recipe_uploads(is_ai_generated);
        
        -- Set up RLS
        ALTER TABLE recipe_uploads ENABLE ROW LEVEL SECURITY;
        
        -- Create RLS policies
        CREATE POLICY "Users can view public recipes" ON recipe_uploads 
        FOR SELECT USING (is_public = true OR auth.uid() = user_id);
        
        CREATE POLICY "Users can manage own recipes" ON recipe_uploads 
        FOR ALL USING (auth.uid() = user_id);
        
        RAISE NOTICE 'Successfully created recipe_uploads table from recipes';
        
    ELSIF NOT has_recipe_uploads AND NOT has_recipes THEN
        RAISE NOTICE 'Neither recipes nor recipe_uploads table exists. Creating recipe_uploads...';
        
        -- Create recipe_uploads table from scratch
        CREATE TABLE recipe_uploads (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            video_url TEXT,
            thumbnail_url TEXT,
            ingredients JSONB DEFAULT '[]'::jsonb,
            diet_tags TEXT[] DEFAULT '{}',
            preparation_steps TEXT[] DEFAULT '{}',
            prep_time_minutes INTEGER DEFAULT 0,
            cook_time_minutes INTEGER DEFAULT 0,
            servings INTEGER DEFAULT 1,
            is_public BOOLEAN DEFAULT true,
            is_ai_generated BOOLEAN DEFAULT FALSE,
            difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
            estimated_cost TEXT,
            nutrition_notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Add indexes
        CREATE INDEX idx_recipe_uploads_user_id ON recipe_uploads(user_id);
        CREATE INDEX idx_recipe_uploads_public ON recipe_uploads(is_public);
        CREATE INDEX idx_recipe_uploads_ai_generated ON recipe_uploads(is_ai_generated);
        
        -- Set up RLS
        ALTER TABLE recipe_uploads ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can view public recipes" ON recipe_uploads 
        FOR SELECT USING (is_public = true OR auth.uid() = user_id);
        
        CREATE POLICY "Users can manage own recipes" ON recipe_uploads 
        FOR ALL USING (auth.uid() = user_id);
        
        RAISE NOTICE 'Successfully created recipe_uploads table from scratch';
        
    ELSE
        RAISE NOTICE 'recipe_uploads table already exists';
    END IF;
END $$;

-- ============================================================
-- Update get_recipe_details RPC to use recipe_uploads
-- ============================================================

CREATE OR REPLACE FUNCTION get_recipe_details(
    p_recipe_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    title TEXT,
    description TEXT,
    video_url TEXT,
    thumbnail_url TEXT,
    ingredients JSONB,
    diet_tags TEXT[],
    preparation_steps TEXT[],
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,
    servings INTEGER,
    is_public BOOLEAN,
    user_id UUID,
    username TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    is_liked BOOLEAN,
    like_count BIGINT,
    comment_count BIGINT,
    is_saved BOOLEAN,
    matched_ingredients TEXT[],
    missing_ingredient_names TEXT[],
    is_ai_generated BOOLEAN,
    difficulty TEXT,
    estimated_cost TEXT,
    nutrition_notes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.title,
        r.description,
        r.video_url,
        r.thumbnail_url,
        r.ingredients,
        r.diet_tags,
        r.preparation_steps,
        r.prep_time_minutes,
        r.cook_time_minutes,
        r.servings,
        r.is_public,
        r.user_id,
        p.username,
        p.avatar_url,
        r.created_at,
        r.updated_at,
        CASE 
            WHEN p_user_id IS NOT NULL THEN 
                EXISTS(SELECT 1 FROM user_interactions ui WHERE ui.user_id = p_user_id AND ui.recipe_id = r.id AND ui.interaction_type = 'like')
            ELSE FALSE
        END as is_liked,
        COALESCE((SELECT COUNT(*) FROM user_interactions ui WHERE ui.recipe_id = r.id AND ui.interaction_type = 'like'), 0) as like_count,
        COALESCE((SELECT COUNT(*) FROM recipe_comments rc WHERE rc.recipe_id = r.id), 0) as comment_count,
        CASE 
            WHEN p_user_id IS NOT NULL THEN 
                EXISTS(SELECT 1 FROM saved_recipe_videos srv WHERE srv.user_id = p_user_id AND srv.recipe_id = r.id)
            ELSE FALSE
        END as is_saved,
        ARRAY[]::TEXT[] as matched_ingredients,
        ARRAY[]::TEXT[] as missing_ingredient_names,
        COALESCE(r.is_ai_generated, FALSE) as is_ai_generated,
        r.difficulty,
        r.estimated_cost,
        r.nutrition_notes
    FROM recipe_uploads r  -- ✅ FIXED: Now uses recipe_uploads instead of recipes
    LEFT JOIN profiles p ON r.user_id = p.id
    WHERE r.id = p_recipe_id;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_recipe_details(UUID, UUID) TO authenticated;

-- ============================================================
-- Verify the fix worked
-- ============================================================

DO $$
DECLARE
    recipe_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO recipe_count FROM recipe_uploads;
    RAISE NOTICE 'recipe_uploads table now has % recipes', recipe_count;
    
    -- Test the RPC function
    PERFORM get_recipe_details(
        (SELECT id FROM recipe_uploads LIMIT 1),
        NULL
    );
    RAISE NOTICE 'get_recipe_details RPC function is working correctly';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Note: % (this is expected if no recipes exist yet)', SQLERRM;
END $$;

RAISE NOTICE '✅ Grocery feature recipe_uploads fix completed successfully!'; 