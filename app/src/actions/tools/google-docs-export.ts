'use server';

import { createClient } from '@/app/supabase/server';

/**
 * Google Docs Export for eBook Writer
 * Uses existing Supabase Google OAuth infrastructure
 */

interface EbookContent {
  title: string;
  author?: string;
  chapters: {
    title: string;
    content: string;
  }[];
  cover?: {
    image_url: string;
  };
}

/**
 * Export ebook to Google Docs using existing OAuth
 */
export async function exportEbookToGoogleDocs(
  ebook: EbookContent,
  userId: string
): Promise<{ success: boolean; documentId?: string; documentUrl?: string; error?: string }> {
  try {
    // Check if user has Google connection (via YouTube OAuth)
    const accessToken = await getGoogleAccessToken(userId);
    if (!accessToken) {
      return {
        success: false,
        error: 'Please connect your Google account first. Go to Content Multiplier to link Google/YouTube.'
      };
    }

    // Create new Google Doc
    const documentResponse = await fetch('https://docs.googleapis.com/v1/documents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: ebook.title
      })
    });

    if (!documentResponse.ok) {
      const error = await documentResponse.json();
      throw new Error(`Failed to create Google Doc: ${error.error?.message || 'Unknown error'}`);
    }

    const document = await documentResponse.json();
    const documentId = document.documentId;

    // Build content structure for Google Docs
    const requests = buildDocumentRequests(ebook);

    // Insert content into document
    const updateResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests
      })
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      throw new Error(`Failed to update Google Doc: ${error.error?.message || 'Unknown error'}`);
    }

    const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;

    return {
      success: true,
      documentId,
      documentUrl
    };

  } catch (error) {
    console.error('Google Docs export error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed'
    };
  }
}

/**
 * Get Google access token from existing social connections
 */
async function getGoogleAccessToken(userId: string): Promise<string | null> {
  const supabase = await createClient();
  
  // Check for Google connection
  const { data } = await supabase
    .from('social_platform_connections')
    .select('access_token_encrypted, connection_status')
    .eq('user_id', userId)
    .eq('platform', 'google')
    .eq('connection_status', 'active')
    .single();

  if (!data?.access_token_encrypted) {
    return null;
  }
  
  // Decrypt token (using same method as social-oauth.ts)
  return Buffer.from(data.access_token_encrypted, 'base64').toString();
}

/**
 * Build Google Docs API requests for ebook content
 */
