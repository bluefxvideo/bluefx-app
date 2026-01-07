'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/app/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Mail, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SuspendedPage() {
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkSuspension() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_suspended, suspension_reason')
        .eq('id', user.id)
        .single();

      if (!profile?.is_suspended) {
        // User is not suspended, redirect to dashboard
        router.push('/dashboard');
        return;
      }

      setReason(profile.suspension_reason);
      setLoading(false);
    }

    checkSuspension();
  }, [supabase, router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full border-destructive/50">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl text-destructive">Account Suspended</CardTitle>
          <CardDescription>
            Your account has been suspended and you cannot access the platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {reason && (
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm font-medium text-muted-foreground mb-1">Reason:</p>
              <p className="text-sm">{reason}</p>
            </div>
          )}

          <div className="text-center text-sm text-muted-foreground">
            <p>If you believe this is a mistake or would like to appeal this decision, please contact our support team.</p>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.location.href = 'mailto:support@bluefx.net?subject=Account Suspension Appeal'}
            >
              <Mail className="w-4 h-4 mr-2" />
              Contact Support
            </Button>

            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
