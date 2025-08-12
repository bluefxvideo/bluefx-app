'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/app/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CurrentSubscriptionSkeleton, CurrentCreditsSkeleton } from '@/components/dashboard/dashboard-skeletons'
import { CancellationWarningModal } from '@/components/subscription/cancellation-warning-modal'
import { CancellationFeedbackModal, type CancellationFeedback } from '@/components/subscription/cancellation-feedback-modal'
import { 
  CreditCard, 
  AlertTriangle, 
  Mail, 
  Phone,
  MessageCircle,
  ArrowLeft,
  Loader2,
  Shield,
  Users
} from 'lucide-react'

interface Subscription {
  id: string
  plan_type: string
  status: string
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  credits_per_month: number
  fastspring_subscription_id: string | null
  created_at: string
}

interface UserCredits {
  total_credits: number
  used_credits: number
  available_credits: number
  period_start: string
  period_end: string
}

interface UserProfile {
  id: string
  email?: string
  user_metadata?: {
    payment_processor?: string
     
    [key: string]: any
  }
}

export default function SubscriptionPage() {
  const router = useRouter()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [credits, setCredits] = useState<UserCredits | null>(null)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadSubscriptionData() {
      const supabase = createClient()
      
      try {
        // Get current user
        const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()
        if (userError || !authUser) {
          router.push('/login')
          return
        }
        
        setUser(authUser)

        // Get subscription data
        const { data: subData, error: subError } = await supabase
          .from('user_subscriptions')
          .select('*')
          .eq('user_id', authUser.id)
          .single()

        if (subError) {
          console.error('Subscription fetch error:', subError)
          setError('Unable to load subscription data')
        } else if (subData) {
          // Fix null types for subscription data
          setSubscription({
            ...subData,
            cancel_at_period_end: subData.cancel_at_period_end ?? false,
            created_at: subData.created_at || new Date().toISOString()
          })
        }

        // Get credits data
        const { data: creditsData, error: creditsError } = await supabase
          .from('user_credits')
          .select('*')
          .eq('user_id', authUser.id)
          .single()

        if (creditsError) {
          console.error('Credits fetch error:', creditsError)
        } else if (creditsData) {
          // Fix null types for credits data
          setCredits({
            ...creditsData,
            available_credits: creditsData.available_credits ?? 0
          })
        }

      } catch (err) {
        console.error('Failed to load data:', err)
        setError('Failed to load subscription data')
      } finally {
        setLoading(false)
      }
    }

    loadSubscriptionData()
  }, [router])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getStatusBadge = (status: string, cancelAtPeriodEnd: boolean) => {
    if (cancelAtPeriodEnd) {
      return <Badge variant="destructive">Cancelling at Period End</Badge>
    }
    
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-100">Active</Badge>
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>
      case 'expired':
        return <Badge variant="secondary">Expired</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getPaymentProvider = () => {
    if (subscription?.fastspring_subscription_id) return 'fastspring'
    if (user?.user_metadata?.payment_processor === 'clickbank') return 'clickbank'
    return user?.user_metadata?.payment_processor || 'unknown'
  }

  const handleStartCancellation = () => {
    setShowWarningModal(true)
  }

  const handleKeepPlan = () => {
    setShowWarningModal(false)
  }

  const handleProceedToCancel = () => {
    setShowWarningModal(false)
    
    const paymentProvider = getPaymentProvider()
    
    if (paymentProvider === 'clickbank') {
      // ClickBank users need to contact support for cancellation
      const subject = 'Subscription Cancellation Request - ClickBank'
      const body = `Hello BlueFX Team,

I would like to request the cancellation of my BlueFX subscription.

My account details:
- Email: ${user?.email || 'Not available'}
- Payment Processor: ClickBank

Please process this cancellation request and confirm when it has been completed.

Thank you,
${user?.user_metadata?.full_name || 'BlueFX User'}`
      
      window.open(`mailto:contact@bluefx.net?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
    } else {
      // FastSpring users go through feedback modal
      setShowFeedbackModal(true)
    }
  }

  const handleCancelWithFeedback = async (feedback: CancellationFeedback) => {
    if (!subscription || !user) return
    
    setIsSubmittingCancel(true)
    
    try {
      const response = await fetch('/api/subscription/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subscriptionId: subscription.fastspring_subscription_id,
          feedback
        })
      })
      
      if (response.ok) {
        // Account has been deleted - redirect to home page
        // User will be automatically logged out since their account no longer exists
        window.location.href = '/'
      } else {
        throw new Error('Failed to cancel subscription')
      }
    } catch (error) {
      console.error('Cancellation error:', error)
      setError('Failed to cancel subscription. Please try again or contact support.')
    } finally {
      setIsSubmittingCancel(false)
      setShowFeedbackModal(false)
    }
  }

  const handleContactSupport = (method: 'email' | 'phone' | 'chat') => {
    switch (method) {
      case 'email':
        window.open('mailto:support@bluefx.net?subject=Subscription Support Request')
        break
      case 'phone':
        alert('Phone support: +1 (888) 344-0934\nAvailable Mon-Fri 9AM-5PM EST')
        break
      case 'chat':
        console.log('Opening chat support...')
        break
    }
  }


  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center text-red-600 dark:text-red-400">
              <AlertTriangle className="h-5 w-5 mr-2" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Subscription Management</h1>
        <p className="text-muted-foreground">
          Manage your BlueFX AI Media Machine subscription and billing settings
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-8 border-b mb-6">
        <button 
          className="pb-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => router.push('/dashboard')}
        >
          Dashboard
        </button>
        <button 
          className="pb-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => router.push('/dashboard/usage')}
        >
          Usage
        </button>
        <button 
          className="pb-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => router.push('/dashboard/profile')}
        >
          Profile
        </button>
        <button 
          className="pb-3 text-sm font-medium text-foreground border-b-2 border-primary"
          onClick={() => router.push('/dashboard/subscription')}
        >
          Subscription
        </button>
      </div>

      <div className="space-y-6">
        {/* Current Subscription */}
        {loading ? (
          <CurrentSubscriptionSkeleton />
        ) : subscription ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Current Subscription
                </span>
                {getStatusBadge(subscription.status, subscription.cancel_at_period_end)}
              </CardTitle>
              <CardDescription>
                Your current plan and billing information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Plan Type</h4>
                  <p className="text-lg font-semibold capitalize">{subscription.plan_type}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Credits per Month</h4>
                  <p className="text-lg font-semibold">{subscription.credits_per_month.toLocaleString()}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Current Period</h4>
                  <p className="text-sm">{formatDate(subscription.current_period_start)}</p>
                  <p className="text-sm text-muted-foreground">to {formatDate(subscription.current_period_end)}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Next Billing</h4>
                  <p className="text-sm">{formatDate(subscription.current_period_end)}</p>
                  <p className="text-sm text-muted-foreground">
                    {subscription.cancel_at_period_end ? 'Subscription ends' : 'Renews automatically'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Current Credits */}
        {loading ? (
          <CurrentCreditsSkeleton />
        ) : credits ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="h-5 w-5 mr-2" />
                Current Credits
              </CardTitle>
              <CardDescription>
                Your credit usage for the current billing period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Available Credits</h4>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {credits.available_credits.toLocaleString()}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Used Credits</h4>
                  <p className="text-lg font-semibold">{credits.used_credits.toLocaleString()}</p>
                </div>
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Total Credits</h4>
                  <p className="text-lg font-semibold">{credits.total_credits.toLocaleString()}</p>
                </div>
              </div>
              
              {/* Usage Progress Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-sm text-muted-foreground mb-2">
                  <span>Usage Progress</span>
                  <span>{Math.round((credits.used_credits / credits.total_credits) * 100)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min((credits.used_credits / credits.total_credits) * 100, 100)}%`
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Support Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Need Help? Contact Our Support Team
            </CardTitle>
            <CardDescription>
              Our team is here to help you get the most out of BlueFX. Whether you have questions about features, 
              billing, or need technical assistance, we&apos;re just a click away.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                onClick={() => handleContactSupport('email')}
                className="h-auto p-4 justify-start"
              >
                <Mail className="h-5 w-5 mr-3 text-blue-600" />
                <div className="text-left">
                  <div className="font-medium">Email Support</div>
                  <div className="text-sm text-muted-foreground">support@bluefx.net</div>
                  <div className="text-xs text-muted-foreground">24-48 hour response</div>
                </div>
              </Button>
              
              <Button
                variant="outline"
                onClick={() => handleContactSupport('phone')}
                className="h-auto p-4 justify-start"
              >
                <Phone className="h-5 w-5 mr-3 text-green-600" />
                <div className="text-left">
                  <div className="font-medium">Phone Support</div>
                  <div className="text-sm text-muted-foreground">+1 (888) 344-0934</div>
                  <div className="text-xs text-muted-foreground">Mon-Fri 9AM-5PM EST</div>
                </div>
              </Button>
              
              <Button
                variant="outline"
                onClick={() => handleContactSupport('chat')}
                className="h-auto p-4 justify-start"
              >
                <MessageCircle className="h-5 w-5 mr-3 text-purple-600" />
                <div className="text-left">
                  <div className="font-medium">Live Chat</div>
                  <div className="text-sm text-muted-foreground">Instant messaging</div>
                  <div className="text-xs text-muted-foreground">Available during business hours</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <Card>
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
            <CardDescription>
              Common questions about subscription management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <details className="border border-border rounded-lg">
                <summary className="p-4 cursor-pointer hover:bg-accent transition-colors font-medium">
                  How do I change my billing cycle?
                </summary>
                <div className="p-4 pt-0 text-sm text-muted-foreground border-t">
                  You can switch between monthly and yearly billing at any time. Contact our support team for assistance with billing cycle changes.
                </div>
              </details>
              
              <details className="border border-border rounded-lg">
                <summary className="p-4 cursor-pointer hover:bg-accent transition-colors font-medium">
                  What happens if I pause my subscription?
                </summary>
                <div className="p-4 pt-0 text-sm text-muted-foreground border-t">
                  When you pause your subscription, you&apos;ll retain access to your current features until the end of your billing period. You can resume anytime.
                </div>
              </details>
              
              <details className="border border-border rounded-lg">
                <summary className="p-4 cursor-pointer hover:bg-accent transition-colors font-medium">
                  Can I get a refund?
                </summary>
                <div className="p-4 pt-0 text-sm text-muted-foreground border-t">
                  We offer a 30-day money-back guarantee. If you&apos;re not satisfied, contact our support team for a full refund.
                </div>
              </details>
              
              <details className="border border-border rounded-lg">
                <summary className="p-4 cursor-pointer hover:bg-accent transition-colors font-medium">
                  How do I cancel my subscription?
                </summary>
                <div className="p-4 pt-0 text-sm text-muted-foreground border-t">
                  You can cancel your subscription at any time. Depending on your payment method, you may be able to cancel directly or need to contact our support team.
                </div>
              </details>
            </div>
          </CardContent>
        </Card>

        {/* Cancellation Section */}
        {subscription && subscription.status === 'active' && !subscription.cancel_at_period_end && (
          <Card className="border-red-200 dark:border-red-800">
            <CardContent className="p-6">
              <div className="text-center">
                <h3 className="text-lg font-medium mb-2">Looking to cancel your subscription?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  We understand that circumstances change. If you need to cancel, we&apos;re here to help make the process as smooth as possible.
                </p>
                <Button
                  variant="outline"
                  onClick={handleStartCancellation}
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  Start Cancellation Process
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Cancellation Modals */}
      <CancellationWarningModal
        isOpen={showWarningModal}
        onClose={() => setShowWarningModal(false)}
        onKeepPlan={handleKeepPlan}
        onProceedToCancel={handleProceedToCancel}
        currentPrice="$37"
        futurePrice="$67"
      />
      
      <CancellationFeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        onSubmitAndCancel={handleCancelWithFeedback}
        isSubmitting={isSubmittingCancel}
      />
    </div>
  )
}