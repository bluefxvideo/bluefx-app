'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
// import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  BarChart3, 
  Users, 
  CreditCard, 
  Activity, 
  TrendingUp,
  TrendingDown,
  DollarSign,
  Image,
  Video,
  Music,
  FileText,
  Calendar,
  Clock,
  Target,
  Zap,
  Crown
} from 'lucide-react'

interface AnalyticsData {
  // User Metrics
  totalUsers: number
  newUsersToday: number
  newUsersThisWeek: number
  dailyActiveUsers: number
  weeklyActiveUsers: number
  
  // Subscription Metrics
  activeSubscriptions: number
  subscriptionPlans: { plan_type: string; count: number }[]
  conversionRate: number
  
  // Usage Metrics
  totalCreditsUsed: number
  creditsUsedToday: number
  topTools: { tool: string; usage: number; credits: number }[]
  
  // Revenue Metrics (from addons)
  totalRevenue: number
  revenueThisMonth: number
  
  // Tool-Specific Metrics
  imagesGenerated: number
  videosCreated: number
  musicTracks: number
  contentPieces: number
  
  // Time-based Analytics
  dailyUsage: Array<{ date: string; users: number; credits: number }>
  hourlyDistribution: Array<{ hour: number; activity: number }>
}

/**
 * Fetch comprehensive analytics data from the database
 * Following the schema structure for accurate metrics
 */
async function getAnalyticsData(): Promise<AnalyticsData> {
  const supabase = createClient()
  
  try {
    // Time ranges for calculations
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

    // User metrics
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    const { count: newUsersToday } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today)

    const { count: newUsersThisWeek } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekAgo)

    // Active users (users with credit usage in time periods)
    const { data: dailyActiveUsersData } = await supabase
      .from('credit_usage')
      .select('user_id')
      .gte('created_at', twentyFourHoursAgo)
    
    const dailyActiveUsers = new Set(dailyActiveUsersData?.map(u => u.user_id) || []).size

    const { data: weeklyActiveUsersData } = await supabase
      .from('credit_usage')
      .select('user_id')
      .gte('created_at', weekAgo)
    
    const weeklyActiveUsers = new Set(weeklyActiveUsersData?.map(u => u.user_id) || []).size

    // Subscription metrics
    const { count: activeSubscriptions } = await supabase
      .from('user_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    const { data: subscriptionPlansData } = await supabase
      .from('user_subscriptions')
      .select('plan_type')
      .eq('status', 'active')

    const subscriptionPlans = subscriptionPlansData?.reduce((acc, sub) => {
      const existing = acc.find(p => p.plan_type === sub.plan_type)
      if (existing) {
        existing.count++
      } else {
        acc.push({ plan_type: sub.plan_type, count: 1 })
      }
      return acc
    }, [] as { plan_type: string; count: number }[]) || []

    const conversionRate = totalUsers ? (activeSubscriptions || 0) / totalUsers * 100 : 0

    // Credit usage metrics
    const { data: allCreditUsage } = await supabase
      .from('credit_usage')
      .select('credits_used, service_type, operation_type, created_at')

    const totalCreditsUsed = allCreditUsage?.reduce((sum, usage) => sum + usage.credits_used, 0) || 0

    const creditsUsedToday = allCreditUsage?.filter(usage => 
      usage.created_at && new Date(usage.created_at) >= new Date(today)
    ).reduce((sum, usage) => sum + usage.credits_used, 0) || 0

    // Top tools analysis
    const toolUsage = allCreditUsage?.reduce((acc, usage) => {
      const key = `${usage.service_type}_${usage.operation_type}`
      if (!acc[key]) {
        acc[key] = { usage: 0, credits: 0 }
      }
      acc[key].usage++
      acc[key].credits += usage.credits_used
      return acc
    }, {} as Record<string, { usage: number; credits: number }>) || {}

    const topTools = Object.entries(toolUsage)
      .map(([tool, data]) => ({ tool, ...data }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 10)

    // Revenue metrics (from addon purchases)
    const { data: addonPurchases } = await supabase
      .from('addon_purchases')
      .select('price_paid, created_at')
      .eq('payment_status', 'completed')

    const totalRevenue = addonPurchases?.reduce((sum, purchase) => 
      sum + purchase.price_paid, 0
    ) || 0

    const revenueThisMonth = addonPurchases?.filter(purchase =>
      purchase.created_at && new Date(purchase.created_at) >= new Date(monthAgo)
    ).reduce((sum, purchase) => sum + purchase.price_paid, 0) || 0

    // Tool-specific content counts
    const { count: imagesGenerated } = await supabase
      .from('generated_images')
      .select('*', { count: 'exact', head: true })

    const { count: videosCreated } = await supabase
      .from('avatar_videos')
      .select('*', { count: 'exact', head: true })

    const { count: musicTracks } = await supabase
      .from('music_history')
      .select('*', { count: 'exact', head: true })

    const { count: contentPieces } = await supabase
      .from('content_multiplier_history')
      .select('*', { count: 'exact', head: true })

    // Daily usage trends (last 30 days)
    const { data: dailyUsageData } = await supabase
      .from('credit_usage')
      .select('created_at, credits_used, user_id')
      .gte('created_at', monthAgo)

    const dailyUsage = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0]
      
      const dayData = dailyUsageData?.filter(usage => 
        usage.created_at && usage.created_at.split('T')[0] === dateStr
      ) || []
      
      return {
        date: dateStr,
        users: new Set(dayData.map(d => d.user_id)).size,
        credits: dayData.reduce((sum, d) => sum + d.credits_used, 0)
      }
    })

    // Hourly activity distribution
    const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => {
      const hourlyActivity = allCreditUsage?.filter(usage => {
        if (!usage.created_at) return false
        const usageHour = new Date(usage.created_at).getHours()
        return usageHour === hour
      }).length || 0
      
      return { hour, activity: hourlyActivity }
    })

    return {
      totalUsers: totalUsers || 0,
      newUsersToday: newUsersToday || 0,
      newUsersThisWeek: newUsersThisWeek || 0,
      dailyActiveUsers,
      weeklyActiveUsers,
      activeSubscriptions: activeSubscriptions || 0,
      subscriptionPlans,
      conversionRate,
      totalCreditsUsed,
      creditsUsedToday,
      topTools,
      totalRevenue,
      revenueThisMonth,
      imagesGenerated: imagesGenerated || 0,
      videosCreated: videosCreated || 0,
      musicTracks: musicTracks || 0,
      contentPieces: contentPieces || 0,
      dailyUsage,
      hourlyDistribution
    }
  } catch (error) {
    console.error('Error fetching analytics data:', error)
    // Return empty data structure on error
    return {
      totalUsers: 0,
      newUsersToday: 0,
      newUsersThisWeek: 0,
      dailyActiveUsers: 0,
      weeklyActiveUsers: 0,
      activeSubscriptions: 0,
      subscriptionPlans: [],
      conversionRate: 0,
      totalCreditsUsed: 0,
      creditsUsedToday: 0,
      topTools: [],
      totalRevenue: 0,
      revenueThisMonth: 0,
      imagesGenerated: 0,
      videosCreated: 0,
      musicTracks: 0,
      contentPieces: 0,
      dailyUsage: [],
      hourlyDistribution: []
    }
  }
}

