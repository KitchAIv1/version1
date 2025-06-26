const { createClient } = require('@supabase/supabase-js');

// Your Supabase URL and anon key
const supabaseUrl = 'https://btpmaqffdmxhugvybgfn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0cG1hcWZmZG14aHVndnliZ2ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ5MDk5MTIsImV4cCI6MjA1MDQ4NTkxMn0.RA_6l-YNNZyBPy9DKK-YAGHmdAd9dQ7Zq7qfZfxT4ts';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixAIRecipeThumbnails() {
  console.log('Starting to fix AI recipe thumbnails...');
  
  try {
    // First, let's see how many AI recipes have the broken URL
    const { data: brokenRecipes, error: checkError } = await supabase
      .from('recipe_uploads')
      .select('id, title, thumbnail_url, is_ai_generated')
      .eq('is_ai_generated', true)
      .eq('thumbnail_url', 'https://btpmaqffdmxhugvybgfn.supabase.co/storage/v1/object/public/app-assets/kitch-ai-recipe-default.jpg');
    
    if (checkError) {
      console.error('Error checking broken recipes:', checkError);
      return;
    }
    
    console.log(`Found ${brokenRecipes?.length || 0} AI recipes with broken thumbnail URLs:`);
    brokenRecipes?.forEach(recipe => {
      console.log(`- ${recipe.title} (ID: ${recipe.id})`);
    });
    
    if (!brokenRecipes || brokenRecipes.length === 0) {
      console.log('No AI recipes found with broken thumbnails.');
      return;
    }
    
    // Update all broken AI recipe thumbnails
    const { data: updateResult, error: updateError } = await supabase
      .from('recipe_uploads')
      .update({ 
        thumbnail_url: 'https://btpmaqffdmxhugvybgfn.supabase.co/storage/v1/object/public/recipe-thumbnails/porkstirfry.jpeg' 
      })
      .eq('is_ai_generated', true)
      .eq('thumbnail_url', 'https://btpmaqffdmxhugvybgfn.supabase.co/storage/v1/object/public/app-assets/kitch-ai-recipe-default.jpg');
    
    if (updateError) {
      console.error('Error updating recipes:', updateError);
      return;
    }
    
    console.log('✅ Successfully updated AI recipe thumbnails!');
    console.log(`Updated ${brokenRecipes.length} recipes to use the working porkstirfry.jpeg image.`);
    
  } catch (error) {
    console.error('Script error:', error);
  }
}

// Run the script
fixAIRecipeThumbnails(); 