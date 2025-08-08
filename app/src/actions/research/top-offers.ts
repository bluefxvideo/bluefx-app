'use server';

import { createClient } from '@/app/supabase/server';

export interface TopOffersRequest {
  category?: string;
  sort_by?: 'gravity_score' | 'commission_rate' | 'average_dollar_per_sale';
  min_gravity?: number;
  limit?: number;
  offset?: number;
  include_inactive?: boolean;
}

export interface OfferSearchRequest {
  query: string;
  filters?: {
    min_commission?: number;
    max_refund_rate?: number;
    has_recurring?: boolean;
  };
}

export interface TopOffersResponse {
  success: boolean;
  data?: Array<{
    id: string;
    clickbank_id: string;
    title: string;
    description: string | null;
    category: string;
    subcategory: string | null;
    vendor_name: string;
    gravity_score: number;
    commission_rate: number | null;
    average_dollar_per_sale: number | null;
    initial_dollar_per_sale: number | null;
    refund_rate: number | null;
    has_recurring_products: boolean | null;
    mobile_optimized: boolean | null;
    affiliate_page_url: string | null;
    sales_page_url: string | null;
    is_active: boolean | null;
    created_at: string | null;
  }>;
  total_count?: number;
  error?: string;
}

export async function getTopOffers(
  request: TopOffersRequest = {}
): Promise<TopOffersResponse> {
  try {
    const supabase = await createClient();
    
    // Get total count first
    let countQuery = supabase
      .from('clickbank_offers')
      .select('*', { count: 'exact', head: true });
    
    // Apply same filters to count query
    if (request.category) {
      countQuery = countQuery.eq('category', request.category);
    }
    
    if (!request.include_inactive) {
      countQuery = countQuery.eq('is_active', true);
    }
    
    if (request.min_gravity) {
      countQuery = countQuery.gte('gravity_score', request.min_gravity);
    }
    
    const { count, error: countError } = await countQuery;
    
    if (countError) {
      console.error('Count error:', countError);
    }
    
    // Get actual data
    let query = supabase
      .from('clickbank_offers')
      .select('*');
    
    // Apply filters
    if (request.category) {
      query = query.eq('category', request.category);
    }
    
    if (!request.include_inactive) {
      query = query.eq('is_active', true);
    }
    
    if (request.min_gravity) {
      query = query.gte('gravity_score', request.min_gravity);
    }
    
    // Apply sorting
    const sortBy = request.sort_by || 'gravity_score';
    query = query.order(sortBy, { ascending: false });
    
    // Apply pagination
    const limit = request.limit || 50;
    if (request.offset && request.offset > 0) {
      query = query.range(request.offset, request.offset + limit - 1);
    } else {
      query = query.limit(limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Get top offers error:', error);
      return {
        success: false,
        error: 'Failed to fetch top offers'
      };
    }
    
    // Get historical data for each offer
    const offersWithHistory = await Promise.all(
      (data || []).map(async (offer) => {
        const { data: historyData } = await supabase
          .from('clickbank_history')
          .select('max_gravity, min_gravity, avg_gravity, gravity_change, data_points, daily_data')
          .eq('clickbank_id', offer.clickbank_id)
          .single();
        
        return {
          ...offer,
          clickbank_history: historyData ? [{
            max_gravity: parseFloat(historyData.max_gravity) || 0,
            min_gravity: parseFloat(historyData.min_gravity) || 0,
            avg_gravity: parseFloat(historyData.avg_gravity) || 0,
            gravity_change: parseFloat(historyData.gravity_change) || 0,
            data_points: historyData.data_points || 0,
            daily_data: historyData.daily_data
          }] : null
        };
      })
    );

    return {
      success: true,
      data: offersWithHistory,
      total_count: count || 0
    };
    
  } catch (error) {
    console.error('Top offers error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function searchOffers(
  query: string
): Promise<TopOffersResponse> {
  try {
    const supabase = await createClient();
    
    // Search in existing offers first
    const { data: existingOffers, error: searchError } = await supabase
      .from('clickbank_offers')
      .select('*')
      .or(`title.ilike.%${query}%,description.ilike.%${query}%,vendor_name.ilike.%${query}%,category.ilike.%${query}%`)
      .eq('is_active', true)
      .order('gravity_score', { ascending: false })
      .limit(20);
    
    if (searchError) {
      console.error('Offer search error:', searchError);
      return {
        success: false,
        error: 'Search failed'
      };
    }
    
    return {
      success: true,
      data: existingOffers || [],
      total_count: existingOffers?.length || 0
    };
    
  } catch (error) {
    console.error('Search offers error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Search failed'
    };
  }
}

export async function getOfferCategories(): Promise<{ success: boolean; data?: string[]; error?: string }> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('clickbank_offers')
      .select('category')
      .eq('is_active', true);
    
    if (error) {
      return {
        success: false,
        error: 'Failed to fetch categories'
      };
    }
    
    const categories = [...new Set(data?.map(item => item.category).filter(Boolean))] || [];
    
    return {
      success: true,
      data: categories
    };
    
  } catch (error) {
    console.error('Get offer categories error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch categories'
    };
  }
}

export async function getOfferTrendData(clickbankId: string): Promise<{ 
  success: boolean; 
  data?: { 
    max_gravity: number;
    min_gravity: number;
    avg_gravity: number;
    gravity_change: number;
    data_points: number;
  }; 
  error?: string 
}> {
  try {
    const supabase = await createClient();
    
    const { data, error } = await supabase
      .from('clickbank_history')
      .select('max_gravity, min_gravity, avg_gravity, gravity_change, data_points')
      .eq('clickbank_id', clickbankId)
      .single();
    
    if (error && error.code !== 'PGRST116') {
      return {
        success: false,
        error: 'Failed to fetch trend data'
      };
    }
    
    return {
      success: true,
      data: data || undefined
    };
    
  } catch (error) {
    console.error('Get offer trend data error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch trend data'
    };
  }
}