/**
 * AdminAnalyticsDashboard - Comprehensive analytics dashboard for understanding
 * user behavior, product usage, and business metrics
 * 
 * Follows established design system patterns with card-based layout,
 * consistent gradients, and proper spacing
 */
export function AdminAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const data = await getAnalyticsData()
        setAnalytics(data)
      } catch (error) {
        console.error('Error fetching analytics:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Failed to load analytics data</p>
      </div>
    )
  }

  // Key performance indicators focused on analytics insights
  const kpis = [
    {
      title: 'User Growth This Week',
      value: analytics.newUsersThisWeek.toLocaleString(),
      description: `${analytics.newUsersToday} today`,
      icon: Users,
      gradient: 'from-blue-500 to-cyan-500',
      trend: analytics.newUsersToday > 0 ? 'up' : 'neutral'
    },
    {
      title: 'Weekly Active Users',
      value: analytics.weeklyActiveUsers.toLocaleString(),
      description: `${Math.round((analytics.weeklyActiveUsers / Math.max(analytics.totalUsers, 1)) * 100)}% retention`,
      icon: Activity,
      gradient: 'from-blue-500 to-cyan-500',
      trend: 'up'
    },
    {
      title: 'Revenue This Month',
      value: `$${analytics.revenueThisMonth.toFixed(0)}`,
      description: `$${analytics.totalRevenue.toFixed(0)} total`,
      icon: CreditCard,
      gradient: 'from-emerald-500 to-teal-500',
      trend: analytics.revenueThisMonth > 0 ? 'up' : 'neutral'
    },
    {
      title: 'Avg Credits Per User',
      value: Math.round(analytics.totalCreditsUsed / Math.max(analytics.weeklyActiveUsers, 1)).toLocaleString(),
      description: `${analytics.creditsUsedToday.toLocaleString()} today`,
      icon: Zap,
      gradient: 'from-blue-500 to-cyan-500',
      trend: analytics.creditsUsedToday > 0 ? 'up' : 'neutral'
    }
  ]

  // Tool usage metrics
  const toolMetrics = [
    {
      title: 'Images Generated',
      value: analytics.imagesGenerated.toLocaleString(),
      icon: Image,
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'Videos Created',
      value: analytics.videosCreated.toLocaleString(),
      icon: Video,
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'Music Tracks',
      value: analytics.musicTracks.toLocaleString(),
      icon: Music,
      gradient: 'from-teal-500 to-blue-500'
    },
    {
      title: 'Content Pieces',
      value: analytics.contentPieces.toLocaleString(),
      icon: FileText,
      gradient: 'from-cyan-500 to-blue-500'
    }
  ]

  return (
    <div className="space-y-8">
      {/* Status badges */}
      <div className="flex justify-end items-center space-x-2">
        <Badge className="bg-blue-500 text-white">Live Data</Badge>
        <div className="flex items-center px-3 py-1.5 text-sm border border-border rounded-md text-muted-foreground">
          <Calendar className="mr-2 h-4 w-4" />
          Export Report
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi, index) => {
          const Icon = kpi.icon
          const TrendIcon = kpi.trend === 'up' ? TrendingUp : 
                           kpi.trend === 'down' ? TrendingDown : Activity
          
          return (
            <Card key={index} className="transition-all hover:shadow-lg hover:scale-[1.02]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {kpi.title}
                  </CardTitle>
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${kpi.gradient} flex items-center justify-center shadow-sm`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground mb-1">
                  {kpi.value}
                </div>
                <div className="flex items-center space-x-1">
                  <TrendIcon className={`h-3 w-3 ${
                    kpi.trend === 'up' ? 'text-blue-600' : 
                    kpi.trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
                  }`} />
                  <p className="text-xs text-muted-foreground">
                    {kpi.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="usage" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="usage">Usage Analytics</TabsTrigger>
          <TabsTrigger value="users">User Analytics</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Analytics</TabsTrigger>
          <TabsTrigger value="tools">Tool Performance</TabsTrigger>
        </TabsList>

        {/* Usage Analytics Tab */}
        <TabsContent value="usage" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Usage Trend */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Daily Usage Trend</span>
                </CardTitle>
                <CardDescription>
                  Credits used and active users over the last 30 days
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Chart visualization would go here</p>
                    <p className="text-xs">
                      {analytics.dailyUsage.length} days of data available
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Hourly Activity Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Peak Usage Hours</span>
                </CardTitle>
                <CardDescription>
                  Activity distribution throughout the day
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analytics.hourlyDistribution
                    .sort((a, b) => b.activity - a.activity)
                    .slice(0, 6)
                    .map((hour, _index) => (
                      <div key={hour.hour} className="flex items-center justify-between">
                        <span className="text-sm">
                          {hour.hour.toString().padStart(2, '0')}:00 - {(hour.hour + 1).toString().padStart(2, '0')}:00
                        </span>
                        <div className="flex items-center space-x-2">
                          <div className="w-24 bg-muted rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full"
                              style={{ 
                                width: `${(hour.activity / Math.max(...analytics.hourlyDistribution.map(h => h.activity), 1)) * 100}%` 
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium w-8">
                            {hour.activity}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Tools Usage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5" />
                <span>Most Popular Tools</span>
              </CardTitle>
              <CardDescription>
                Tools ranked by usage frequency and credits consumed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.topTools.slice(0, 8).map((tool, index) => (
                  <div key={tool.tool} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">
                          {tool.tool.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {tool.usage} uses • {tool.credits} credits
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">
                        {Math.round(tool.credits / Math.max(tool.usage, 1))} avg credits
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User Analytics Tab */}
        <TabsContent value="users" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Growth */}
            <Card>
              <CardHeader>
                <CardTitle>User Growth</CardTitle>
                <CardDescription>
                  New user registrations and retention
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <span>Total Users</span>
                    <span className="font-bold">{analytics.totalUsers.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <span>New Today</span>
                    <span className="font-bold text-blue-600">+{analytics.newUsersToday}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <span>New This Week</span>
                    <span className="font-bold text-blue-600">+{analytics.newUsersThisWeek}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                    <span>Weekly Active</span>
                    <span className="font-bold">{analytics.weeklyActiveUsers.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Subscription Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Subscription Plans</CardTitle>
                <CardDescription>
                  Distribution of active subscription plans
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.subscriptionPlans.map((plan, _index) => (
                    <div key={plan.plan_type} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Crown className="h-4 w-4 text-yellow-500" />
                        <span className="capitalize">{plan.plan_type}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{plan.count}</div>
                        <div className="text-xs text-muted-foreground">
                          {Math.round((plan.count / Math.max(analytics.activeSubscriptions, 1)) * 100)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Revenue Analytics Tab */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5" />
                  <span>Total Revenue</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  ${analytics.totalRevenue.toFixed(2)}
                </div>
                <p className="text-sm text-muted-foreground">
                  All-time addon sales
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>This Month</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  ${analytics.revenueThisMonth.toFixed(2)}
                </div>
                <p className="text-sm text-muted-foreground">
                  Current month revenue
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conversion Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {analytics.conversionRate.toFixed(1)}%
                </div>
                <p className="text-sm text-muted-foreground">
                  Users to subscribers
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tool Performance Tab */}
        <TabsContent value="tools" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {toolMetrics.map((metric, index) => {
              const Icon = metric.icon
              return (
                <Card key={index} className="text-center">
                  <CardHeader className="pb-2">
                    <div className={`mx-auto w-12 h-12 rounded-lg bg-gradient-to-br ${metric.gradient} flex items-center justify-center shadow-sm mb-2`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-sm">{metric.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metric.value}</div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Detailed tool performance would go here */}
          <Card>
            <CardHeader>
              <CardTitle>Tool Performance Details</CardTitle>
              <CardDescription>
                Detailed analytics for each AI tool and service
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Detailed tool performance charts and metrics</p>
                <p className="text-sm">Coming soon with enhanced visualization</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}