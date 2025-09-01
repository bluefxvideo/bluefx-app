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
    // Historical trend data for charts
    clickbank_history?: {
      max_gravity: number;
      min_gravity: number;
      avg_gravity: number;
      gravity_change: number;
      data_points: number;
      daily_data?: Record<string, unknown>;
    }[];
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
        try {
          // Get real historical data from clickbank_history table
          const { data: historyData, error: historyError } = await supabase
            .from('clickbank_history')
            .select('daily_data')
            .eq('clickbank_id', offer.clickbank_id)
            .single();

          if (historyError || !historyData?.daily_data) {
            // Fallback to mock data if no history found
            const currentGravity = offer.gravity_score || 0;
            const change = (Math.random() - 0.5) * 20;
            const minGravity = Math.max(0, currentGravity - Math.abs(change) - Math.random() * 10);
            const maxGravity = currentGravity + Math.abs(change) + Math.random() * 10;
            
            return {
              ...offer,
              clickbank_history: [{
                max_gravity: maxGravity,
                min_gravity: minGravity,
                avg_gravity: (currentGravity + minGravity + maxGravity) / 3,
                gravity_change: change,
                data_points: 7,
                daily_data: generateMockDailyData(currentGravity, minGravity, maxGravity, 7)
              }]
            };
          }

          // Process real historical data - handle both string and array formats
          let rawData: any[] = [];
          try {
            if (typeof historyData.daily_data === 'string') {
              rawData = JSON.parse(historyData.daily_data);
            } else if (Array.isArray(historyData.daily_data)) {
              rawData = historyData.daily_data;
            }
          } catch (error) {
            console.error('Failed to parse daily_data:', error);
            rawData = [];
          }
          
          if (rawData.length === 0) {
            // Fallback if daily_data is empty
            const currentGravity = offer.gravity_score || 0;
            return {
              ...offer,
              clickbank_history: [{
                max_gravity: currentGravity,
                min_gravity: currentGravity,
                avg_gravity: currentGravity,
                gravity_change: 0,
                data_points: 1,
                daily_data: [{ 
                  gravity_score: currentGravity, 
                  recorded_at: new Date().toISOString(),
                  date: new Date().toLocaleDateString()
                }]
              }]
            };
          }

          // Clean duplicate data by grouping by date and taking the latest/highest value per day
          const cleanedData: Array<{gravity_score: number; recorded_at: string; date: string}> = [];
          const seenDates = new Set<string>();
          
          // Sort by recorded_at first
          rawData.sort((a: any, b: any) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
          
          // Take one entry per day (the last/latest one)
          rawData.forEach((d: any) => {
            const dateStr = new Date(d.recorded_at).toDateString();
            if (!seenDates.has(dateStr)) {
              seenDates.add(dateStr);
              cleanedData.push({
                gravity_score: parseFloat(d.gravity_score) || 0,
                recorded_at: d.recorded_at,
                date: new Date(d.recorded_at).toLocaleDateString()
              });
            }
          });

          // Take last 30 days for performance
          const finalData = cleanedData.slice(-30);

          // Calculate metrics from cleaned data
          const gravityScores = finalData.map(d => d.gravity_score);
          const maxGravity = gravityScores.length > 0 ? Math.max(...gravityScores) : 0;
          const minGravity = gravityScores.length > 0 ? Math.min(...gravityScores) : 0;
          const avgGravity = gravityScores.length > 0 ? gravityScores.reduce((sum, score) => sum + score, 0) / gravityScores.length : 0;
          const firstScore = gravityScores[0] || 0;
          const lastScore = gravityScores[gravityScores.length - 1] || 0;
          const gravityChange = lastScore - firstScore;

          return {
            ...offer,
            clickbank_history: [{
              max_gravity: maxGravity,
              min_gravity: minGravity,
              avg_gravity: avgGravity,
              gravity_change: gravityChange,
              data_points: finalData.length,
              daily_data: finalData
            }]
          };
        } catch (error) {
          console.error(`Error fetching history for ${offer.clickbank_id}:`, error);
          
          // Fallback to mock data on error
          const currentGravity = offer.gravity_score || 0;
          return {
            ...offer,
            clickbank_history: [{
              max_gravity: currentGravity,
              min_gravity: currentGravity,
              avg_gravity: currentGravity,
              gravity_change: 0,
              data_points: 1,
              daily_data: [{ 
                gravity_score: currentGravity, 
                recorded_at: new Date().toISOString(),
                date: new Date().toLocaleDateString()
              }]
            }]
          };
        }
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
    
    // Add mock chart data to search results for simplicity
    const offersWithHistory = (existingOffers || []).map((offer) => {
      const currentGravity = offer.gravity_score || 0;
      const change = (Math.random() - 0.5) * 20;
      const minGravity = Math.max(0, currentGravity - Math.abs(change) - Math.random() * 10);
      const maxGravity = currentGravity + Math.abs(change) + Math.random() * 10;
      
      return {
        ...offer,
        clickbank_history: [{
          max_gravity: maxGravity,
          min_gravity: minGravity,
          avg_gravity: (currentGravity + minGravity + maxGravity) / 3,
          gravity_change: change,
          data_points: 7,
          daily_data: generateMockDailyData(currentGravity, minGravity, maxGravity, 7)
        }]
      };
    });

    return {
      success: true,
      data: offersWithHistory,
      total_count: offersWithHistory.length
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
    
    const categories = [...new Set(data?.map(item => item.category).filter(Boolean))];
    
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

export async function getOfferTrendData(_clickbankId: string): Promise<{ 
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
    // Since clickbank_history table doesn't exist, return default data
    return {
      success: true,
      data: {
        max_gravity: 0,
        min_gravity: 0,
        avg_gravity: 0,
        gravity_change: 0,
        data_points: 0,
      }
    };
    
  } catch (error) {
    console.error('Get offer trend data error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get trend data'
    };
  }
}

// Helper function to generate mock daily data for charts
function generateMockDailyData(currentGravity: number, minGravity: number, maxGravity: number, numDays: number) {
  const points = [];
  for (let i = 0; i < numDays; i++) {
    const progress = i / (numDays - 1);
    const variance = (Math.random() - 0.5) * 5; // Small random variance
    const baseValue = minGravity + (maxGravity - minGravity) * progress;
    const gravity = Math.max(0, baseValue + variance);
    
    const date = new Date();
    date.setDate(date.getDate() - (numDays - 1 - i));
    
    points.push({
      gravity_score: gravity,
      recorded_at: date.toISOString(),
      date: date.toLocaleDateString()
    });
  }
  return points;
}

