'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  Upload, 
  X, 
  File, 
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { createClient } from '@/app/supabase/client';
import { uploadEbookDocument, type UploadedDocument } from '@/actions/tools/ebook-document-handler';
import { formatFileSize, formatTokenCount } from '@/utils/document-processing';
// @ts-ignore
import { useDropzone } from 'react-dropzone';

interface DocumentUploadProps {
  onDocumentsChange: (documents: UploadedDocument[]) => void;
  existingDocuments?: UploadedDocument[];
}

export function DocumentUpload({ 
  onDocumentsChange,
  existingDocuments = []
}: DocumentUploadProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<UploadedDocument[]>(existingDocuments);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!userId) {
      setError('Please log in to upload documents');
      return;
    }

    setError(null);
    setUploading(true);
    setUploadProgress(0);

    const uploadedDocs: UploadedDocument[] = [];
    const totalFiles = acceptedFiles.length;

    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
      setUploadProgress(((i + 0.5) / totalFiles) * 100);

      try {
        const result = await uploadEbookDocument(file, userId);
        
        if (result.success && result.document) {
          uploadedDocs.push(result.document);
        } else {
          setError(result.error || 'Upload failed');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      }

      setUploadProgress(((i + 1) / totalFiles) * 100);
    }

    const newDocuments = [...documents, ...uploadedDocs];
    setDocuments(newDocuments);
    onDocumentsChange(newDocuments);
    
    setUploading(false);
    setUploadProgress(0);
  }, [documents, userId, onDocumentsChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/markdown': ['.md', '.markdown']
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    disabled: uploading || !userId
  });

  const removeDocument = (docId: string) => {
    const newDocuments = documents.filter(d => d.id !== docId);
    setDocuments(newDocuments);
    onDocumentsChange(newDocuments);
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'pdf':
        return '📄';
      case 'docx':
        return '📝';
      case 'txt':
        return '📃';
      case 'markdown':
        return '📋';
      default:
        return '📎';
    }
  };


  const totalTokens = documents.reduce((sum, doc) => sum + doc.token_count, 0);

  return (
    <div className="space-y-4">
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
            transition-colors duration-200
            ${isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' : 'border-gray-300 hover:border-gray-400'}
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          <input {...getInputProps()} />
          
          {uploading ? (
            <div className="space-y-2">
              <Loader2 className="h-8 w-8 mx-auto text-blue-500 animate-spin" />
              <p className="text-sm text-muted-foreground">Uploading documents...</p>
              <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
            </div>
          ) : isDragActive ? (
            <>
              <Upload className="h-8 w-8 mx-auto text-blue-500 mb-2" />
              <p className="text-sm font-medium">Drop files here...</p>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm font-medium mb-1">
                Drag & drop files here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Supports PDF, DOCX, TXT, and Markdown files
              </p>
            </>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-md">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Uploaded documents list */}
        {documents.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium">Uploaded Documents</h4>
              <Badge variant="secondary">
                {formatTokenCount(totalTokens)} total
              </Badge>
            </div>
            
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 bg-card rounded-lg border"
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-2xl">{getFileIcon(doc.file_type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.filename}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatFileSize(doc.file_size_mb)}</span>
                      <span>•</span>
                      <span>{formatTokenCount(doc.token_count)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDocument(doc.id)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

    </div>
  );
}