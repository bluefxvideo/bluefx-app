'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton for the tools grid
 */
export function ToolsGridSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mt-2" />
          </div>
          <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-full" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex flex-col items-center justify-center p-3">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
              <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mt-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton for credit balance card
 */
export function CreditBalanceSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mt-2" />
          </div>
          <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-full" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mt-2" />
          </div>
          <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
          <div className="flex items-center gap-3 mt-4">
            <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
            <div className="h-10 w-28 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton for tutorial cards
 */
export function TutorialsSkeleton() {
  return (
    <div className="col-span-full">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="aspect-video bg-gray-200 dark:bg-gray-700 animate-pulse rounded-sm" />
              <div className="mt-4 space-y-2">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 animate-pulse rounded w-3/4" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 animate-pulse rounded w-full" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 animate-pulse rounded w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for profile form
 */
export function ProfileFormSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
            <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mt-2" />
          </div>
          <div className="h-10 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="grid gap-2">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
              <div className="flex items-center gap-2 p-2">
                <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton for current subscription card
 */
export function CurrentSubscriptionSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mr-2" />
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
          </div>
          <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-full" />
        </div>
        <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mt-2" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i}>
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mb-1" />
              <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton for current credits card
 */
export function CurrentCreditsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center">
          <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mr-2" />
          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
        </div>
        <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mt-2" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i}>
              <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mb-1" />
              <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
            </div>
          ))}
        </div>
        
        {/* Usage Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between mb-2">
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
            <div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div className="bg-gray-300 dark:bg-gray-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton for usage analytics dashboard
 */
export function UsageDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mb-2" />
                  <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                </div>
                <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage Trends Chart */}
        <Card>
          <CardHeader>
            <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
            <div className="h-4 w-56 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mt-2" />
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
          </CardContent>
        </Card>

        {/* Tool Usage Pie Chart */}
        <Card>
          <CardHeader>
            <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mt-2" />
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>

      {/* Tool Usage Details */}
      <Card>
        <CardHeader>
          <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
                  <div>
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mb-2" />
                    <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                  </div>
                </div>
                <div className="text-right">
                  <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mb-2" />
                  <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Skeleton for chart areas
 */
export function ChartSkeleton() {
  return (
    <div className="h-64 bg-gray-200 dark:bg-gray-700 animate-pulse rounded" />
  );
}