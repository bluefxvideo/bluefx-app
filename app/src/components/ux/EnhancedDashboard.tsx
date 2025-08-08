import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/app/supabase/client'
import { 
  Zap, 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Star,
  Calendar,
  ArrowRight,
  Activity
} from 'lucide-react'
import { MobileOptimizedGrid, MobileOptimizedCard, MobileResponsiveContainer } from './MobileOptimizations'

interface User {
  id: string
  email: string
  user_metadata?: {
    full_name?: string
  }
  ux_preferences?: {
    user_role?: string
  }
  credits?: {
    available_credits?: number
    monthly_allocation?: number
  }
}

interface UsageStats {
  monthlyProjects: number
  favoriteTools: Array<{ tool: string; count: number }>
  recentActivity: Array<{ tool: string; date: string; type: string }>
  creditsUsed: number
  totalGenerations: number
}

interface SmartRecommendation {
  title: string
  description: string
  tool: string
  reason: string
  priority: 'high' | 'medium' | 'low'
}

interface EnhancedDashboardProps {
  user?: User | null
}

const getTimeBasedGreeting = (): string => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const WelcomeSection: React.FC<{ user: User }> = ({ user }) => {
  const greeting = getTimeBasedGreeting()
  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Creator'
  const userRole = user.ux_preferences?.user_role || 'creator'

  return (
    <Card className="welcome-section mb-6 dashboard-welcome">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-bold">{greeting}, {displayName}!</span>
            <Badge variant="outline" className="ml-3 capitalize">
              {userRole}
            </Badge>
          </div>
          <div className="hidden sm:block text-sm text-gray-500">
            {new Date().toLocaleDateString()}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 credits-display">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Zap className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Available Credits</p>
              <p className="text-2xl font-bold">{user.credits?.available_credits || 0}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Monthly Allocation</p>
              <p className="text-2xl font-bold">{user.credits?.monthly_allocation || 0}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Days Until Renewal</p>
              <p className="text-2xl font-bold">
                {Math.ceil((new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const UsageAnalyticsSection: React.FC<{ stats: UsageStats }> = ({ stats }) => {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Your Activity This Month
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalGenerations}</div>
            <div className="text-sm text-gray-500">Total Creations</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.monthlyProjects}</div>
            <div className="text-sm text-gray-500">Projects</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.creditsUsed}</div>
            <div className="text-sm text-gray-500">Credits Used</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {stats.favoriteTools.length > 0 ? stats.favoriteTools[0]?.count || 0 : 0}
            </div>
            <div className="text-sm text-gray-500">Most Used Tool</div>
          </div>
        </div>
        
        {stats.favoriteTools.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Your Favorite Tools</h4>
            <div className="flex flex-wrap gap-2">
              {stats.favoriteTools.slice(0, 3).map((tool, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  {tool.tool} ({tool.count})
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const SmartRecommendationsSection: React.FC<{ recommendations: SmartRecommendation[] }> = ({ 
  recommendations 
}) => {
  if (recommendations.length === 0) return null

  return (
    <Card className="recommendations mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Recommended for You
        </CardTitle>
      </CardHeader>
      <CardContent>
        <MobileOptimizedGrid className="gap-3">
          {recommendations.map((rec, index) => (
            <MobileOptimizedCard key={index} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <Badge 
                  variant={rec.priority === 'high' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {rec.priority}
                </Badge>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </div>
              <h4 className="font-medium text-sm mb-1">{rec.title}</h4>
              <p className="text-xs text-gray-600 mb-2">{rec.description}</p>
              <div className="text-xs text-blue-600 font-medium">
                Try {rec.tool}
              </div>
            </MobileOptimizedCard>
          ))}
        </MobileOptimizedGrid>
      </CardContent>
    </Card>
  )
}

const RecentActivitySection: React.FC<{ activity: UsageStats['recentActivity'] }> = ({ 
  activity 
}) => {
  if (activity.length === 0) return null

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activity.slice(0, 5).map((item, index) => (
            <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <Activity className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <div className="text-sm font-medium">{item.tool}</div>
                  <div className="text-xs text-gray-500">{item.type}</div>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {new Date(item.date).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export const EnhancedDashboard: React.FC<EnhancedDashboardProps> = ({ user }) => {
  const [stats, setStats] = useState<UsageStats>({
    monthlyProjects: 0,
    favoriteTools: [],
    recentActivity: [],
    creditsUsed: 0,
    totalGenerations: 0
  })
  const [recommendations, setRecommendations] = useState<SmartRecommendation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const fetchDashboardData = async () => {
      try {
        // Fetch usage statistics
        const supabase = createClient()
        const { data: usageData } = await supabase
          .from('credit_usage')
          .select('*')
          .eq('user_id', user.id)
          .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())

        if (usageData) {
          const toolCounts = usageData.reduce((acc: Record<string, number>, item: any) => {
            acc[item.service_type] = (acc[item.service_type] || 0) + 1
            return acc
          }, {})

          const favoriteTools = Object.entries(toolCounts)
            .map(([tool, count]) => ({ tool, count: count as number }))
            .sort((a, b) => b.count - a.count)

          const totalCreditsUsed = usageData.reduce((sum: number, item: any) => sum + item.credits_used, 0)

          setStats({
            monthlyProjects: favoriteTools.length,
            favoriteTools,
            recentActivity: usageData.slice(0, 5).map((item: any) => ({
              tool: item.service_type,
              date: item.created_at,
              type: 'Generation'
            })),
            creditsUsed: totalCreditsUsed,
            totalGenerations: usageData.length
          })

          // Generate smart recommendations
          const userRecommendations = generateSmartRecommendations(favoriteTools, user.ux_preferences?.user_role)
          setRecommendations(userRecommendations)
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [user])

  if (!user) return null

  if (loading) {
    return (
      <MobileResponsiveContainer>
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </MobileResponsiveContainer>
    )
  }

  return (
    <MobileResponsiveContainer>
      <div className="space-y-6">
        <WelcomeSection user={user} />
        <UsageAnalyticsSection stats={stats} />
        <SmartRecommendationsSection recommendations={recommendations} />
        <RecentActivitySection activity={stats.recentActivity} />
      </div>
    </MobileResponsiveContainer>
  )
}

// Helper function to generate smart recommendations
function generateSmartRecommendations(
  favoriteTools: Array<{ tool: string; count: number }>,
  userRole?: string
): SmartRecommendation[] {
  const recommendations: SmartRecommendation[] = []

  // Role-based recommendations
  if (userRole === 'creator') {
    recommendations.push({
      title: 'Create Engaging Thumbnails',
      description: 'Boost your video performance with eye-catching thumbnails',
      tool: 'Thumbnail Machine',
      reason: 'Based on your creator profile',
      priority: 'high'
    })
  } else if (userRole === 'marketer') {
    recommendations.push({
      title: 'Multiply Your Content',
      description: 'Turn one piece of content into multiple formats',
      tool: 'Content Multiplier',
      reason: 'Perfect for marketing campaigns',
      priority: 'high'
    })
  }

  // Usage-based recommendations
  if (favoriteTools.length > 0) {
    const mostUsed = favoriteTools[0].tool
    if (mostUsed === 'AI Cinematographer') {
      recommendations.push({
        title: 'Add Professional Voice Overs',
        description: 'Enhance your videos with natural-sounding narration',
        tool: 'Voice Over',
        reason: 'Complements your video creation',
        priority: 'medium'
      })
    }
  }

  // Trending recommendations
  recommendations.push({
    title: 'Try Our Newest Tool',
    description: 'Generate professional logos for your brand',
    tool: 'Logo Generator',
    reason: 'Popular with other users',
    priority: 'low'
  })

  return recommendations.slice(0, 3) // Limit to 3 recommendations
}