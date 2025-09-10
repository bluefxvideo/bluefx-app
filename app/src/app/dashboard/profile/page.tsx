'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, User, Mail, Calendar, Shield } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ProfileFormSkeleton } from '@/components/dashboard/dashboard-skeletons';

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
  });

  // Fetch user profile with better caching
  const { data: userProfile, isLoading, refetch } = useQuery({
    queryKey: ['user-profile-details'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      return { ...user, profile };
    }
  });

  useEffect(() => {
    if (userProfile) {
      setFormData({
        fullName: userProfile.user_metadata?.full_name || '',
        email: userProfile.email || '',
      });
      setIsAdmin(userProfile.profile?.role === 'admin');
    }
  }, [userProfile]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: formData.fullName }
      });

      if (error) throw error;

      setIsEditing(false);
      refetch();
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };


  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Profile Settings</h1>
        <p className="text-muted-foreground">Manage your account information</p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-8 border-b mb-6">
        <button 
          className="pb-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => router.push('/dashboard')}
        >
          Dashboard
        </button>
        <button 
          className="pb-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => router.push('/dashboard/usage')}
        >
          Usage
        </button>
        <button 
          className="pb-3 text-sm font-medium text-foreground border-b-2 border-primary"
          onClick={() => router.push('/dashboard/profile')}
        >
          Profile
        </button>
        <button 
          className="pb-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => router.push('/dashboard/subscription')}
        >
          Subscription
        </button>
        {isAdmin && (
          <button 
            className="pb-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => router.push('/dashboard/admin')}
          >
            Admin
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Profile Card */}
        {isLoading ? (
          <ProfileFormSkeleton />
        ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Update your personal details</CardDescription>
              </div>
              {!isEditing && (
                <Button 
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Profile
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="fullName">Full Name</Label>
                {isEditing ? (
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="bg-secondary"
                  />
                ) : (
                  <div className="flex items-center gap-2 p-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{formData.fullName || 'Not set'}</span>
                  </div>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="flex items-center gap-2 p-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{formData.email}</span>
                  <span className="text-xs text-muted-foreground">(Cannot be changed)</span>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Account Created</Label>
                <div className="flex items-center gap-2 p-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDate(userProfile?.created_at)}</span>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Account Type</Label>
                <div className="flex items-center gap-2 p-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {userProfile?.profile?.role === 'admin' ? 'Administrator' : 'Standard User'}
                  </span>
                </div>
              </div>
            </div>

            {isEditing && (
              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className=""
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      fullName: userProfile?.user_metadata?.full_name || '',
                      email: userProfile?.email || '',
                    });
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Security Settings */}
        {!isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Security Settings</CardTitle>
            <CardDescription>Manage your password and authentication</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline"
              onClick={() => router.push('/auth/reset-password')}
            >
              Change Password
            </Button>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}