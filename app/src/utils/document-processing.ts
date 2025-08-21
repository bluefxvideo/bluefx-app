import type { UploadedDocument } from '@/actions/tools/ebook-document-handler';

/**
 * Process documents for AI context (chunking if needed)
 */
export function processDocumentsForContext(
  documents: UploadedDocument[],
  maxTokens = 100000
): { processedText: string; totalTokens: number; truncated: boolean } {
  let combinedText = '';
  let totalTokens = 0;
  let truncated = false;

  for (const doc of documents) {
    if (totalTokens + doc.token_count > maxTokens) {
      // Truncate if we exceed max tokens
      const remainingTokens = maxTokens - totalTokens;
      const remainingChars = remainingTokens * 4; // Rough estimate
      combinedText += `\n\n--- Document: ${doc.filename} (truncated) ---\n`;
      combinedText += doc.content.slice(0, remainingChars);
      totalTokens = maxTokens;
      truncated = true;
      break;
    } else {
      combinedText += `\n\n--- Document: ${doc.filename} ---\n`;
      combinedText += doc.content;
      totalTokens += doc.token_count;
    }
  }

  return {
    processedText: combinedText,
    totalTokens,
    truncated
  };
}

/**
 * Get file type from filename
 */
export function getFileType(filename: string): string | null {
  const extension = filename.toLowerCase().split('.').pop();
  
  switch (extension) {
    case 'pdf':
      return 'pdf';
    case 'docx':
    case 'doc':
      return 'docx';
    case 'txt':
      return 'txt';
    case 'md':
    case 'markdown':
      return 'markdown';
    default:
      return null;
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(mb: number): string {
  if (mb < 1) {
    return `${Math.round(mb * 1024)}KB`;
  }
  return `${mb.toFixed(1)}MB`;
}

/**
 * Format token count for display
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) {
    return `${tokens} tokens`;
  } else if (tokens < 1000000) {
    return `${(tokens / 1000).toFixed(1)}K tokens`;
  }
  return `${(tokens / 1000000).toFixed(2)}M tokens`;
}

/**
 * Get required Google OAuth scopes for Docs export
 */
export function getRequiredGoogleScopes(): string[] {
  return [
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];
}