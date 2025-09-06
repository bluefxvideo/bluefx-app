'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  AlertCircle,
  ExternalLink,
  Loader2,
  CheckCircle,
  LinkIcon,
  Users
} from 'lucide-react';
import { exportEbookToGoogleDocs, checkGoogleConnection } from '@/actions/tools/google-docs-export';
import { initiateGoogleOAuth, checkGoogleOAuthConfig } from '@/actions/auth/google-oauth-ebook';
import { createClient } from '@/app/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';

interface GoogleDocsConnectionProps {
  ebook: {
    title: string;
    author?: string;
    chapters: {
      title: string;
      content: string;
    }[];
    cover?: {
      image_url: string;
    };
  } | null;
}

export function GoogleDocsConnection({ ebook }: GoogleDocsConnectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isChecking, setIsChecking] = useState(true);
  const [hasConnection, setHasConnection] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<{ documentUrl: string; documentId: string } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

  // Handle OAuth callback parameters
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    
    if (connected === 'true') {
      setHasConnection(true);
      setConnectionError(null);
      // Clear URL parameters
      router.replace('/dashboard/ebook-writer/export');
    } else if (error) {
      const errorMessages = {
        oauth_failed: 'Google OAuth authorization failed',
        no_code: 'Authorization code not received',
        token_failed: 'Failed to exchange authorization code',
        user_info_failed: 'Failed to get user information',
        not_authenticated: 'Please log in to connect Google account',
        storage_failed: 'Failed to store connection',
        unexpected: 'An unexpected error occurred'
      };
      setConnectionError(errorMessages[error as keyof typeof errorMessages] || 'Connection failed');
      setIsConnecting(false);
      // Clear URL parameters
      router.replace('/dashboard/ebook-writer/export');
    }
  }, [searchParams, router]);

  const checkConnection = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setConnectionError('Please log in to export to Google Docs');
        return;
      }

      const result = await checkGoogleConnection(user.id);
      setHasConnection(result.hasConnection);
      setConnectionError(result.error || null);
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Connection check failed');
    } finally {
      setIsChecking(false);
    }
  };

  const handleExport = async () => {
    if (!ebook) return;

    setIsExporting(true);
    setExportError(null);
    setExportSuccess(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Please log in to export to Google Docs');
      }

      const result = await exportEbookToGoogleDocs(ebook, user.id);
      
      if (result.success && result.documentUrl && result.documentId) {
        setExportSuccess({ 
          documentUrl: result.documentUrl, 
          documentId: result.documentId 
        });
      } else {
        throw new Error(result.error || 'Export failed');
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    setConnectionError(null);

    try {
      // Check if OAuth is configured
      const config = await checkGoogleOAuthConfig();
      if (!config.isConfigured) {
        throw new Error(`Google OAuth not configured. Missing: ${config.missingVars?.join(', ')}`);
      }

      // Initiate OAuth flow
      const result = await initiateGoogleOAuth();
      if (!result.success || !result.authUrl) {
        throw new Error(result.error || 'Failed to initiate Google connection');
      }

      // Redirect to Google OAuth
      window.location.href = result.authUrl;
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Failed to connect to Google');
      setIsConnecting(false);
    }
  };

  if (isChecking) {
    return (
      <Card className="bg-secondary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Google Docs Export
          </CardTitle>
          <CardDescription>
            Export your ebook directly to Google Docs for collaborative editing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-4">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Checking Google connection...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasConnection) {
    return (
      <Card className="bg-secondary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Google Docs Export
          </CardTitle>
          <CardDescription>
            Export your ebook directly to Google Docs for collaborative editing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <Badge variant="secondary" className="mb-3">
              <LinkIcon className="w-4 h-4 mr-1" />
              Connection Required
            </Badge>
            <p className="text-sm text-muted-foreground mb-3">
              {connectionError || 'Connect your Google account to export ebooks to Google Docs.'}
            </p>
            <Button 
              onClick={handleConnectGoogle} 
              variant="outline" 
              className="w-full"
              disabled={isConnecting}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Users className="w-4 h-4 mr-2" />
                  Connect Google Account
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (exportSuccess) {
    return (
      <Card className="bg-secondary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Google Docs Export
          </CardTitle>
          <CardDescription>
            Export your ebook directly to Google Docs for collaborative editing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <Badge variant="secondary" className="mb-3 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              <CheckCircle className="w-4 h-4 mr-1" />
              Export Successful
            </Badge>
            <p className="text-sm text-green-700 dark:text-green-300 mb-3">
              Your ebook has been successfully exported to Google Docs!
            </p>
            <Button 
              onClick={() => window.open(exportSuccess.documentUrl, '_blank')}
              className="w-full"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in Google Docs
            </Button>
          </div>
          <Button 
            onClick={() => setExportSuccess(null)} 
            variant="outline" 
            className="w-full"
          >
            Export Another Copy
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-secondary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Google Docs Export
        </CardTitle>
        <CardDescription>
          Export your ebook directly to Google Docs for collaborative editing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 ">
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
            This will create a new Google Doc with your complete ebook, including:
          </p>
          <ul className="text-sm text-blue-600 dark:text-blue-400 space-y-1 ml-4">
            <li>• Cover page with image (if available)</li>
            <li>• Title page with author</li>
            <li>• Table of contents</li>
            <li>• All chapters with proper formatting</li>
          </ul>
        </div>
        
        {exportError && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              {exportError}
            </p>
          </div>
        )}

        <Button 
          onClick={handleExport}
          disabled={isExporting || !ebook}
          className="w-full"
          size="lg"
        >
          {isExporting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Google Doc...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Export to Google Docs
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}