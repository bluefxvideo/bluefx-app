'use server';

import { createClient } from '@/app/supabase/server';
import { getFileType } from '@/utils/document-processing';

/**
 * Document Upload Handler for eBook Writer
 * Handles PDF, DOCX, TXT, and Markdown files
 * Stores in Supabase Storage and extracts text content
 */

export interface UploadedDocument {
  id: string;
  storage_path: string;
  filename: string;
  file_type: 'pdf' | 'docx' | 'txt' | 'markdown';
  content: string; // Extracted text
  token_count: number;
  file_size_mb: number;
  upload_timestamp: string;
  user_id: string;
}

/**
 * Upload document to Supabase storage and extract text
 */
export async function uploadEbookDocument(
  file: File,
  userId: string
): Promise<{ success: boolean; document?: UploadedDocument; error?: string }> {
  const supabase = await createClient();
  
  try {
    // Validate file type
    const fileType = getFileType(file.name);
    if (!fileType) {
      return { 
        success: false, 
        error: 'Unsupported file type. Please upload PDF, DOCX, TXT, or Markdown files.' 
      };
    }

    // Check file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return { 
        success: false, 
        error: 'File too large. Maximum size is 50MB.' 
      };
    }

    // Generate unique storage path
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `ebook-documents/${userId}/${timestamp}_${sanitizedName}`;

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return { 
        success: false, 
        error: 'Failed to upload document to storage.' 
      };
    }

    // Extract text content based on file type
    const buffer = await file.arrayBuffer();
    const extractedContent = await extractTextContent(
      Buffer.from(buffer), 
      fileType
    );

    if (!extractedContent.success) {
      // Clean up uploaded file if extraction fails
      await supabase.storage
        .from('documents')
        .remove([storagePath]);
      
      return { 
        success: false, 
        error: extractedContent.error 
      };
    }

    // Calculate token count (rough estimate: 1 token ≈ 4 characters)
    const tokenCount = Math.ceil(extractedContent.text.length / 4);

    // Store document metadata in database
    const { data: docRecord, error: dbError } = await supabase
      .from('ebook_documents')
      .insert({
        user_id: userId,
        storage_path: storagePath,
        filename: file.name,
        file_type: fileType,
        content: extractedContent.text,
        token_count: tokenCount,
        file_size_mb: file.size / (1024 * 1024),
        metadata: {
          original_name: file.name,
          mime_type: file.type,
          extraction_method: extractedContent.method
        }
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      // Clean up storage if database insert fails
      await supabase.storage
        .from('documents')
        .remove([storagePath]);
      
      return { 
        success: false, 
        error: 'Failed to save document metadata.' 
      };
    }

    return {
      success: true,
      document: {
        id: docRecord.id,
        storage_path: storagePath,
        filename: file.name,
        file_type: fileType,
        content: extractedContent.text,
        token_count: tokenCount,
        file_size_mb: file.size / (1024 * 1024),
        upload_timestamp: new Date().toISOString(),
        user_id: userId
      }
    };

  } catch (error) {
    console.error('Document upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process document'
    };
  }
}

/**
 * Extract text content from various file types
 */
async function extractTextContent(
  buffer: Buffer,
  fileType: string
): Promise<{ success: boolean; text: string; method: string; error?: string }> {
  try {
    switch (fileType) {
      case 'pdf':
        try {
          // Dynamic import for pdf-parse to avoid build issues
          const pdfParse = (await import('pdf-parse')).default;
          const pdfData = await pdfParse(buffer);
          return {
            success: true,
            text: pdfData.text,
            method: 'pdf-parse'
          };
        } catch (error) {
          return {
            success: false,
            text: '',
            method: 'pdf-parse',
            error: 'Failed to parse PDF: ' + (error instanceof Error ? error.message : 'Unknown error')
          };
        }

      case 'docx':
        try {
          // Dynamic import for mammoth to avoid build issues
          const mammoth = (await import('mammoth')).default;
          const result = await mammoth.extractRawText({ buffer });
          return {
            success: true,
            text: result.value,
            method: 'mammoth'
          };
        } catch (error) {
          return {
            success: false,
            text: '',
            method: 'mammoth',
            error: 'Failed to parse DOCX: ' + (error instanceof Error ? error.message : 'Unknown error')
          };
        }

      case 'txt':
      case 'markdown':
        // Direct text extraction
        return {
          success: true,
          text: buffer.toString('utf-8'),
          method: 'direct'
        };

      default:
        return {
          success: false,
          text: '',
          method: '',
          error: 'Unsupported file type'
        };
    }
  } catch (error) {
    console.error('Text extraction error:', error);
    return {
      success: false,
      text: '',
      method: '',
      error: error instanceof Error ? error.message : 'Failed to extract text'
    };
  }
}


/**
 * Retrieve uploaded documents for a user
 */
export async function getUserEbookDocuments(
  userId: string,
  ebookId?: string
): Promise<{ success: boolean; documents?: UploadedDocument[]; error?: string }> {
  const supabase = await createClient();
  
  try {
    let query = supabase
      .from('ebook_documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (ebookId) {
      query = query.eq('ebook_id', ebookId);
    }

    const { data, error } = await query;

    if (error) {
      return {
        success: false,
        error: 'Failed to retrieve documents'
      };
    }

    return {
      success: true,
      documents: data?.map(doc => ({
        id: doc.id,
        storage_path: doc.storage_path,
        filename: doc.filename,
        file_type: doc.file_type,
        content: doc.content,
        token_count: doc.token_count,
        file_size_mb: doc.file_size_mb,
        upload_timestamp: doc.created_at,
        user_id: doc.user_id
      }))
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve documents'
    };
  }
}

/**
 * Delete uploaded document
 */
export async function deleteEbookDocument(
  documentId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  
  try {
    // Get document details first
    const { data: doc, error: fetchError } = await supabase
      .from('ebook_documents')
      .select('storage_path')
      .eq('id', documentId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !doc) {
      return {
        success: false,
        error: 'Document not found'
      };
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([doc.storage_path]);

    if (storageError) {
      console.error('Storage deletion error:', storageError);
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('ebook_documents')
      .delete()
      .eq('id', documentId)
      .eq('user_id', userId);

    if (dbError) {
      return {
        success: false,
        error: 'Failed to delete document record'
      };
    }

    return { success: true };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete document'
    };
  }
}


/**
 * Intelligent document summarization for large contexts
 * Uses Gemini 2.0 Flash for cost-effective summarization
 */
export async function summarizeDocumentForContext(
  document: UploadedDocument,
  targetTokens: number = 10000
): Promise<{ success: boolean; summary?: string; error?: string }> {
  if (document.token_count <= targetTokens) {
    // No need to summarize
    return {
      success: true,
      summary: document.content
    };
  }

  try {
    // This would use Gemini 2.0 Flash to summarize
    // Implementation would go here
    const summary = document.content.slice(0, targetTokens * 4); // Temporary truncation
    
    return {
      success: true,
      summary
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Summarization failed'
    };
  }
}