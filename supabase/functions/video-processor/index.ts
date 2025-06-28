// KitchAI Video Processor - Supabase Edge Function (No FFmpeg)
// Validates, stores, and processes video recipe data

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// Environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Configuration constants
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
const SUPPORTED_FORMATS = ['mp4', 'mov', 'avi', 'mkv', 'webm']
const MAX_PROCESSING_TIME = 60000 // 1 minute (no transcoding needed)

// Initialize Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Types
interface VideoMetadata {
  id: string
  title: string
  description?: string
  ingredients: Array<{
    name: string
    quantity: string
    unit: string
  }>
  diet_tags: string[]
  preparation_steps: string[]
  prep_time_minutes: number
  cook_time_minutes: number
  servings: number
  is_public: boolean
  thumbnail_url?: string
}

interface ProcessingResult {
  success: boolean
  recipeId: string
  videoUrl: string
  thumbnailUrl?: string
  processingTime: number
  message: string
}

// Utility functions
function validateUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || ''
}

function generateProcessedFilename(originalFilename: string): string {
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2, 8)
  const extension = getFileExtension(originalFilename)
  return `${timestamp}-${randomStr}.${extension}`
}

// Authentication helper
async function getUserFromRequest(request: Request): Promise<{ id: string; email: string }> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header')
  }

  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    throw new Error(`Authentication failed: ${error?.message || 'Invalid token'}`)
  }

  return { id: user.id, email: user.email || '' }
}

