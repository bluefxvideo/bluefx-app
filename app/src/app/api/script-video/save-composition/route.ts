import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// CORS helper - allow multiple origins for editor access
const ALLOWED_ORIGINS = [
  'https://editor.bluefx.net',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
  'http://localhost:3000'
];

function getAllowedOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin') || '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  return process.env.NEXT_PUBLIC_VIDEO_EDITOR_URL || 'https://editor.bluefx.net';
}

/**
 * API endpoint for saving video editor compositions
 * 
 * This endpoint saves the full editor state to the database, preserving all
 * user edits, additions, and modifications made in the React video editor.
 */
export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient();
  try {
    console.log('💾 Save Composition API: Starting request');

    const {
      user_id,
      video_id,
      composition_data,
      metadata = {}
    } = await request.json();
    
    console.log('💾 Save Composition API: user_id =', user_id, 'video_id =', video_id);
    
    // Validate required fields
    if (!user_id) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID is required' 
      }, { status: 400 });
    }
    
    if (!composition_data) {
      return NextResponse.json({ 
        success: false, 
        error: 'Composition data is required' 
      }, { status: 400 });
    }
    
    // Check if composition already exists for this video
    let existingComposition = null;
    if (video_id) {
      const { data: existing } = await supabase
        .from('video_editor_compositions')
        .select('id, version')
        .eq('video_id', video_id)
        .eq('user_id', user_id)
        .single();
      
      existingComposition = existing;
    }
    
    let result;
    
    if (existingComposition) {
      // Update existing composition
      console.log('💾 Updating existing composition:', existingComposition.id);
      
      const { data, error } = await supabase
        .from('video_editor_compositions')
        .update({
          composition_data,
          metadata: {
            ...metadata,
            last_saved: new Date().toISOString(),
            save_source: 'editor_api'
          },
          version: existingComposition.version + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingComposition.id)
        .eq('user_id', user_id)
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error updating composition:', error);
        throw error;
      }
      
      result = data;
    } else {
      // Create new composition
      console.log('💾 Creating new composition');
      
      const { data, error } = await supabase
        .from('video_editor_compositions')
        .insert({
          video_id: video_id || null,
          user_id,
          composition_data,
          metadata: {
            ...metadata,
            created_source: 'editor_api',
            initial_save: new Date().toISOString()
          },
          version: 1
        })
        .select()
        .single();
      
      if (error) {
        console.error('❌ Error creating composition:', error);
        throw error;
      }
      
      result = data;
    }
    
    console.log('✅ Composition saved successfully:', result.id);
    
    const response = NextResponse.json({
      success: true,
      data: {
        id: result.id,
        video_id: result.video_id,
        version: result.version,
        updated_at: result.updated_at
      }
    });
    
    // Add CORS headers for editor access
    response.headers.set('Access-Control-Allow-Origin', getAllowedOrigin(request));
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning');
    
    return response;
    
  } catch (error) {
    console.error('Error saving composition:', error);
    
    const errorResponse = NextResponse.json(
      { 
        success: false, 
        error: 'Failed to save composition',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
    
    // Add CORS headers to error response too
    errorResponse.headers.set('Access-Control-Allow-Origin', getAllowedOrigin(request));
    errorResponse.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning');
    
    return errorResponse;
  }
}

/**
 * OPTIONS handler for CORS support
 */
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': getAllowedOrigin(request),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, ngrok-skip-browser-warning',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}

/**
 * GET handler to load saved composition or forward to editor-data endpoint
 */
