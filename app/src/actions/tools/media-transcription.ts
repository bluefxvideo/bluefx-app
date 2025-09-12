'use server';

import { createClient } from '@/app/supabase/server';
import { z } from 'zod';

// Input validation schema
const TranscribeMediaSchema = z.object({
  fileName: z.string(),
  fileBuffer: z.instanceof(Buffer),
  mimeType: z.string(),
  userId: z.string(),
});

export interface TranscriptionResult {
  success: boolean;
  transcription_id?: string;
  text?: string;
  summary?: string;
  entities?: any[];
  sentiment_analysis?: any;
  confidence?: number;
  duration?: number;
  speaker_labels?: any[];
  error?: string;
}

/**
 * Upload media file to Supabase Storage and transcribe using AssemblyAI
 */
export async function transcribeMediaFile(
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string,
  userId?: string
): Promise<TranscriptionResult> {
  try {
    const supabase = await createClient();
    
    // Get the actual user ID from auth if not provided
    if (!userId) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }
      userId = user.id;
    }
    
    // Validate input
    TranscribeMediaSchema.parse({ fileName, fileBuffer, mimeType, userId });
    
    // Generate unique file path
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 9);
    const fileExtension = fileName.split('.').pop() || 'mp3';
    const storagePath = `${userId}/temp/${timestamp}_${randomId}.${fileExtension}`;
    
    console.log(`Uploading file to storage: ${storagePath}`);
    
    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('content-multiplier')
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });
    
    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }
    
    console.log('File uploaded successfully, generating signed URL...');
    
    // Generate a signed URL for AssemblyAI to access the file
    const { data: urlData, error: urlError } = await supabase
      .storage
      .from('content-multiplier')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry
    
    if (urlError || !urlData?.signedUrl) {
      console.error('Failed to create signed URL:', urlError);
      // Clean up the uploaded file
      await supabase.storage
        .from('content-multiplier')
        .remove([storagePath]);
      throw new Error('Failed to create signed URL for transcription');
    }
    
    console.log('Calling AssemblyAI for transcription...');
    
    // Call AssemblyAI directly from the server action
    const assemblyAIKey = process.env.ASSEMBLYAI_API_KEY;
    if (!assemblyAIKey) {
      // Clean up the uploaded file
      await supabase.storage
        .from('content-multiplier')
        .remove([storagePath]);
      throw new Error('AssemblyAI API key not configured');
    }
    
    // Make direct API call to AssemblyAI
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': assemblyAIKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: urlData.signedUrl,
        speaker_labels: true,
        auto_highlights: true,
        sentiment_analysis: true,
        entity_detection: true,
        // Note: auto_chapters and summarization cannot be enabled together
        summarization: true,
        summary_model: 'conversational',
        summary_type: 'bullets',
      }),
    });
    
    if (!transcriptResponse.ok) {
      const error = await transcriptResponse.text();
      console.error('AssemblyAI API error:', error);
      // Clean up the uploaded file
      await supabase.storage
        .from('content-multiplier')
        .remove([storagePath]);
      throw new Error('Failed to start transcription');
    }
    
    const transcript = await transcriptResponse.json();
    console.log('Transcription job started with ID:', transcript.id);
    
    // Poll for transcription completion
    let result = transcript;
    while (result.status === 'queued' || result.status === 'processing') {
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      
      const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcript.id}`, {
        headers: {
          'Authorization': assemblyAIKey,
        },
      });
      
      if (!pollResponse.ok) {
        // Clean up the uploaded file
        await supabase.storage
          .from('content-multiplier')
          .remove([storagePath]);
        throw new Error('Failed to poll transcription status');
      }
      
      result = await pollResponse.json();
      console.log('Transcription status:', result.status);
    }
    
    if (result.status === 'error') {
      console.error('Transcription failed:', result.error);
      // Clean up the uploaded file
      await supabase.storage
        .from('content-multiplier')
        .remove([storagePath]);
      throw new Error(`Transcription failed: ${result.error}`);
    }
    
    // Clean up the temporary file after successful transcription
    await supabase.storage
      .from('content-multiplier')
      .remove([storagePath]);
    
    console.log('Transcription completed successfully');
    
    return {
      success: true,
      transcription_id: result.id,
      text: result.text,
      summary: result.summary,
      entities: result.entities,
      sentiment_analysis: result.sentiment_analysis_results,
      confidence: result.confidence,
      duration: result.audio_duration,
      speaker_labels: result.utterances?.map((u: any) => ({
        speaker: u.speaker,
        text: u.text,
        start: u.start,
        end: u.end,
        confidence: u.confidence
      })),
    };
    
  } catch (error) {
    console.error('Error in transcribeMediaFile:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Extract text from PDF files using PDF parsing
 */
export async function extractTextFromPDF(
  fileName: string,
  fileBuffer: Buffer,
  userId: string
): Promise<{ success: boolean; text?: string; error?: string }> {
  try {
    // For PDFs, we'll use a different approach
    // You can integrate pdf-parse or similar library here
    // For now, returning a placeholder
    
    // TODO: Implement actual PDF text extraction
    // Options:
    // 1. Use pdf-parse library
    // 2. Use an external service
    // 3. Create another edge function for PDF processing
    
    return {
      success: true,
      text: `Text extracted from PDF: ${fileName}`,
    };
    
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Process any uploaded file (router function)
 */
export async function processUploadedFile(
  file: File,
  userId?: string
): Promise<{ 
  success: boolean; 
  text?: string; 
  transcription?: string;
  summary?: string;
  error?: string;
}> {
  try {
    // Get the actual user ID from auth if not provided
    if (!userId) {
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }
      userId = user.id;
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    
    // Route based on file type
    if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
      // Transcribe audio/video files
      const result = await transcribeMediaFile(
        file.name,
        fileBuffer,
        file.type,
        userId
      );
      
      if (result.success) {
        return {
          success: true,
          transcription: result.text,
          summary: result.summary,
        };
      } else {
        return {
          success: false,
          error: result.error,
        };
      }
      
    } else if (file.type === 'application/pdf') {
      // Extract text from PDF
      const result = await extractTextFromPDF(
        file.name,
        fileBuffer,
        userId
      );
      
      return {
        success: result.success,
        text: result.text,
        error: result.error,
      };
      
    } else if (file.type.startsWith('text/')) {
      // For text files, just read the content
      const text = new TextDecoder().decode(fileBuffer);
      
      return {
        success: true,
        text,
      };
      
    } else {
      return {
        success: false,
        error: `Unsupported file type: ${file.type}`,
      };
    }
    
  } catch (error) {
    console.error('Error processing uploaded file:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}