// Validation functions
function validateMetadata(metadata: VideoMetadata): void {
  const requiredFields = ['id', 'title', 'ingredients', 'diet_tags', 'preparation_steps']
  const missingFields = requiredFields.filter(field => !metadata[field as keyof VideoMetadata])
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`)
  }

  if (!validateUUID(metadata.id)) {
    throw new Error(`Invalid UUID format for id: ${metadata.id}`)
  }

  if (!metadata.title?.trim()) {
    throw new Error('Title cannot be empty')
  }

  if (!Array.isArray(metadata.ingredients) || metadata.ingredients.length === 0) {
    throw new Error('At least one ingredient is required')
  }

  if (!Array.isArray(metadata.preparation_steps) || metadata.preparation_steps.length === 0) {
    throw new Error('At least one preparation step is required')
  }
}

function validateVideoFile(filename: string, fileSize: number): void {
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(`File size ${(fileSize / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`)
  }

  const extension = getFileExtension(filename)
  if (!SUPPORTED_FORMATS.includes(extension)) {
    throw new Error(`Unsupported video format: ${extension}. Supported formats: ${SUPPORTED_FORMATS.join(', ')}`)
  }
}

// Video processing functions
async function downloadVideoFile(filename: string): Promise<Uint8Array> {
  console.log(`[VIDEO-PROCESSOR] Downloading raw video: ${filename}`)
  
  const { data, error } = await supabase.storage
    .from('videos')
    .download(`raw-videos/${filename}`)

  if (error) {
    throw new Error(`Failed to download video file: ${error.message}`)
  }

  if (!data) {
    throw new Error('No data received from storage')
  }

  const fileData = new Uint8Array(await data.arrayBuffer())
  console.log(`[VIDEO-PROCESSOR] Downloaded ${fileData.length} bytes`)
  
  return fileData
}

async function moveVideoToProcessed(videoData: Uint8Array, filename: string): Promise<string> {
  console.log(`[VIDEO-PROCESSOR] Moving video to processed folder: ${filename}`)
  
  // Determine content type based on file extension
  const extension = getFileExtension(filename)
  let contentType = 'video/mp4'
  
  switch (extension) {
    case 'mov':
      contentType = 'video/quicktime'
      break
    case 'avi':
      contentType = 'video/x-msvideo'
      break
    case 'mkv':
      contentType = 'video/x-matroska'
      break
    case 'webm':
      contentType = 'video/webm'
      break
    default:
      contentType = 'video/mp4'
  }

  const { data, error } = await supabase.storage
    .from('videos')
    .upload(`processed-videos/${filename}`, videoData, {
      contentType,
      cacheControl: '3600'
    })

  if (error) {
    throw new Error(`Failed to upload processed video: ${error.message}`)
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('videos')
    .getPublicUrl(`processed-videos/${filename}`)

  console.log(`[VIDEO-PROCESSOR] Processed video URL: ${urlData.publicUrl}`)
  return urlData.publicUrl
}

async function insertRecipeData(metadata: VideoMetadata, userId: string, videoUrl: string): Promise<string> {
  console.log(`[VIDEO-PROCESSOR] Inserting recipe data for user ${userId}`)
  
  const recipeData = {
    id: metadata.id,
    user_id: userId,
    title: metadata.title,
    description: metadata.description || null,
    ingredients: metadata.ingredients,
    diet_tags: metadata.diet_tags,
    preparation_steps: metadata.preparation_steps,
    prep_time_minutes: metadata.prep_time_minutes,
    cook_time_minutes: metadata.cook_time_minutes,
    servings: metadata.servings,
    is_public: metadata.is_public,
    video_url: videoUrl,
    thumbnail_url: metadata.thumbnail_url || null,
    is_ai_generated: false,
    created_at: new Date().toISOString(),
  }

  console.log(`[VIDEO-PROCESSOR] Inserting recipe with data:`, recipeData)

  const { data, error } = await supabase
    .from('recipe_uploads')
    .insert([recipeData])
    .select()

  if (error) {
    console.error(`[VIDEO-PROCESSOR] Database insertion error:`, error)
    throw new Error(`Failed to save recipe: ${error.message}`)
  }

  console.log(`[VIDEO-PROCESSOR] Successfully inserted recipe:`, data)
  return data[0].id
}

async function cleanupRawVideo(filename: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from('videos')
      .remove([`raw-videos/${filename}`])

    if (error) {
      console.warn(`[VIDEO-PROCESSOR] Failed to cleanup raw video: ${error.message}`)
    } else {
      console.log(`[VIDEO-PROCESSOR] Raw video cleaned up: ${filename}`)
    }
  } catch (e) {
    console.warn(`[VIDEO-PROCESSOR] Cleanup error: ${e}`)
  }
}

// Main handler
serve(async (req) => {
  try {
    console.log(`[VIDEO-PROCESSOR] Request received: ${req.method} ${req.url}`)
    
    if (req.method !== 'POST') {
      console.log(`[VIDEO-PROCESSOR] Invalid method: ${req.method}`)
      return new Response('Method not allowed', { status: 405 })
    }

    const { fileName, metadata } = await req.json()
    console.log(`[VIDEO-PROCESSOR] Request body parsed:`, { fileName, metadata: !!metadata })

    if (!fileName || !metadata) {
      console.log(`[VIDEO-PROCESSOR] Missing required fields:`, { fileName: !!fileName, metadata: !!metadata })
      return new Response('Missing fileName or metadata', { status: 400 })
    }

    // Get the user from the Authorization header
    const authHeader = req.headers.get('Authorization')
    console.log(`[VIDEO-PROCESSOR] Auth header present:`, !!authHeader)
    
    if (!authHeader) {
      console.log(`[VIDEO-PROCESSOR] No authorization header`)
      return new Response('Unauthorized', { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    console.log(`[VIDEO-PROCESSOR] User auth result:`, { 
      user: !!user, 
      userId: user?.id, 
      error: userError?.message 
    })

    if (userError || !user) {
      console.log(`[VIDEO-PROCESSOR] User authentication failed:`, userError?.message)
      return new Response('Unauthorized', { status: 401 })
    }

    console.log(`[VIDEO-PROCESSOR] Processing video for user ${user.id}, fileName: ${fileName}`)

    // Download the raw video from storage
    const { data: videoBlob, error: downloadError } = await supabase.storage
      .from('videos')
      .download(`raw-videos/${fileName}`)

    console.log(`[VIDEO-PROCESSOR] Video download result:`, { 
      success: !!videoBlob, 
      error: downloadError?.message,
      size: videoBlob?.size 
    })

    if (downloadError || !videoBlob) {
      console.log(`[VIDEO-PROCESSOR] Failed to download video:`, downloadError?.message)
      return new Response(`Failed to download video: ${downloadError?.message}`, { status: 400 })
    }

    // Upload the processed video (for now, just re-upload the same video)
    const processedFileName = fileName.replace('raw-videos/', '')
    const processedPath = `processed-videos/${processedFileName}`

    console.log(`[VIDEO-PROCESSOR] Uploading processed video to: ${processedPath}`)

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('videos')
      .upload(processedPath, videoBlob, {
        contentType: 'video/mp4',
        upsert: true,
      })

    console.log(`[VIDEO-PROCESSOR] Processed video upload result:`, { 
      success: !!uploadData, 
      error: uploadError?.message,
      path: uploadData?.path 
    })

    if (uploadError) {
      console.log(`[VIDEO-PROCESSOR] Failed to upload processed video:`, uploadError.message)
      return new Response(`Failed to upload processed video: ${uploadError.message}`, { status: 500 })
    }

    // Get the public URL for the processed video
    const { data: urlData } = supabase.storage
      .from('videos')
      .getPublicUrl(processedPath)

    const videoUrl = urlData.publicUrl
    console.log(`[VIDEO-PROCESSOR] Generated video URL:`, videoUrl)

    // Insert the recipe data into the database
    console.log(`[VIDEO-PROCESSOR] Inserting recipe data...`)
    const recipeId = await insertRecipeData(metadata, user.id, videoUrl)
    console.log(`[VIDEO-PROCESSOR] Recipe inserted successfully with ID:`, recipeId)

    // Clean up the raw video
    console.log(`[VIDEO-PROCESSOR] Cleaning up raw video...`)
    const { error: deleteError } = await supabase.storage
      .from('videos')
      .remove([`raw-videos/${fileName}`])

    if (deleteError) {
      console.log(`[VIDEO-PROCESSOR] Warning: Failed to delete raw video:`, deleteError.message)
    } else {
      console.log(`[VIDEO-PROCESSOR] Raw video cleaned up successfully`)
    }

    console.log(`[VIDEO-PROCESSOR] Process completed successfully for recipe:`, recipeId)
    return new Response(JSON.stringify({ 
      success: true, 
      recipeId,
      videoUrl 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error(`[VIDEO-PROCESSOR] Unhandled error:`, error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

console.log('[VIDEO-PROCESSOR] Edge Function initialized and ready (No FFmpeg - Original format preserved)')
