'use client';

import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';

interface AdminPageWrapperProps {
  children: ReactNode;
  isAdmin: boolean;
}

export function AdminPageWrapper({ children, isAdmin }: AdminPageWrapperProps) {
  const router = useRouter();
  
  if (!isAdmin) {
    router.push('/dashboard');
    return null;
  }
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
        <p className="text-muted-foreground">Manage users and system settings</p>
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
          className="pb-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
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
        <button 
          className="pb-3 text-sm font-medium text-foreground border-b-2 border-primary"
          onClick={() => router.push('/dashboard/admin')}
        >
          Admin
        </button>
      </div>
      
      {children}
    </div>
  );
}