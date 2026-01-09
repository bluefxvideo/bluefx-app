'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Users,
  Activity,
  TrendingUp,
  UserPlus,
  BarChart3,
  Download,
  RefreshCw,
  Calendar,
  Clock,
  ChevronRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
// Types for platform usage stats
interface PlatformSummaryStats {
  totalCreditsUsed: number;
  totalGenerations: number;
  activeUsers: number;
  newUsers: number;
  totalUsers: number;
}

interface ToolUsageStat {
  toolId: string;
  toolName: string;
  totalCredits: number;
  totalUses: number;
  uniqueUsers: number;
}

interface DailyUsageTrend {
  date: string;
  creditsUsed: number;
  generations: number;
  activeUsers: number;
}

interface TopUser {
  userId: string;
  email: string | null;
  username: string | null;
  fullName: string | null;
  creditsUsed: number;
  generations: number;
  lastActive: string | null;
}

interface UserDetails {
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

const CHART_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#84CC16'];

export function PlatformUsagePanel() {
  const [dateRange, setDateRange] = useState<'1d' | '7d' | '30d' | '90d' | 'all'>('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<PlatformSummaryStats | null>(null);
  const [toolUsage, setToolUsage] = useState<ToolUsageStat[]>([]);
  const [dailyTrends, setDailyTrends] = useState<DailyUsageTrend[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  // User detail modal state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Fetching platform stats for date range:', dateRange);
      const response = await fetch(`/api/admin/platform-stats?range=${dateRange}`);
      const result = await response.json();
      console.log('Platform stats result:', result);

      if (response.ok && result.success) {
        setSummary(result.summary || null);
        setToolUsage(result.toolUsage || []);
        setDailyTrends(result.dailyTrends || []);
        setTopUsers(result.topUsers || []);
      } else {
        console.error('Platform stats failed:', result.error);
        setError(result.error || 'Failed to load data');
      }
    } catch (err) {
      console.error('Error loading platform stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load platform statistics');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadUserDetails = async (userId: string) => {
    setSelectedUserId(userId);
    setIsLoadingUser(true);
    setUserDetails(null);

    try {
      const response = await fetch(`/api/admin/user-details?userId=${userId}`);
      const result = await response.json();

      if (response.ok && result.success) {
        setUserDetails(result);
      } else {
        console.error('Failed to load user details:', result.error);
      }
    } catch (err) {
      console.error('Error loading user details:', err);
    } finally {
      setIsLoadingUser(false);
    }
  };

  const closeUserDetails = () => {
    setSelectedUserId(null);
    setUserDetails(null);
  };

  const handleExport = () => {
    const csvData = [
      ['Tool', 'Total Credits', 'Total Uses', 'Unique Users'],
      ...toolUsage.map(tool => [
        tool.toolName,
        tool.totalCredits.toString(),
        tool.totalUses.toString(),
        tool.uniqueUsers.toString(),
      ]),
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `platform-usage-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const pieChartData = toolUsage.slice(0, 6).map((tool, index) => ({
    name: tool.toolName,
    value: tool.totalCredits,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
        <CardContent className="flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <Button onClick={loadData} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as typeof dateRange)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Today</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="outline" onClick={handleExport} disabled={isLoading}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <CreditCard className="w-4 h-4" />
                  <span className="text-xs">Credits Used</span>
                </div>
                <div className="text-2xl font-bold">{summary?.totalCreditsUsed.toLocaleString() || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Activity className="w-4 h-4" />
                  <span className="text-xs">Generations</span>
                </div>
                <div className="text-2xl font-bold">{summary?.totalGenerations.toLocaleString() || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs">Active Users</span>
                </div>
                <div className="text-2xl font-bold">{summary?.activeUsers.toLocaleString() || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <UserPlus className="w-4 h-4" />
                  <span className="text-xs">New Users</span>
                </div>
                <div className="text-2xl font-bold">{summary?.newUsers.toLocaleString() || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="w-4 h-4" />
                  <span className="text-xs">Total Users</span>
                </div>
                <div className="text-2xl font-bold">{summary?.totalUsers.toLocaleString() || 0}</div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Usage Trends Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Platform Usage Trends
                </CardTitle>
                <CardDescription>Daily credit usage across all users</CardDescription>
              </CardHeader>
              <CardContent>
                {dailyTrends.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={dailyTrends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12 }}
                        tickFormatter={formatDate}
                      />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
                        formatter={(value, name) => [
                          value,
                          name === 'creditsUsed' ? 'Credits' : name === 'activeUsers' ? 'Active Users' : 'Generations',
                        ]}
                      />
                      <Line
                        type="monotone"
                        dataKey="creditsUsed"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="activeUsers"
                        stroke="#10B981"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No usage data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tool Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Tool Usage Distribution
                </CardTitle>
                <CardDescription>Credits used by tool type</CardDescription>
              </CardHeader>
              <CardContent>
                {pieChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }: { name: string; percent?: number }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} credits`, 'Credits Used']} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No tool usage data
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tool Usage Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Tool Usage Breakdown
              </CardTitle>
              <CardDescription>Detailed statistics for each tool</CardDescription>
            </CardHeader>
            <CardContent>
              {toolUsage.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 text-sm font-medium">Tool</th>
                        <th className="text-right p-3 text-sm font-medium">Total Credits</th>
                        <th className="text-right p-3 text-sm font-medium">Total Uses</th>
                        <th className="text-right p-3 text-sm font-medium">Unique Users</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {toolUsage.map((tool) => (
                        <tr key={tool.toolId} className="hover:bg-muted/30">
                          <td className="p-3 font-medium">{tool.toolName}</td>
                          <td className="p-3 text-right">
                            <Badge variant="secondary">{tool.totalCredits.toLocaleString()}</Badge>
                          </td>
                          <td className="p-3 text-right text-muted-foreground">
                            {tool.totalUses.toLocaleString()}
                          </td>
                          <td className="p-3 text-right text-muted-foreground">
                            {tool.uniqueUsers.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No tool usage data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Users Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Top Users by Credit Usage
              </CardTitle>
              <CardDescription>Users with the highest credit consumption</CardDescription>
            </CardHeader>
            <CardContent>
              {topUsers.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 text-sm font-medium">User</th>
                        <th className="text-right p-3 text-sm font-medium">Credits Used</th>
                        <th className="text-right p-3 text-sm font-medium">Generations</th>
                        <th className="text-right p-3 text-sm font-medium">Last Active</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {topUsers.map((user, index) => (
                        <tr
                          key={user.userId}
                          className="hover:bg-muted/30 cursor-pointer transition-colors"
                          onClick={() => loadUserDetails(user.userId)}
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-5">#{index + 1}</span>
                              <div>
                                <div className="font-medium">
                                  {user.username || user.fullName || 'Unknown'}
                                </div>
                                <div className="text-xs text-muted-foreground">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-right">
                            <Badge variant="secondary">{user.creditsUsed.toLocaleString()}</Badge>
                          </td>
                          <td className="p-3 text-right text-muted-foreground">
                            {user.generations.toLocaleString()}
                          </td>
                          <td className="p-3 text-right text-muted-foreground text-sm">
                            <div className="flex items-center justify-end gap-2">
                              {user.lastActive
                                ? new Date(user.lastActive).toLocaleDateString()
                                : 'Never'}
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No user data available
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* User Details Modal */}
      <Dialog open={selectedUserId !== null} onOpenChange={(open) => !open && closeUserDetails()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Details
            </DialogTitle>
          </DialogHeader>

          {isLoadingUser ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : userDetails ? (
            <div className="space-y-6">
              {/* User Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Account</h3>
                  <div className="space-y-1 text-sm">
                    <div><span className="text-muted-foreground">Username:</span> {userDetails.user.username || 'Not set'}</div>
                    <div><span className="text-muted-foreground">Name:</span> {userDetails.user.fullName || 'Not set'}</div>
                    <div><span className="text-muted-foreground">Email:</span> {userDetails.user.email || 'Not set'}</div>
                    <div><span className="text-muted-foreground">Role:</span> <Badge variant="outline">{userDetails.user.role || 'user'}</Badge></div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Joined:</span> {userDetails.user.createdAt ? new Date(userDetails.user.createdAt).toLocaleDateString() : 'Unknown'}
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Credits</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-green-500" />
                      <span className="text-muted-foreground">Available:</span>
                      <span className="font-medium text-green-500">{userDetails.credits.available.toLocaleString()}</span>
                    </div>
                    <div><span className="text-muted-foreground">Total Allocated:</span> {userDetails.credits.total.toLocaleString()}</div>
                    <div><span className="text-muted-foreground">Used:</span> {userDetails.credits.used.toLocaleString()}</div>
                  </div>

                  {userDetails.subscription && (
                    <div className="mt-4">
                      <h3 className="font-semibold mb-2">Subscription</h3>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Plan:</span>
                          <Badge>{userDetails.subscription.plan}</Badge>
                        </div>
                        <div><span className="text-muted-foreground">Status:</span> <Badge variant={userDetails.subscription.status === 'active' ? 'default' : 'secondary'}>{userDetails.subscription.status}</Badge></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Tool Breakdown */}
              {userDetails.toolBreakdown.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Tool Usage Breakdown</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-2">Tool</th>
                          <th className="text-right p-2">Credits</th>
                          <th className="text-right p-2">Uses</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {userDetails.toolBreakdown.map((tool) => (
                          <tr key={tool.toolId} className="hover:bg-muted/30">
                            <td className="p-2">{tool.toolName}</td>
                            <td className="p-2 text-right">
                              <Badge variant="secondary">{tool.credits.toLocaleString()}</Badge>
                            </td>
                            <td className="p-2 text-right text-muted-foreground">{tool.uses}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Usage Chart */}
              {userDetails.dailyUsage.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Daily Usage (Last 30 Days)</h3>
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
                        labelFormatter={(value) => new Date(value).toLocaleDateString()}
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
                  <h3 className="font-semibold mb-2">Recent Activity</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {userDetails.recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-center justify-between text-sm p-2 rounded bg-muted/30">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {new Date(activity.date).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>{activity.tool}</span>
                          <Badge variant="secondary">{activity.credits} credits</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Failed to load user details
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
