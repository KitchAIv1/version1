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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('recipe_uploads')
    .insert(recipeData)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to insert recipe data: ${error.message}`)
  }

  console.log(`[VIDEO-PROCESSOR] Recipe inserted with ID: ${data.id}`)
  return data.id
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
serve(async (request: Request) => {
  const startTime = Date.now()
  console.log(`[VIDEO-PROCESSOR] Request received: ${request.method} ${request.url}`)

  try {
    // Validate request method
    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { fileName, metadata } = await request.json()

    if (!fileName || !metadata) {
      return new Response(
        JSON.stringify({ error: 'Missing fileName or metadata' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Authenticate user
    const user = await getUserFromRequest(request)
    console.log(`[VIDEO-PROCESSOR] Processing video for user: ${user.id}`)

    // Validate metadata
    validateMetadata(metadata)

    // Download and validate video file
    const videoData = await downloadVideoFile(fileName)
    validateVideoFile(fileName, videoData.length)

    // Move video to processed folder (no transcoding)
    const processedFilename = generateProcessedFilename(fileName)
    const videoUrl = await moveVideoToProcessed(videoData, processedFilename)

    // Insert recipe data
    const recipeId = await insertRecipeData(metadata, user.id, videoUrl)

    // Cleanup raw video (non-blocking)
    cleanupRawVideo(fileName).catch(console.warn)

    const processingTime = Date.now() - startTime
    console.log(`[VIDEO-PROCESSOR] Processing completed in ${processingTime}ms`)

    const result: ProcessingResult = {
      success: true,
      recipeId,
      videoUrl,
      thumbnailUrl: metadata.thumbnail_url,
      processingTime,
      message: 'Video processed successfully (no transcoding - original format preserved)'
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error(`[VIDEO-PROCESSOR] Error after ${processingTime}ms:`, error)

    // Determine appropriate status code
    let statusCode = 500
    if ((error as Error).message.includes('Authentication failed') || (error as Error).message.includes('Authorization')) {
      statusCode = 401
    } else if ((error as Error).message.includes('Missing') || (error as Error).message.includes('Invalid') || (error as Error).message.includes('Unsupported')) {
      statusCode = 400
    }

    return new Response(
      JSON.stringify({
        error: 'Video processing failed',
        details: (error as Error).message,
        processingTime
      }),
      { status: statusCode, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

console.log('[VIDEO-PROCESSOR] Edge Function initialized and ready (No FFmpeg - Original format preserved)')
