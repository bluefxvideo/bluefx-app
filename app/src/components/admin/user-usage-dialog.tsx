'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  CreditCard,
  Activity,
  Zap,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';
import {
  fetchUserUsageStats,
  fetchUserUsageHistory,
  fetchUserToolList,
  TOOL_NAMES,
  type UserUsageStats,
  type CreditUsageEntry,
} from '@/actions/admin/user-usage';

interface UserUsageDialogProps {
  user: {
    id: string;
    email?: string | null;
    username?: string | null;
    full_name?: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserUsageDialog({ user, open, onOpenChange }: UserUsageDialogProps) {
  const [stats, setStats] = useState<UserUsageStats | null>(null);
  const [history, setHistory] = useState<CreditUsageEntry[]>([]);
  const [tools, setTools] = useState<{ value: string; label: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Pagination and filters
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [toolFilter, setToolFilter] = useState<string>('all');

  const loadStats = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const [statsResult, toolsResult] = await Promise.all([
        fetchUserUsageStats(user.id),
        fetchUserToolList(user.id),
      ]);

      if (statsResult.success && statsResult.stats) {
        setStats(statsResult.stats);
      }

      if (toolsResult.success && toolsResult.tools) {
        setTools(toolsResult.tools);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const loadHistory = useCallback(async () => {
    if (!user?.id) return;

    setIsLoadingHistory(true);
    try {
      const result = await fetchUserUsageHistory(user.id, {
        page,
        limit: 10,
        toolFilter: toolFilter !== 'all' ? toolFilter : undefined,
      });

      if (result.success && result.data) {
        setHistory(result.data.entries);
        setTotalPages(result.data.totalPages);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user?.id, page, toolFilter]);

  // Load data when dialog opens
  useEffect(() => {
    if (open && user?.id) {
      setPage(1);
      setToolFilter('all');
      loadStats();
    }
  }, [open, user?.id, loadStats]);

  // Load history when page or filter changes
  useEffect(() => {
    if (open && user?.id) {
      loadHistory();
    }
  }, [open, user?.id, page, toolFilter, loadHistory]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getToolName = (serviceType: string) => {
    return TOOL_NAMES[serviceType] || serviceType;
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Usage Details - {user.email || user.username || user.full_name}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-xs">Credits Used</span>
                  </div>
                  <div className="text-2xl font-bold">{stats.totalCreditsUsed}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Activity className="w-4 h-4" />
                    <span className="text-xs">Generations</span>
                  </div>
                  <div className="text-2xl font-bold">{stats.totalGenerations}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Zap className="w-4 h-4" />
                    <span className="text-xs">Most Used</span>
                  </div>
                  <div className="text-lg font-bold truncate">
                    {stats.mostUsedTool || 'N/A'}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs">Last Active</span>
                  </div>
                  <div className="text-sm font-bold">
                    {stats.lastActivity
                      ? new Date(stats.lastActivity).toLocaleDateString()
                      : 'Never'}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Usage by Tool */}
            {stats.byTool.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Usage by Tool</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 text-sm font-medium">Tool</th>
                        <th className="text-right p-3 text-sm font-medium">Credits</th>
                        <th className="text-right p-3 text-sm font-medium">Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {stats.byTool.map((tool) => (
                        <tr key={tool.tool} className="hover:bg-muted/30">
                          <td className="p-3">
                            <span className="font-medium">{tool.toolName}</span>
                          </td>
                          <td className="p-3 text-right">
                            <Badge variant="secondary">{tool.credits}</Badge>
                          </td>
                          <td className="p-3 text-right text-muted-foreground">
                            {tool.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recent Activity */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Recent Activity</h3>
                <Select value={toolFilter} onValueChange={(v) => { setToolFilter(v); setPage(1); }}>
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

              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : history.length > 0 ? (
                <div className="space-y-2">
                  {history.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30"
                    >
                      <div className="flex items-start gap-3">
                        <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(entry.created_at)}
                          </div>
                          <div className="font-medium">
                            {getToolName(entry.service_type)}
                            {entry.operation_type && (
                              <span className="text-muted-foreground ml-2">
                                • {entry.operation_type}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {entry.credits_used} credits
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
                  <p>No usage history found</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No usage data available</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
