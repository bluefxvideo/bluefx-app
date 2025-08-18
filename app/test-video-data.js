const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with environment variables
const supabase = createClient(
  'https://ihzcmpngyjxraxzmckiv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloemNtcG5neWp4cmF4em1ja2l2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mjc0NzE4OCwiZXhwIjoyMDY4MzIzMTg4fQ.1iPVevmceVmPhn1ftGlaXwhaMfu5CrYx4XmEHCCHg2s'
);

async function queryVideoData() {
  try {
    console.log('Querying script_to_video_history table...');
    
    // Get the latest video record
    const { data, error } = await supabase
      .from('script_to_video_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('Error querying data:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('No video data found in script_to_video_history table');
      return;
    }
    
    const latestVideo = data[0];
    console.log('\n=== LATEST VIDEO DATA ===');
    console.log('ID:', latestVideo.id);
    console.log('User ID:', latestVideo.user_id);
    console.log('Script Title:', latestVideo.script_title);
    console.log('Script Content Length:', latestVideo.script_content?.length || 0, 'characters');
    console.log('Video Style:', latestVideo.video_style);
    console.log('Status:', latestVideo.status);
    console.log('Video URL:', latestVideo.video_url);
    console.log('Thumbnail URL:', latestVideo.thumbnail_url);
    console.log('Created At:', latestVideo.created_at);
    console.log('Updated At:', latestVideo.updated_at);
    
    // Show processing logs structure
    if (latestVideo.processing_logs) {
      console.log('\n=== PROCESSING LOGS ===');
      console.log('Processing Logs Keys:', Object.keys(latestVideo.processing_logs));
      
      if (latestVideo.processing_logs.segments) {
        console.log('Segments Count:', latestVideo.processing_logs.segments.length);
        if (latestVideo.processing_logs.segments.length > 0) {
          console.log('First Segment Sample:', JSON.stringify(latestVideo.processing_logs.segments[0], null, 2));
        }
      }
      
      if (latestVideo.processing_logs.audio_url) {
        console.log('Audio URL:', latestVideo.processing_logs.audio_url);
      }
      
      if (latestVideo.processing_logs.generated_images) {
        console.log('Generated Images Count:', latestVideo.processing_logs.generated_images.length);
      }
    }
    
    // Show whisper data if available
    if (latestVideo.whisper_data) {
      console.log('\n=== WHISPER DATA ===');
      console.log('Whisper Data Keys:', Object.keys(latestVideo.whisper_data));
      
      if (latestVideo.whisper_data.frame_alignment) {
        console.log('Frame Alignment Count:', latestVideo.whisper_data.frame_alignment.length);
      }
    }
    
    // Show other structured data
    if (latestVideo.storyboard_data) {
      console.log('\n=== STORYBOARD DATA ===');
      console.log('Storyboard Keys:', Object.keys(latestVideo.storyboard_data));
    }
    
    if (latestVideo.caption_data) {
      console.log('\n=== CAPTION DATA ===');
      console.log('Caption Keys:', Object.keys(latestVideo.caption_data));
    }
    
  } catch (error) {
    console.error('Script error:', error);
  }
}

async function checkTableExists() {
  try {
    // Try to query the script_videos table that the API route expects
    console.log('Checking if script_videos table exists...');
    const { data, error } = await supabase
      .from('script_videos')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('script_videos table error:', error.message);
    } else {
      console.log('script_videos table exists with', data.length, 'records');
    }
  } catch (error) {
    console.error('Error checking script_videos table:', error);
  }
}

// Run the queries
async function main() {
  await checkTableExists();
  await queryVideoData();
}

main();