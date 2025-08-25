'use server';

import { ebookWriterOrchestrator } from './ebook-writer-orchestrator';
import { createClient } from '@/app/supabase/server';
import type { UploadedDocument } from './ebook-document-handler';

interface GenerateEbookTitlesRequest {
  topic: string;
  uploaded_documents?: UploadedDocument[];
}

interface GenerateEbookTitlesResponse {
  success: boolean;
  generated_titles?: string[];
  error?: string;
  credits_used?: number;
}

/**
 * Server action for generating eBook titles
 * Calls the orchestrator with proper authentication
 */
export async function generateEbookTitles(
  request: GenerateEbookTitlesRequest
): Promise<GenerateEbookTitlesResponse> {
  console.log('🔥 Server Action: generateEbookTitles called with:', { topic: request.topic, documentsCount: request.uploaded_documents?.length });
  
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('👤 User authentication:', { user: user?.id, error: authError });
    
    if (authError || !user) {
      console.error('❌ Authentication failed:', authError);
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    console.log('🎯 Calling orchestrator with workflow_intent: title_only');
    
    // Call the orchestrator for title generation
    const response = await ebookWriterOrchestrator({
      topic: request.topic,
      workflow_intent: 'title_only',
      uploaded_documents: request.uploaded_documents,
      user_id: user.id
    });

    console.log('🏗️ Orchestrator response:', response);

    if (!response.success) {
      console.error('❌ Orchestrator failed:', response.error);
      return {
        success: false,
        error: response.error || 'Title generation failed'
      };
    }

    console.log('✅ Returning successful response with titles:', response.generated_titles);
    return {
      success: true,
      generated_titles: response.generated_titles || [],
      credits_used: response.credits_used
    };

  } catch (error) {
    console.error('💥 Title generation server action error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Title generation failed'
    };
  }
}