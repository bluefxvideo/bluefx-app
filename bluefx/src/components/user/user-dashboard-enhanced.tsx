'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/app/supabase/client'
import { useQuery } from '@tanstack/react-query'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts'
import {
  CreditCard,
  TrendingUp,
  Activity,
  Calendar,
  Download,
  Image,
  Video,
  FileText,
  Music,
  Palette,
  Loader2,
  AlertCircle,
  BarChart3,
  Clock
} from 'lucide-react'

// Enhanced interfaces following our playbook patterns
interface UserDashboardStats {
  totalCreditsUsed: number
  creditsAvailable: number
  monthlyAllocation: number
  contentCreated: number
  toolsUsed: number
  lastActive: string
}

interface ToolUsageData {
  tool_id: string
  usage_count: number
  credits_used: number
  last_used: string
}

interface ContentStats {
  generated_images: number
  avatar_videos: number
  ebook_history: number
  music_history: number
  script_to_video_history: number
}

interface UsageTrend {
  date: string
  credits_used: number
  content_created: number
}

/**
 * Enhanced User Dashboard Component
 * Follows BlueFX Dashboard Component Generator Playbook patterns
 */
export function UserDashboardEnhanced() {
  const [selectedDateRange, setSelectedDateRange] = useState('30d')
  const supabase = createClient()

  // User Stats Query with comprehensive error handling
  const { 
    data: userStats, 
    isLoading: statsLoading, 
    error: statsError,
    refetch: refetchStats
  } = useQuery({
    queryKey: ['user-dashboard-stats', selectedDateRange],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Get user credits
      const { data: credits } = await supabase
        .from('user_credits')
        .select('available_credits, total_credits')
        .eq('user_id', user.id)
        .single()

      // Get usage stats based on date range
      const days = selectedDateRange === '7d' ? 7 : selectedDateRange === '30d' ? 30 : 90
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      const { data: creditUsage } = await supabase
        .from('credit_usage')
        .select('credits_used, created_at, service_type')
        .eq('user_id', user.id)
        .gte('created_at', startDate)

      const totalCreditsUsed = creditUsage?.reduce((sum, usage) => sum + usage.credits_used, 0) || 0

      // Get content creation stats
      const { data: contentStats } = await supabase
        .rpc('get_user_content_stats', { user_id_param: user.id })

      // Get last activity
      const { data: lastActivity } = await supabase
        .from('credit_usage')
        .select('created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)

      return {
        totalCreditsUsed,
        creditsAvailable: credits?.available_credits || 0,
        monthlyAllocation: credits?.total_credits || 0,
        contentCreated: Object.values(contentStats || {}).reduce((sum: number, count: any) => sum + (count || 0), 0),
        toolsUsed: creditUsage?.length || 0,
        lastActive: lastActivity?.[0]?.created_at || new Date().toISOString()
      } as UserDashboardStats
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2
  })

  // Tool Usage Analytics Query
  const { data: toolUsage = [], isLoading: toolUsageLoading } = useQuery({
    queryKey: ['user-tool-usage', selectedDateRange],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const days = selectedDateRange === '7d' ? 7 : selectedDateRange === '30d' ? 30 : 90
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      const { data } = await supabase
        .from('credit_usage')
        .select('service_type, credits_used, created_at')
        .eq('user_id', user.id)
        .gte('created_at', startDate)

      // Aggregate by service type
      const toolMap = new Map()
      data?.forEach(usage => {
        const existing = toolMap.get(usage.service_type) || { 
          tool_id: usage.service_type, 
          usage_count: 0, 
          credits_used: 0, 
          last_used: usage.created_at 
        }
        toolMap.set(usage.service_type, {
          ...existing,
          usage_count: existing.usage_count + 1,
          credits_used: existing.credits_used + usage.credits_used,
          last_used: (usage.created_at && usage.created_at > existing.last_used) ? usage.created_at : existing.last_used
        })
      })

      return Array.from(toolMap.values()).sort((a, b) => b.usage_count - a.usage_count)
    }
  })

  // Usage Trends Query
  const { data: usageTrends = [], isLoading: trendsLoading } = useQuery({
    queryKey: ['user-usage-trends', selectedDateRange],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const days = selectedDateRange === '7d' ? 7 : selectedDateRange === '30d' ? 30 : 90
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

      const trends: UsageTrend[] = []
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
        const dateStr = date.toISOString().split('T')[0]

        const { data: dailyUsage } = await supabase
          .from('credit_usage')
          .select('credits_used, service_type')
          .eq('user_id', user.id)
          .gte('created_at', dateStr)
          .lt('created_at', new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])

        trends.push({
          date: dateStr,
          credits_used: dailyUsage?.reduce((sum, usage) => sum + usage.credits_used, 0) || 0,
          content_created: dailyUsage?.length || 0
        })
      }

      return trends
    }
  })

  // Real-time subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel('user-dashboard-updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'credit_usage' },
        () => {
          refetchStats()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, refetchStats])

  // Enhanced metrics with trend analysis
  const metrics = [
    {
      title: 'Available Credits',
      value: userStats?.creditsAvailable.toLocaleString() || '0',
      description: 'Credits ready to use',
      icon: CreditCard,
      trend: userStats?.monthlyAllocation ? `${userStats.monthlyAllocation} monthly` : '',
      trendPositive: true,
      color: 'blue'
    },
    {
      title: 'Credits Used',
      value: userStats?.totalCreditsUsed?.toLocaleString() || '0',
      description: `Last ${selectedDateRange}`,
      icon: TrendingUp,
      trend: (userStats?.totalCreditsUsed || 0) > 0 ? 'Active usage' : 'No usage yet',
      trendPositive: (userStats?.totalCreditsUsed || 0) > 0,
      color: 'green'
    },
    {
      title: 'Content Created',
      value: userStats?.contentCreated?.toLocaleString() || '0',
      description: 'Total pieces created',
      icon: Activity,
      trend: userStats?.toolsUsed ? `${userStats.toolsUsed} sessions` : 'Get started',
      trendPositive: (userStats?.contentCreated || 0) > 0,
      color: 'purple'
    },
    {
      title: 'Last Active',
      value: userStats?.lastActive ? new Date(userStats.lastActive).toLocaleDateString() : 'Never',
      description: 'Most recent activity',
      icon: Clock,
      trend: userStats?.lastActive ? 'Recently active' : 'Welcome!',
      trendPositive: true,
      color: 'orange'
    }
  ]

  // Tool icons mapping
  const getToolIcon = (toolId: string) => {
    const iconMap: Record<string, any> = {
      'thumbnail-machine': Image,
      'ai-cinematographer': Video,
      'script-writer': FileText,
      'music-maker': Music,
      'logo-generator': Palette,
      default: BarChart3
    }
    return iconMap[toolId] || iconMap.default
  }

  // Export functionality
  const handleExportData = async () => {
    try {
      const csvData = [
        ['Tool', 'Usage Count', 'Credits Used', 'Last Used'],
        ...toolUsage.map(tool => [
          tool.tool_id,
          tool.usage_count,
          tool.credits_used,
          new Date(tool.last_used).toLocaleDateString()
        ])
      ].map(row => row.join(',')).join('\n')

      const blob = new Blob([csvData], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `bluefx-usage-${selectedDateRange}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  // Loading state
  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Loading your dashboard...</span>
      </div>
    )
  }

  // Error state
  if (statsError) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center p-6">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <div>
              <h3 className="font-medium text-red-800">Error Loading Dashboard</h3>
              <p className="text-red-600 text-sm">Failed to load your dashboard data. Please try again.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const pieChartData = toolUsage.slice(0, 5).map((tool, index) => ({
    name: tool.tool_id.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
    value: tool.credits_used,
    color: ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444'][index]
  }))

  return (
    <div className="space-y-6">
      {/* Header with Date Range Filter */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <select
            value={selectedDateRange}
            onChange={(e) => setSelectedDateRange(e.target.value)}
            className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <Button
            variant="outline"
            onClick={handleExportData}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {metric.title}
                </CardTitle>
                <Icon className={`h-4 w-4 text-${metric.color}-500`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">
                  {metric.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {metric.description}
                </p>
                <p className={`text-xs mt-2 ${
                  metric.trendPositive ? 'text-blue-600' : 'text-muted-foreground'
                }`}>
                  {metric.trend}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage Trends Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Usage Trends
            </CardTitle>
            <CardDescription>
              Your daily credit usage over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={usageTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                    formatter={(value, name) => [value, name === 'credits_used' ? 'Credits Used' : 'Content Created']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="credits_used" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    dot={{ fill: '#3B82F6' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tool Usage Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Tool Usage Distribution
            </CardTitle>
            <CardDescription>
              Credits used by tool type
            </CardDescription>
          </CardHeader>
          <CardContent>
            {toolUsageLoading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No usage data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tool Usage Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Tool Usage Details
          </CardTitle>
          <CardDescription>
            Detailed breakdown of your tool usage
          </CardDescription>
        </CardHeader>
        <CardContent>
          {toolUsageLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : toolUsage.length > 0 ? (
            <div className="space-y-4">
              {toolUsage.map((tool, index) => {
                const Icon = getToolIcon(tool.tool_id)
                return (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Icon className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">
                          {tool.tool_id.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </h4>
                        <p className="text-sm text-gray-500">
                          Last used: {new Date(tool.last_used).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{tool.usage_count} uses</div>
                      <div className="text-sm text-gray-500">{tool.credits_used} credits</div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tool usage yet. Start creating to see your analytics!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}