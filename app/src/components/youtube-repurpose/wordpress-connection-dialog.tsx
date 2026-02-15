'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Check, AlertCircle, Trash2 } from 'lucide-react';
import { useYouTubeRepurposeStore } from './store/youtube-repurpose-store';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WordPressConnectionDialog({ open, onOpenChange }: Props) {
  const [siteUrl, setSiteUrl] = useState('');
  const [username, setUsername] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const wordpressConnected = useYouTubeRepurposeStore((s) => s.wordpressConnected);
  const wordpressSiteUrl = useYouTubeRepurposeStore((s) => s.wordpressSiteUrl);
  const setWordPressConnection = useYouTubeRepurposeStore((s) => s.setWordPressConnection);

  const handleTest = async () => {
    if (!siteUrl || !username || !appPassword) {
      setTestResult({ success: false, message: 'Please fill in all fields' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const { testWordPressConnection } = await import('@/actions/auth/wordpress-connection');
      const result = await testWordPressConnection(siteUrl, username, appPassword);

      if (result.success) {
        setTestResult({ success: true, message: `Connected to ${result.siteName || siteUrl}` });
      } else {
        setTestResult({ success: false, message: result.error || 'Connection failed' });
      }
    } catch {
      setTestResult({ success: false, message: 'Connection test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const { saveWordPressConnection } = await import('@/actions/auth/wordpress-connection');
      const result = await saveWordPressConnection(siteUrl, username, appPassword);

      if (result.success) {
        setWordPressConnection(true, siteUrl.replace(/\/+$/, ''));
        onOpenChange(false);
        // Reset form
        setSiteUrl('');
        setUsername('');
        setAppPassword('');
        setTestResult(null);
      } else {
        setTestResult({ success: false, message: result.error || 'Failed to save' });
      }
    } catch {
      setTestResult({ success: false, message: 'Failed to save connection' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDeleting(true);

    try {
      const { deleteWordPressConnection } = await import('@/actions/auth/wordpress-connection');
      await deleteWordPressConnection();
      setWordPressConnection(false, null);
      onOpenChange(false);
    } catch {
      // ignore
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>WordPress Connection</DialogTitle>
        <DialogDescription>
          Connect your WordPress site to automatically publish blog posts.
          You&apos;ll need an Application Password from WordPress.
        </DialogDescription>

        <div className="space-y-4 pt-2">
          {/* Current connection status */}
          {wordpressConnected && wordpressSiteUrl && (
            <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
              <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                <Check className="h-4 w-4" />
                Connected to {wordpressSiteUrl}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                disabled={isDeleting}
                className="text-red-500 hover:text-red-700"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          )}

          {/* Form */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="wp-site-url">WordPress Site URL</Label>
              <Input
                id="wp-site-url"
                placeholder="https://yoursite.com"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="wp-username">Username</Label>
              <Input
                id="wp-username"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="wp-app-password">Application Password</Label>
              <Input
                id="wp-app-password"
                type="password"
                placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Go to WordPress Admin &rarr; Users &rarr; Profile &rarr; Application Passwords
              </p>
            </div>
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
              testResult.success
                ? 'border border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300'
                : 'border border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300'
            }`}>
              {testResult.success ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              {testResult.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={isTesting || !siteUrl || !username || !appPassword}
              className="flex-1"
            >
              {isTesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !testResult?.success}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Connection'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
