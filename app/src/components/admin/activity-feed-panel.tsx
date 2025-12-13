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
} from 'lucide-react';
import {
  fetchActivityFeed,
  fetchDailyActivitySummary,
  fetchActivityToolList,
  TOOL_DISPLAY_NAMES,
  type ActivityLogEntry,
  type DailyActivitySummary,
} from '@/actions/activity-log';

export function ActivityFeedPanel() {
  const [summary, setSummary] = useState<DailyActivitySummary | null>(null);
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [tools, setTools] = useState<{ value: string; label: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);

  // Filters and pagination
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [toolFilter, setToolFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadSummary = useCallback(async () => {
    const result = await fetchDailyActivitySummary(selectedDate);
    if (result.success && result.data) {
      setSummary(result.data);
    }
  }, [selectedDate]);

  const loadFeed = useCallback(async () => {
    setIsLoadingFeed(true);
    try {
      const result = await fetchActivityFeed({
        page,
        limit: 30,
        toolFilter: toolFilter !== 'all' ? toolFilter : undefined,
        dateFilter: selectedDate,
      });

      if (result.success && result.data) {
        setActivities(result.data.entries);
        setTotalPages(result.data.totalPages);
      }
    } catch (error) {
      console.error('Failed to load feed:', error);
    } finally {
      setIsLoadingFeed(false);
    }
  }, [page, toolFilter, selectedDate]);

  const loadTools = useCallback(async () => {
    const result = await fetchActivityToolList();
    if (result.success && result.tools) {
      setTools(result.tools);
    }
  }, []);

  // Initial load
  useEffect(() => {
    async function init() {
      setIsLoading(true);
      await Promise.all([loadSummary(), loadFeed(), loadTools()]);
      setIsLoading(false);
    }
    init();
  }, []);

  // Reload when date changes
  useEffect(() => {
    setPage(1);
    loadSummary();
    loadFeed();
  }, [selectedDate, loadSummary, loadFeed]);

  // Reload feed when filter or page changes
  useEffect(() => {
    loadFeed();
  }, [page, toolFilter, loadFeed]);

  const handleRefresh = async () => {
    setIsLoading(true);
    await Promise.all([loadSummary(), loadFeed()]);
    setIsLoading(false);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getToolDisplayName = (toolName: string) => {
    return TOOL_DISPLAY_NAMES[toolName] || toolName;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

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
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-40"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Daily Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs">Total Activity</span>
              </div>
              <div className="text-2xl font-bold">{summary.total_activities}</div>
              <p className="text-xs text-muted-foreground">tool visits today</p>
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
          {isLoadingFeed ? (
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
                        {activity.user_name || 'Unknown User'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        visited{' '}
                        <span className="text-foreground font-medium">
                          {getToolDisplayName(activity.tool_name)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {activity.action}
                  </Badge>
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
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
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
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
                Activity will appear here once users visit tools
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
