'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Users,
  Activity,
  TrendingUp,
  UserPlus,
  BarChart3,
  Download,
  RefreshCw,
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
import {
  fetchPlatformUsageStats,
  type PlatformSummaryStats,
  type ToolUsageStat,
  type DailyUsageTrend,
  type TopUser,
} from '@/actions/admin/platform-usage-stats';

const CHART_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#84CC16'];

export function PlatformUsagePanel() {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<PlatformSummaryStats | null>(null);
  const [toolUsage, setToolUsage] = useState<ToolUsageStat[]>([]);
  const [dailyTrends, setDailyTrends] = useState<DailyUsageTrend[]>([]);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('Fetching platform stats for date range:', dateRange);
      const result = await fetchPlatformUsageStats(dateRange);
      console.log('Platform stats result:', result);

      if (result.success) {
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
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
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
                        <tr key={user.userId} className="hover:bg-muted/30">
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
                            {user.lastActive
                              ? new Date(user.lastActive).toLocaleDateString()
                              : 'Never'}
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
    </div>
  );
}
