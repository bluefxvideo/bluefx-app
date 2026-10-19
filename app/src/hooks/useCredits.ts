'use client'

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { createClient } from '@/app/supabase/client'
import { useEffect, useCallback, useRef } from 'react'

interface UserCredits {
  available_credits: number
  total_credits: number
}

interface FastSpringPurchaseEvent {
  detail?: {
    order?: {
      items?: Array<{
        product?: string
      }>
    }
  }
}

// FastSpring product ID to credit amount mapping
const CREDIT_PACKAGES: Record<string, number> = {
  'ai-credit-pack-100': 100,
  'ai-credit-pack-500': 500,
  'ai-credit-pack-1000': 1000,
  'ai-credit-pack-2500': 2500,
  'ai-credit-pack-5000': 5000,
}

/*
 * Page-wide credit upkeep, shared by every component on the page that uses this hook (the sidebar alone renders
 * twice, and most tool pages add their own). Until 2026-10-19 each component ran it separately: every page load
 * sent 6-8 self-heal requests, and each component re-opened the live channel. supabase.channel() hands back the
 * same channel for the same name, so the first component to unmount also cut live updates for all the others.
 */

// Self-heal lapsed credit periods once per page load, then at most every 5 minutes while the person moves between
// pages. Webhook renewals and crons cannot be relied on (lifetime plans have NO renewal webhooks at all), so the
// server re-grants the monthly allotment lazily; without this, a user returning after 30+ days away would stare
// at a stale zero until they ran a tool.
const ENSURE_EVERY_MS = 5 * 60 * 1000
let lastEnsureAt = 0

function ensureCreditPeriod(queryClient: QueryClient) {
  const now = Date.now()
  if (now - lastEnsureAt < ENSURE_EVERY_MS) return
  lastEnsureAt = now
  fetch('/api/credits/ensure', { method: 'POST' })
    .then((res) => {
      if (res.ok) queryClient.invalidateQueries({ queryKey: ['user-credits'] })
    })
    .catch(() => { /* non-blocking: display-only self-heal */ })
}

// Live balance: one channel per page while anything on it shows credits, plus a backstop refresh in case the
// websocket drops.
const BACKSTOP_EVERY_MS = 60 * 1000