export async function GET(request: NextRequest) {
  const supabase = getSupabaseClient();
  try {
    console.log('🔍 Save Composition GET - Request received');
    console.log('🔍 Origin:', request.headers.get('origin'));
    console.log('🔍 Environment CORS setting:', getAllowedOrigin(request));

    const { searchParams } = new URL(request.url);
    const video_id = searchParams.get('video_id') || searchParams.get('videoId');
    const user_id = searchParams.get('user_id') || searchParams.get('userId');
    const composition_id = searchParams.get('composition_id');
    
    console.log('📥 Save Composition GET:', { video_id, user_id, composition_id, allParams: Object.fromEntries(searchParams) });
    
    // Check saved compositions table first when user_id and video_id are provided
    // This preserves user edits (animated videos, layout changes, etc.)
    if (user_id && video_id && !composition_id) {
      console.log('🔍 Checking for saved composition first:', { user_id, video_id });

      try {
        const { data: savedComp, error: savedError } = await supabase
          .from('video_editor_compositions')
          .select('*')
          .eq('user_id', user_id)
          .eq('video_id', video_id)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single();

        if (savedComp && !savedError) {
          console.log('✅ Found saved composition:', savedComp.id);
          const response = NextResponse.json({
            success: true,
            data: savedComp,
          });
          response.headers.set('Access-Control-Allow-Origin', getAllowedOrigin(request));
          response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
          response.headers.set('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning');
          return response;
        }

        console.log('📭 No saved composition found, forwarding to editor-data');
      } catch (error) {
        console.warn('⚠️ Error checking saved compositions:', error);
      }

      // No saved composition — fall back to editor-data endpoint
      try {
        const editorDataUrl = new URL(request.url);
        editorDataUrl.pathname = '/api/script-video/editor-data';
        editorDataUrl.searchParams.set('userId', user_id);
        editorDataUrl.searchParams.set('videoId', video_id);
        editorDataUrl.searchParams.delete('user_id');
        editorDataUrl.searchParams.delete('video_id');

        const newRequest = new NextRequest(editorDataUrl, {
          method: 'GET',
          headers: request.headers,
        });

        const editorDataModule = await import('../editor-data/route');
        return await editorDataModule.GET(newRequest);
      } catch (error) {
        console.error('❌ Error forwarding to editor-data:', error);

        const errorResponse = NextResponse.json({
          success: false,
          error: 'Failed to load video data',
          details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });

        errorResponse.headers.set('Access-Control-Allow-Origin', getAllowedOrigin(request));
        errorResponse.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning');

        return errorResponse;
      }
    }
    
    if (!user_id) {
      const errorResponse = NextResponse.json({ 
        success: false, 
        error: 'User ID is required' 
      }, { status: 400 });
      
      errorResponse.headers.set('Access-Control-Allow-Origin', getAllowedOrigin(request));
      return errorResponse;
    }
    
    let query = supabase
      .from('video_editor_compositions')
      .select('*')
      .eq('user_id', user_id);
    
    // Add specific filters if provided
    if (composition_id) {
      query = query.eq('id', composition_id);
    } else if (video_id) {
      query = query.eq('video_id', video_id);
    }
    
    // Get the most recent composition
    query = query.order('updated_at', { ascending: false }).limit(1);
    
    const { data, error } = await query.single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Error loading composition:', error);
      throw error;
    }
    
    if (!data) {
      const response = NextResponse.json({
        success: true,
        data: null,
        message: 'No saved composition found'
      });
      
      response.headers.set('Access-Control-Allow-Origin', getAllowedOrigin(request));
      return response;
    }
    
    console.log('✅ Composition loaded successfully:', data.id);
    
    const response = NextResponse.json({
      success: true,
      data: {
        id: data.id,
        video_id: data.video_id,
        composition_data: data.composition_data,
        metadata: data.metadata,
        version: data.version,
        updated_at: data.updated_at
      }
    });
    
    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', getAllowedOrigin(request));
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning');
    
    return response;
    
  } catch (error) {
    console.error('Error loading composition:', error);
    
    const errorResponse = NextResponse.json(
      { 
        success: false, 
        error: 'Failed to load composition',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
    
    errorResponse.headers.set('Access-Control-Allow-Origin', getAllowedOrigin(request));
    errorResponse.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    errorResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning');
    
    return errorResponse;
  }
}