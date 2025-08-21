'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Link as LinkIcon
} from 'lucide-react';
import { createClient } from '@/app/supabase/client';
import { initiateOAuthFlow, validatePlatformTokens } from '@/actions/auth/social-oauth';
import { exportEbookToGoogleDocs, checkGoogleConnection } from '@/actions/tools/google-docs-export';

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
  const [userId, setUserId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{
    hasConnection: boolean;
    connectionUrl?: string;
    error?: string;
  } | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    documentUrl?: string;
    error?: string;
  } | null>(null);

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

  // Check connection status when user is available
  useEffect(() => {
    if (userId) {
      checkConnection();
    }
  }, [userId]);

  const checkConnection = async () => {
    if (!userId) return;
    
    try {
      const result = await checkGoogleConnection(userId);
      setConnectionStatus(result);
    } catch (error) {
      setConnectionStatus({
        hasConnection: false,
        error: 'Failed to check Google connection'
      });
    }
  };

  const handleConnect = async () => {
    if (!userId) {
      setConnectionStatus({
        hasConnection: false,
        error: 'Please log in to connect Google account'
      });
      return;
    }

    setIsConnecting(true);
    setExportResult(null);
    
    try {
      const result = await initiateOAuthFlow('google_docs', userId);
      
      if (result.success && result.authUrl) {
        // Open OAuth flow in new window
        window.open(result.authUrl, 'google_oauth', 'width=500,height=600');
        
        // Listen for OAuth completion
        const checkInterval = setInterval(async () => {
          const connectionCheck = await checkGoogleConnection(userId);
          if (connectionCheck.hasConnection) {
            setConnectionStatus(connectionCheck);
            clearInterval(checkInterval);
            setIsConnecting(false);
          }
        }, 2000);
        
        // Stop checking after 5 minutes
        setTimeout(() => {
          clearInterval(checkInterval);
          setIsConnecting(false);
        }, 300000);
        
      } else {
        throw new Error(result.error || 'Failed to start OAuth flow');
      }
    } catch (error) {
      console.error('Google connection error:', error);
      setConnectionStatus({
        hasConnection: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      });
      setIsConnecting(false);
    }
  };

  const handleExport = async () => {
    if (!ebook || !userId) return;
    
    setIsExporting(true);
    setExportResult(null);
    
    try {
      const result = await exportEbookToGoogleDocs(ebook, userId);
      setExportResult(result);
      
      if (result.success && result.documentUrl) {
        // Optionally open the Google Doc
        // window.open(result.documentUrl, '_blank');
      }
    } catch (error) {
      setExportResult({
        success: false,
        error: error instanceof Error ? error.message : 'Export failed'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getConnectionStatusBadge = () => {
    if (!userId) {
      return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Checking auth...</Badge>;
    } else if (connectionStatus?.hasConnection) {
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Connected</Badge>;
    } else if (connectionStatus?.error) {
      return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
    } else {
      return <Badge variant="secondary"><LinkIcon className="w-3 h-3 mr-1" />Not Connected</Badge>;
    }
  };

  return (
    <Card className="bg-gray-50 dark:bg-gray-800/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-500" />
          Google Docs Export
          {getConnectionStatusBadge()}
        </CardTitle>
        <CardDescription>
          Export your ebook as a formatted Google Doc with chapters, table of contents, and professional styling.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Connection Status */}
        {!connectionStatus?.hasConnection && (
          <div className="space-y-3">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-400">
                <strong>🔗 Connect Google Account:</strong> We'll use your Google account to create and save the document to your Google Drive.
              </p>
            </div>
            
            {connectionStatus?.error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  {connectionStatus.error}
                </p>
              </div>
            )}
            
            <Button 
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full"
              variant="outline"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting to Google...
                </>
              ) : (
                <>
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Connect Google Account
                </>
              )}
            </Button>
          </div>
        )}

        {/* Export Section */}
        {connectionStatus?.hasConnection && (
          <div className="space-y-3">
            <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <p className="text-sm text-green-600 dark:text-green-400">
                <CheckCircle className="w-4 h-4 inline mr-1" />
                Google account connected! Ready to export your ebook.
              </p>
            </div>
            
            {ebook ? (
              <div className="space-y-3">
                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">📖 Ready to Export:</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><strong>Title:</strong> {ebook.title}</p>
                    <p><strong>Chapters:</strong> {ebook.chapters.length}</p>
                    <p><strong>Format:</strong> Google Docs with TOC, styling, and chapters</p>
                  </div>
                </div>
                
                <Button 
                  onClick={handleExport}
                  disabled={isExporting}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Google Doc...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      Export to Google Docs
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  Complete your ebook generation first to enable export.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Export Result */}
        {exportResult && (
          <div className="space-y-3">
            {exportResult.success ? (
              <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-400 mb-2">
                  <CheckCircle className="w-4 h-4 inline mr-1" />
                  <strong>Export Successful!</strong> Your ebook has been created in Google Docs.
                </p>
                {exportResult.documentUrl && (
                  <Button 
                    onClick={() => window.open(exportResult.documentUrl, '_blank')}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in Google Docs
                  </Button>
                )}
              </div>
            ) : (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  <strong>Export Failed:</strong> {exportResult.error}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Features List */}
        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-2">✨ Google Docs Export includes:</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Professional title and author formatting</li>
            <li>• Automatic table of contents</li>
            <li>• Chapter divisions with proper styling</li>
            <li>• Shareable Google Drive integration</li>
            <li>• Collaborative editing capabilities</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}