function startLiveCredits(queryClient: QueryClient): () => void {
  const supabase = createClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['user-credits'] })
  let channel: ReturnType<typeof supabase.channel> | null = null

  const listen = (userId: string) => {
    if (channel) return
    channel = supabase
      .channel(`user-credits-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_credits', filter: `user_id=eq.${userId}` },
        (payload) => {
          // Show the new balance at once when the change carries it, then confirm it with a fresh read (which also
          // replaces a read that was already on its way with the old number).
          const row = payload.new as Partial<UserCredits> | undefined
          const available = row?.available_credits
          if (typeof available === 'number') {
            queryClient.setQueryData<UserCredits>(['user-credits'], (old) => ({
              available_credits: available,
              total_credits: typeof row?.total_credits === 'number' ? row.total_credits : old?.total_credits ?? 0,
            }))
          }
          refresh()
        }
      )
      .subscribe()
  }

  // The first event carries the stored session, so the channel needs no extra sign-in check. A session that only
  // arrives later (right after signing in) starts the channel then, and reloads the balance that failed without
  // it. Deferred: a Supabase call made inside this callback can wait on the auth lock the callback runs under.
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (!session?.user) return
    listen(session.user.id)
    if (event === 'SIGNED_IN') setTimeout(refresh, 0)
  })

  const backstop = setInterval(() => {
    if (document.visibilityState === 'visible') refresh()
  }, BACKSTOP_EVERY_MS)

  return () => {
    clearInterval(backstop)
    subscription.unsubscribe()
    if (channel) supabase.removeChannel(channel)
  }
}

let live: { users: number; stop: () => void; stopTimer?: ReturnType<typeof setTimeout> } | null = null

function joinLiveCredits(queryClient: QueryClient) {
  if (!live) {
    live = { users: 1, stop: startLiveCredits(queryClient) }
    return
  }
  live.users += 1
  if (live.stopTimer) {
    clearTimeout(live.stopTimer)
    live.stopTimer = undefined
  }
}

// The last component to leave stops the channel a moment later, so the remount right after hydration, or a page
// swapping for another, keeps the same channel instead of closing and reopening it.
function leaveLiveCredits() {
  const current = live
  if (!current) return
  current.users -= 1
  if (current.users > 0) return
  current.stopTimer = setTimeout(() => {
    if (live !== current || current.users > 0) return
    current.stop()
    live = null
  }, 1000)
}

export function useCredits() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Query for user credits
  const {
    data: credits,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['user-credits'],
    queryFn: async (): Promise<UserCredits> => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await supabase
        .from('user_credits')
        .select('available_credits, total_credits')
        .eq('user_id', user.id)
        .single()

      if (error) {
        // If no credits record exists, return default values
        if (error.code === 'PGRST116') {
          return { available_credits: 0, total_credits: 0 }
        }
        throw error
      }
      
      return {
        available_credits: data?.available_credits ?? 0,
        total_credits: data?.total_credits ?? 0
      }
    },
    staleTime: 30 * 1000, // 30 seconds
    retry: 2,
    refetchOnWindowFocus: false
  })

  // Mutation for credit purchases (optimistic)
  const purchaseCreditsMutation = useMutation({
    mutationFn: async (creditAmount: number) => {
      // This is mainly for the optimistic update
      // The actual credit addition happens via FastSpring webhook
      return { creditAmount, timestamp: Date.now() }
    },
    onMutate: async (creditAmount: number) => {
      // Cancel outgoing refetches to prevent overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['user-credits'] })

      // Snapshot previous credits
      const previousCredits = queryClient.getQueryData<UserCredits>(['user-credits'])

      // Optimistically update credits
      if (previousCredits) {
        queryClient.setQueryData<UserCredits>(['user-credits'], {
          ...previousCredits,
          available_credits: previousCredits.available_credits + creditAmount
        })
      }

      // Return context for rollback
      return { previousCredits, creditAmount }
    },
    onError: (error, creditAmount, context) => {
      // Rollback on error
      if (context?.previousCredits) {
        queryClient.setQueryData(['user-credits'], context.previousCredits)
      }
      console.error('Credit purchase failed:', error)
    },
    onSettled: () => {
      // Refetch after a delay to ensure webhook has processed
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['user-credits'] })
      }, 2000)
    }
  })

  // Handle credit deduction (for tool usage)
  const deductCreditsMutation = useMutation({
    mutationFn: async ({ credits: creditAmount, service }: { credits: number, service: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Call your existing credit deduction endpoint
      const response = await fetch('/api/credits/deduct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          credits: creditAmount,
          service_type: service
        })
      })

      if (!response.ok) {
        throw new Error('Failed to deduct credits')
      }

      return await response.json()
    },
    onMutate: async ({ credits: creditAmount }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['user-credits'] })

      // Snapshot previous credits
      const previousCredits = queryClient.getQueryData<UserCredits>(['user-credits'])

      // Optimistically deduct credits
      if (previousCredits) {
        queryClient.setQueryData<UserCredits>(['user-credits'], {
          ...previousCredits,
          available_credits: Math.max(0, previousCredits.available_credits - creditAmount)
        })
      }

      return { previousCredits, creditAmount }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousCredits) {
        queryClient.setQueryData(['user-credits'], context.previousCredits)
      }
      console.error('Credit deduction failed:', error)
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['user-credits'] })
    }
  })

  // FastSpring event handler - use ref to avoid effect re-runs
  const handleFastSpringPurchase = useCallback((event: Event) => {
    const customEvent = event as CustomEvent<FastSpringPurchaseEvent['detail']>
    const productId = customEvent.detail?.order?.items?.[0]?.product

    console.log('FastSpring purchase event received:', { productId, event: customEvent.detail })

    if (productId && CREDIT_PACKAGES[productId]) {
      const creditAmount = CREDIT_PACKAGES[productId]
      console.log(`Processing credit purchase: ${creditAmount} credits for product ${productId}`)

      // Trigger optimistic update
      purchaseCreditsMutation.mutate(creditAmount)
    } else {
      console.warn('Unknown product ID or not a credit package:', productId)
    }
  }, [purchaseCreditsMutation])

  // Store handler in ref to avoid effect re-runs when callback changes
  const fastSpringHandlerRef = useRef(handleFastSpringPurchase)
  fastSpringHandlerRef.current = handleFastSpringPurchase

  // Set up FastSpring event listeners (runs once, uses ref for stable handler)
  useEffect(() => {
    const handler = (e: Event) => fastSpringHandlerRef.current(e)

    document.addEventListener('fastspring-purchase-complete', handler)

    return () => {
      document.removeEventListener('fastspring-purchase-complete', handler)
    }
  }, []) // Empty deps - only runs once

  // The page-wide self-heal and live balance (above): shared, so they run once however many components use this.
  useEffect(() => {
    ensureCreditPeriod(queryClient)
    joinLiveCredits(queryClient)
    return leaveLiveCredits
  }, [queryClient])

  return {
    credits,
    isLoading,
    error,
    refetch,
    isPurchasing: purchaseCreditsMutation.isPending,
    isDeducting: deductCreditsMutation.isPending,
    purchaseCredits: purchaseCreditsMutation.mutate,
    deductCredits: deductCreditsMutation.mutate,
    // Helper functions
    hasEnoughCredits: (required: number) => {
      return (credits?.available_credits || 0) >= required
    },
    getCreditBalance: () => credits?.available_credits || 0
  }
}