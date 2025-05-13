// Step 3: Validate metadata
try {
  validateMetadata(metadata);
  console.log('Metadata validated successfully.');
} catch (validationError) {
  console.error('Metadata validation error:', validationError.message);
  return new Response(JSON.stringify({
    error: 'Invalid metadata',
    details: validationError.message
  }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  });
}

// DIAGNOSTIC: Introduce a delay for eventual consistency
console.log('[VIDEO-PROCESSOR] Waiting for 2 seconds before attempting to download raw video to allow storage to settle...');
await new Promise(resolve => setTimeout(resolve, 2000)); // 2-second delay
console.log('[VIDEO-PROCESSOR] Proceeding with raw video download...');

// Step 4: Download raw video from storage
const rawVideoStoragePath = `raw-videos/${fileName}`;
const localTempRawVideoPath = `/tmp/${fileName}`; // Using /tmp for temporary file storage in Deno Deploy

// ... existing code ... 