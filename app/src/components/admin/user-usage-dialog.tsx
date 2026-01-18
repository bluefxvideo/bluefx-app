'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  CreditCard,
  Activity,
  Zap,
  Calendar,
  Clock,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// User details response from API (same structure as platform-usage-panel.tsx)
interface UserDetailsResponse {
  success: boolean;
  user: {
    id: string;
    username: string | null;
    fullName: string | null;
    email: string | null;
    role: string | null;
    createdAt: string | null;
  };
  credits: {
    available: number;
    total: number;
    used: number;
  };
  subscription: {
    plan: string;
    status: string;
    periodStart: string | null;
    periodEnd: string | null;
  } | null;
  toolBreakdown: {
    toolId: string;
    toolName: string;
    credits: number;
    uses: number;
  }[];
  dailyUsage: {
    date: string;
    credits: number;
  }[];
  recentActivity: {
    date: string;
    tool: string;
    credits: number;
  }[];
}

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
  const [userDetails, setUserDetails] = useState<UserDetailsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadUserDetails = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/user-details?userId=${user.id}`);
      const result = await response.json();

      if (response.ok && result.success) {
        setUserDetails(result);
      } else {
        console.error('Failed to load user details:', result.error);
        setUserDetails(null);
      }
    } catch (error) {
      console.error('Failed to load user details:', error);
      setUserDetails(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Load data when dialog opens
  useEffect(() => {
    if (open && user?.id) {
      loadUserDetails();
    }
  }, [open, user?.id, loadUserDetails]);

  if (!user) return null;

  // Calculate summary stats from userDetails
  const totalCreditsUsed = userDetails?.toolBreakdown.reduce((sum, t) => sum + t.credits, 0) || 0;
  const totalGenerations = userDetails?.toolBreakdown.reduce((sum, t) => sum + t.uses, 0) || 0;
  const mostUsedTool = userDetails?.toolBreakdown[0]?.toolName || null;
  const lastActivity = userDetails?.recentActivity[0]?.date || null;

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
        ) : userDetails ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-xs">Credits Used</span>
                  </div>
                  <div className="text-2xl font-bold">{totalCreditsUsed.toLocaleString()}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Activity className="w-4 h-4" />
                    <span className="text-xs">Generations</span>
                  </div>
                  <div className="text-2xl font-bold">{totalGenerations.toLocaleString()}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Zap className="w-4 h-4" />
                    <span className="text-xs">Most Used</span>
                  </div>
                  <div className="text-lg font-bold truncate">
                    {mostUsedTool || 'N/A'}
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
                    {lastActivity
                      ? new Date(lastActivity).toLocaleDateString()
                      : 'Never'}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Usage by Tool */}
            {userDetails.toolBreakdown.length > 0 && (
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
                      {userDetails.toolBreakdown.map((tool) => (
                        <tr key={tool.toolId} className="hover:bg-muted/30">
                          <td className="p-3">
                            <span className="font-medium">{tool.toolName}</span>
                          </td>
                          <td className="p-3 text-right">
                            <Badge variant="secondary">{tool.credits.toLocaleString()}</Badge>
                          </td>
                          <td className="p-3 text-right text-muted-foreground">
                            {tool.uses}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Daily Usage Chart */}
            {userDetails.dailyUsage.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Daily Usage (Last 30 Days)</h3>
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={userDetails.dailyUsage}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      labelFormatter={(value) => new Date(value as string).toLocaleDateString()}
                      formatter={(value) => [`${value} credits`, 'Credits Used']}
                    />
                    <Line type="monotone" dataKey="credits" stroke="#3B82F6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Recent Activity */}
            {userDetails.recentActivity.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">Recent Activity</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {userDetails.recentActivity.map((activity, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30"
                    >
                      <div className="flex items-start gap-3">
                        <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(activity.date).toLocaleString()}
                          </div>
                          <div className="font-medium">{activity.tool}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {activity.credits} credits
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