function buildDocumentRequests(ebook: EbookContent) {
  const requests: any[] = [];
  let insertIndex = 1; // Start after default paragraph

  // COVER PAGE - Insert cover image if available
  if (ebook.cover?.image_url) {
    // Insert the cover image
    requests.push({
      insertInlineImage: {
        location: { index: insertIndex },
        uri: ebook.cover.image_url,
        objectSize: {
          height: {
            magnitude: 400,
            unit: 'PT'
          },
          width: {
            magnitude: 267,
            unit: 'PT'
          }
        }
      }
    });
    insertIndex += 1; // Image takes 1 character

    // Add page break after cover
    requests.push({
      insertText: {
        location: { index: insertIndex },
        text: '\n'
      }
    });
    insertIndex += 1;

    requests.push({
      insertPageBreak: {
        location: { index: insertIndex }
      }
    });
    insertIndex += 1;
  }

  // TITLE PAGE
  // Center align the title page
  requests.push({
    insertText: {
      location: { index: insertIndex },
      text: '\n\n\n\n\n' // Add some vertical spacing
    }
  });
  insertIndex += 5;

  // Title
  requests.push({
    insertText: {
      location: { index: insertIndex },
      text: ebook.title + '\n\n'
    }
  });
  const titleStart = insertIndex;
  const titleLength = ebook.title.length;
  insertIndex += ebook.title.length + 2;

  // Style title
  requests.push({
    updateParagraphStyle: {
      range: {
        startIndex: titleStart,
        endIndex: titleStart + titleLength + 1
      },
      paragraphStyle: {
        alignment: 'CENTER'
      },
      fields: 'alignment'
    }
  });

  requests.push({
    updateTextStyle: {
      range: {
        startIndex: titleStart,
        endIndex: titleStart + titleLength
      },
      textStyle: {
        fontSize: { magnitude: 36, unit: 'PT' },
        bold: true,
        weightedFontFamily: { fontFamily: 'Georgia' }
      },
      fields: 'fontSize,bold,weightedFontFamily'
    }
  });

  // Author (if provided)
  if (ebook.author) {
    requests.push({
      insertText: {
        location: { index: insertIndex },
        text: `by ${ebook.author}\n\n`
      }
    });
    const authorStart = insertIndex;
    const authorLength = `by ${ebook.author}`.length;
    insertIndex += `by ${ebook.author}\n\n`.length;

    // Style and center author
    requests.push({
      updateParagraphStyle: {
        range: {
          startIndex: authorStart,
          endIndex: authorStart + authorLength + 1
        },
        paragraphStyle: {
          alignment: 'CENTER'
        },
        fields: 'alignment'
      }
    });

    requests.push({
      updateTextStyle: {
        range: {
          startIndex: authorStart,
          endIndex: authorStart + authorLength
        },
        textStyle: {
          fontSize: { magnitude: 18, unit: 'PT' },
          italic: true
        },
        fields: 'fontSize,italic'
      }
    });
  }

  // Add page break after title page
  requests.push({
    insertPageBreak: {
      location: { index: insertIndex }
    }
  });
  insertIndex += 1;

  // Table of Contents
  requests.push({
    insertText: {
      location: { index: insertIndex },
      text: 'Table of Contents\n\n'
    }
  });
  
  const tocStart = insertIndex;
  insertIndex += 'Table of Contents\n\n'.length;

  // TOC entries
  ebook.chapters.forEach((chapter, index) => {
    const tocEntry = `${index + 1}. ${chapter.title}\n`;
    requests.push({
      insertText: {
        location: { index: insertIndex },
        text: tocEntry
      }
    });
    insertIndex += tocEntry.length;
  });

  // Style TOC
  requests.push({
    updateTextStyle: {
      range: {
        startIndex: tocStart,
        endIndex: tocStart + 'Table of Contents'.length
      },
      textStyle: {
        fontSize: { magnitude: 18, unit: 'PT' },
        bold: true
      },
      fields: 'fontSize,bold'
    }
  });

  // Add page break
  requests.push({
    insertText: {
      location: { index: insertIndex },
      text: '\n'
    }
  });
  insertIndex += 1;

  requests.push({
    insertPageBreak: {
      location: { index: insertIndex }
    }
  });
  insertIndex += 1;

  // Chapters
  ebook.chapters.forEach((chapter, chapterIndex) => {
    // Add page break before each chapter (except the first one, TOC already has page break)
    if (chapterIndex > 0) {
      requests.push({
        insertPageBreak: {
          location: { index: insertIndex }
        }
      });
      insertIndex += 1;
    }

    // Chapter title
    requests.push({
      insertText: {
        location: { index: insertIndex },
        text: `Chapter ${chapterIndex + 1}: ${chapter.title}\n\n`
      }
    });
    
    const chapterTitleStart = insertIndex;
    const chapterTitleLength = `Chapter ${chapterIndex + 1}: ${chapter.title}`.length;
    insertIndex += `Chapter ${chapterIndex + 1}: ${chapter.title}\n\n`.length;

    // Style chapter title
    requests.push({
      updateTextStyle: {
        range: {
          startIndex: chapterTitleStart,
          endIndex: chapterTitleStart + chapterTitleLength
        },
        textStyle: {
          fontSize: { magnitude: 20, unit: 'PT' },
          bold: true,
          weightedFontFamily: { fontFamily: 'Georgia' }
        },
        fields: 'fontSize,bold,weightedFontFamily'
      }
    });

    // Chapter content
    const cleanContent = chapter.content.replace(/\n\s*\n/g, '\n\n'); // Clean up spacing
    requests.push({
      insertText: {
        location: { index: insertIndex },
        text: cleanContent + '\n\n'
      }
    });
    insertIndex += cleanContent.length + 2;

    // Style chapter content with better readability
    requests.push({
      updateTextStyle: {
        range: {
          startIndex: chapterTitleStart + chapterTitleLength + 2,
          endIndex: insertIndex - 2
        },
        textStyle: {
          fontSize: { magnitude: 12, unit: 'PT' },
          weightedFontFamily: { fontFamily: 'Arial' }
        },
        fields: 'fontSize,weightedFontFamily'
      }
    });

    requests.push({
      updateParagraphStyle: {
        range: {
          startIndex: chapterTitleStart + chapterTitleLength + 2,
          endIndex: insertIndex - 2
        },
        paragraphStyle: {
          lineSpacing: 150, // 1.5 line spacing
          spaceAbove: { magnitude: 6, unit: 'PT' },
          spaceBelow: { magnitude: 6, unit: 'PT' }
        },
        fields: 'lineSpacing,spaceAbove,spaceBelow'
      }
    });
  });

  return requests;
}

/**
 * Check if user has Google connection for docs export
 */
export async function checkGoogleConnection(userId: string): Promise<{
  hasConnection: boolean;
  connectionUrl?: string;
  error?: string;
}> {
  try {
    const accessToken = await getGoogleAccessToken(userId);
    
    if (!accessToken) {
      return {
        hasConnection: false,
        connectionUrl: '/dashboard/ebook-writer/export'
      };
    }

    // Test the token by making a simple API call
    const testResponse = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!testResponse.ok) {
      return {
        hasConnection: false,
        connectionUrl: '/dashboard/content-multiplier/platforms',
        error: 'Google connection expired. Please reconnect.'
      };
    }

    return {
      hasConnection: true
    };

  } catch (error) {
    return {
      hasConnection: false,
      connectionUrl: '/dashboard/content-multiplier/platforms',
      error: error instanceof Error ? error.message : 'Connection check failed'
    };
  }
}


/**
 * Create shareable link for the Google Doc
 */
export async function shareGoogleDoc(
  documentId: string,
  userId: string,
  shareType: 'anyone' | 'domain' | 'private' = 'anyone'
): Promise<{ success: boolean; shareUrl?: string; error?: string }> {
  try {
    const accessToken = await getGoogleAccessToken(userId);
    if (!accessToken) {
      throw new Error('No Google access token available');
    }

    // Set sharing permissions
    const shareResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${documentId}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: shareType === 'anyone' ? 'anyone' : 'user'
      })
    });

    if (!shareResponse.ok) {
      const error = await shareResponse.json();
      throw new Error(`Failed to share document: ${error.error?.message || 'Unknown error'}`);
    }

    const shareUrl = `https://docs.google.com/document/d/${documentId}/edit`;

    return {
      success: true,
      shareUrl
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sharing failed'
    };
  }
}