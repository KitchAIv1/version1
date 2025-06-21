import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import OpenAI from 'https://esm.sh/openai@4.68.1';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Debug environment variables
console.log('🔍 ENVIRONMENT VARIABLE DEBUG:');
console.log(
  'SUPABASE_URL:',
  Deno.env.get('SUPABASE_URL') ? '✅ Set' : '❌ Missing',
);
console.log(
  'SUPABASE_ANON_KEY:',
  Deno.env.get('SUPABASE_ANON_KEY') ? '✅ Set' : '❌ Missing',
);
console.log(
  'OPENAI_API_KEY:',
  Deno.env.get('OPENAI_API_KEY') ? '✅ Set' : '❌ Missing',
);

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
);

// Initialize OpenAI client with better error handling
const apiKey = Deno.env.get('OPENAI_API_KEY');
if (!apiKey) {
  console.error('❌ OPENAI_API_KEY environment variable is not set!');
  throw new Error('OPENAI_API_KEY environment variable is required');
}

const openai = new OpenAI({
  apiKey,
});
console.log('✅ OpenAI client initialized successfully');

serve(async req => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  console.log(
    `[${new Date().toISOString()}] Received request: ${req.method} ${req.url}`,
  );

  try {
    if (req.method !== 'POST') {
      console.warn('Method Not Allowed:', req.method);
      return new Response(
        JSON.stringify({
          error: 'Method Not Allowed',
        }),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.warn('Missing authorization header');
      return new Response(
        JSON.stringify({
          error: 'Missing authorization header',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    console.log('Verifying user authentication...');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          details: authError?.message,
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    console.log('User authenticated:', user.id);

    let body;
    try {
      body = await req.json();
      console.log('Successfully parsed JSON body');
    } catch (e) {
      console.error('JSON parsing error:', e);
      return new Response(
        JSON.stringify({
          error: 'Invalid JSON body',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const base64Image = body.image;
    if (!base64Image || typeof base64Image !== 'string') {
      console.warn('Invalid or missing base64 image in request body');
      return new Response(
        JSON.stringify({
          error: "No valid base64 image provided in 'image' field",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    console.log(`Received base64 image data (length: ${base64Image.length})`);
    console.log('Calling OpenAI Vision API...');

    try {
      console.log('Attempting with model: gpt-4o');
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze the pantry items in this image. Identify specific ingredients, ignoring background objects and packaging text unless it clearly indicates the food item. For each distinct ingredient, estimate the visible quantity (e.g., count, approximate weight like \'500g\', volume like \'1L\', or description like \'half full\'). Return a JSON object with a single key \'items\' containing an array of objects. Each object in the array must have \'name\' (string, lowercase, simple name only - e.g., \'milk\' not \'Organic Whole Milk\') and \'quantity\' (string) fields. Example: { "items": [{"name": "eggs", "quantity": "6"}, {"name": "milk", "quantity": "half gallon"}, {"name": "apples", "quantity": "3"}] }.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 400,
      });

      console.log('✅ Success with gpt-4o');

      const aiResponseContent = response.choices[0]?.message?.content;
      console.log('OpenAI raw response content:', aiResponseContent);

      if (!aiResponseContent) {
        console.error('OpenAI returned null or empty content.');
        throw new Error('AI failed to generate a response.');
      }

      let result;
      try {
        result = JSON.parse(aiResponseContent);
        console.log('Successfully parsed AI JSON response:', result);
      } catch (e) {
        console.error(
          'AI response JSON parsing error:',
          e,
          'Raw content:',
          aiResponseContent,
        );

        // Attempt to extract JSON if embedded in text/markdown
        const jsonMatch = aiResponseContent.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          try {
            result = JSON.parse(jsonMatch[1].trim());
            console.log(
              'Successfully parsed fallback JSON from markdown block.',
            );
          } catch (fallbackError) {
            console.error('Fallback JSON parsing also failed:', fallbackError);
            throw new Error(
              'Invalid AI response format - not valid JSON, even in fallback.',
            );
          }
        } else {
          // Try to extract any JSON-like content between { and }
          const jsonContentMatch = aiResponseContent.match(/\{[\s\S]*\}/);
          if (jsonContentMatch) {
            try {
              result = JSON.parse(jsonContentMatch[0]);
              console.log('Successfully parsed JSON content without markdown.');
            } catch (contentError) {
              console.error('JSON content parsing failed:', contentError);
              throw new Error('Invalid AI response format - not valid JSON.');
            }
          } else {
            throw new Error('Invalid AI response format - not valid JSON.');
          }
        }
      }

      // Validate the structure { items: [...] }
      if (
        !result ||
        typeof result !== 'object' ||
        !Array.isArray(result.items)
      ) {
        console.error(
          'AI response does not match expected structure { items: [...] }',
        );
        throw new Error('AI response structure is invalid.');
      }

      // Filter valid items
      const validItems = result.items.filter(
        (item: any) =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.name === 'string' &&
          item.name.trim() !== '' &&
          typeof item.quantity === 'string',
      );

      if (validItems.length !== result.items.length) {
        console.warn(
          'Some items in the AI response were invalid and filtered out.',
          {
            originalCount: result.items.length,
            validCount: validItems.length,
          },
        );
      }

      if (validItems.length === 0) {
        console.log('No valid items found after parsing and validation.');
      }

      console.log('Returning valid items:', validItems);
      return new Response(
        JSON.stringify({
          items: validItems,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    } catch (error) {
      const errorMsg = (error as any).message || 'Unknown error';
      const errorCode = (error as any).code || 'Unknown code';
      const errorStatus = (error as any).status || 'Unknown status';

      console.error(
        `❌ Vision model failed: Status ${errorStatus}, Code: ${errorCode}, Message: ${errorMsg}`,
      );

      // If it's a model access error, return a clear message
      if (
        errorStatus === 403 ||
        errorCode === 'model_not_found' ||
        errorMsg.includes('does not have access')
      ) {
        return new Response(
          JSON.stringify({
            error: 'Vision AI Access Required',
            message:
              'Your OpenAI account needs access to vision models. Please upgrade your OpenAI plan or contact OpenAI support for access to gpt-4o vision capabilities.',
            items: [],
          }),
          {
            status: 200, // Return 200 so the app can handle this gracefully
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      // For other errors, throw them
      throw error;
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
