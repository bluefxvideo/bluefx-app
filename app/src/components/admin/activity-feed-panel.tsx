'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Activity,
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  TrendingUp,
  CreditCard,
} from 'lucide-react';

interface ActivityEntry {
  id: string;
  user_id: string;
  user_name: string;
  user_email?: string;
  tool_name: string;
  tool_display_name: string;
  credits: number;
  created_at: string;
}

interface DailySummary {
  date: string;
  total_activities: number;
  total_credits: number;
  unique_users: number;
  by_tool: { tool: string; toolName: string; count: number }[];
}

interface ActivityFeedResponse {
  success: boolean;
  summary: DailySummary;
  activities: ActivityEntry[];
  tools: { value: string; label: string }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

export function ActivityFeedPanel() {
  const [data, setData] = useState<ActivityFeedResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and pagination
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [toolFilter, setToolFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        date: selectedDate,
        page: page.toString(),
        limit: '30',
      });

      if (toolFilter && toolFilter !== 'all') {
        params.set('tool', toolFilter);
      }

      const response = await fetch(`/api/admin/activity-feed?${params}`);
      const result = await response.json();

      if (response.ok && result.success) {
        setData(result);
      } else {
        setError(result.error || 'Failed to load activity feed');
        setData(null);
      }
    } catch (err) {
      console.error('Failed to load activity feed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load activity feed');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, toolFilter, page]);

  // Initial load and reload on filter changes
  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    loadData();
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
        <CardContent className="flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading && !data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const summary = data?.summary;
  const activities = data?.activities || [];
  const tools = data?.tools || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-6">
      {/* Header with Date Picker and Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Activity Feed
          </h2>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setPage(1);
            }}
            className="w-40"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Daily Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs">Total Activity</span>
              </div>
              <div className="text-2xl font-bold">{summary.total_activities}</div>
              <p className="text-xs text-muted-foreground">generations today</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <CreditCard className="w-4 h-4" />
                <span className="text-xs">Credits Used</span>
              </div>
              <div className="text-2xl font-bold">{summary.total_credits.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">credits today</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users className="w-4 h-4" />
                <span className="text-xs">Active Users</span>
              </div>
              <div className="text-2xl font-bold">{summary.unique_users}</div>
              <p className="text-xs text-muted-foreground">unique users today</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-xs">Date</span>
              </div>
              <div className="text-lg font-bold">
                {new Date(summary.date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tool Breakdown */}
      {summary && summary.by_tool.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Tool Usage Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {summary.by_tool.map((tool) => (
                <Badge
                  key={tool.tool}
                  variant="secondary"
                  className="flex items-center gap-1.5 py-1 px-2"
                >
                  <span>{tool.toolName}</span>
                  <span className="bg-background/50 px-1.5 py-0.5 rounded text-xs font-bold">
                    {tool.count}
                  </span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Feed */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Activity Timeline</CardTitle>
            <Select
              value={toolFilter}
              onValueChange={(v) => {
                setToolFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Tools" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tools</SelectItem>
                {tools.map((tool) => (
                  <SelectItem key={tool.value} value={tool.value}>
                    {tool.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : activities.length > 0 ? (
            <div className="space-y-2">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-mono text-muted-foreground w-16">
                      {formatTime(activity.created_at)}
                    </div>
                    <div>
                      <div className="font-medium text-sm">
                        {activity.user_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        used{' '}
                        <span className="text-foreground font-medium">
                          {activity.tool_display_name}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {activity.credits} credits
                  </Badge>
                </div>
              ))}

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                    disabled={page === pagination.totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No activity recorded for this date</p>
              <p className="text-xs mt-1">
                Activity will appear here when users generate content
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
