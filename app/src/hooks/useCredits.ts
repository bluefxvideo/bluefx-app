'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/app/supabase/client'
import { useEffect, useCallback } from 'react'

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

  // FastSpring event handler
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

  // Set up FastSpring event listeners
  useEffect(() => {
    console.log('Setting up FastSpring event listeners')
    
    document.addEventListener('fastspring-purchase-complete', handleFastSpringPurchase)
    
    return () => {
      console.log('Removing FastSpring event listeners')
      document.removeEventListener('fastspring-purchase-complete', handleFastSpringPurchase)
    }
  }, [handleFastSpringPurchase])

  // Set up real-time subscription for server-side updates
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    
    const setupRealTimeSubscription = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error || !user) {
          console.log('No user found for real-time subscription')
          return
        }

        console.log('Setting up real-time credit updates for user:', user.id)

        channel = supabase
          .channel('user-credits-updates')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'user_credits',
              filter: `user_id=eq.${user.id}`
            },
            (payload) => {
              console.log('Real-time credit update received:', payload)
              // Invalidate and refetch when credits change on server
              queryClient.invalidateQueries({ queryKey: ['user-credits'] })
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',  
              table: 'user_credits',
              filter: `user_id=eq.${user.id}`
            },
            (payload) => {
              console.log('Real-time credit insert received:', payload)
              queryClient.invalidateQueries({ queryKey: ['user-credits'] })
            }
          )
          .subscribe((status) => {
            console.log('Real-time subscription status:', status)
          })
      } catch (error) {
        console.error('Error setting up real-time subscription:', error)
      }
    }

    setupRealTimeSubscription()

    return () => {
      if (channel) {
        console.log('Removing real-time credit subscription')
        supabase.removeChannel(channel)
      }
    }
  }, [queryClient, supabase])

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