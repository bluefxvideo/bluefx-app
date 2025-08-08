'use server';

import { createClient } from '@/app/supabase/server';

export interface TrendingKeywordsRequest {
  category?: string;
  sort_by?: 'search_volume' | 'difficulty_score' | 'cost_per_click';
  limit?: number;
  include_inactive?: boolean;
}

export interface KeywordSearchRequest {
  query: string;
  include_suggestions?: boolean;
}

export interface AddKeywordRequest {
  keyword: string;
  category?: string;
  target_rank?: number;
  target_page_url?: string;
  user_id: string;
}

export interface TrendingKeywordsResponse {
  success: boolean;
  data?: Array<{
    id: string;
    keyword: string;
    search_volume: number | null;
    difficulty_score: number | null;
    competition_level: string | null;
    cost_per_click: number | null;
    current_rank: number | null;
    target_rank: number | null;
    category: string | null;
    is_active: boolean | null;
    last_checked_at: string | null;
    created_at: string | null;
    updated_at: string | null;
  }>;
  total_count?: number;
  error?: string;
}

export async function getTrendingKeywords(
  request: TrendingKeywordsRequest = {}
): Promise<TrendingKeywordsResponse> {
  try {
    const supabase = await createClient();
    
    let query = supabase
      .from('keywords')
      .select('*');
    
    // Apply filters
    if (request.category) {
      query = query.eq('category', request.category);
    }
    
    if (!request.include_inactive) {
      query = query.eq('is_active', true);
    }
    
    // Apply sorting
    const sortBy = request.sort_by || 'search_volume';
    query = query.order(sortBy, { ascending: false });
    
    // Apply limit
    if (request.limit) {
      query = query.limit(request.limit);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Get trending keywords error:', error);
      return {
        success: false,
        error: 'Failed to fetch trending keywords'
      };
    }
    
    return {
      success: true,
      data: data || [],
      total_count: data?.length || 0
    };
    
  } catch (error) {
    console.error('Trending keywords error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function searchKeywords(
  query: string
): Promise<TrendingKeywordsResponse> {
  try {
    const supabase = await createClient();
    
    // Search in existing keywords first
    const { data: existingKeywords, error: searchError } = await supabase
      .from('keywords')
      .select('*')
      .ilike('keyword', `%${query}%`)
      .eq('is_active', true)
      .order('search_volume', { ascending: false, nullsLast: true })
      .limit(20);
    
    if (searchError) {
      console.error('Keyword search error:', searchError);
      return {
        success: false,
        error: 'Search failed'
      };
    }
    
    // If we have existing data, return it
    if (existingKeywords && existingKeywords.length > 0) {
      return {
        success: true,
        data: existingKeywords,
        total_count: existingKeywords.length
      };
    }
    
    // TODO: Integrate with external keyword research APIs
    // For now, return mock data to demonstrate functionality
    const mockKeywords = await generateMockKeywords(query);
    
    return {
      success: true,
      data: mockKeywords,
      total_count: mockKeywords.length
    };
    
  } catch (error) {
    console.error('Search keywords error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Search failed'
    };
  }
}

export async function addKeyword(
  request: AddKeywordRequest
): Promise<{ success: boolean; error?: string; keyword_id?: string }> {
  try {
    const supabase = await createClient();
    
    // Check if keyword already exists
    const { data: existing } = await supabase
      .from('keywords')
      .select('id')
      .eq('keyword', request.keyword.toLowerCase())
      .single();
    
    if (existing) {
      return {
        success: false,
        error: 'Keyword already exists'
      };
    }
    
    // Insert new keyword
    const { data, error } = await supabase
      .from('keywords')
      .insert({
        keyword: request.keyword.toLowerCase(),
        category: request.category,
        target_rank: request.target_rank,
        target_page_url: request.target_page_url,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('Add keyword error:', error);
      return {
        success: false,
        error: 'Failed to add keyword'
      };
    }
    
    return {
      success: true,
      keyword_id: data.id
    };
    
  } catch (error) {
    console.error('Add keyword error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add keyword'
    };
  }
}

async function generateMockKeywords(query: string) {
  // Generate mock trending keywords based on search query
  const baseKeywords = [
    `${query} trends 2025`,
    `how to ${query}`,
    `${query} tips`,
    `best ${query} tools`,
    `${query} for beginners`,
    `${query} strategy`,
    `${query} guide`,
    `${query} tutorial`,
    `${query} examples`,
    `${query} software`
  ];
  
  return baseKeywords.map((keyword, index) => ({
    id: `mock-${Date.now()}-${index}`,
    keyword,
    search_volume: Math.floor(Math.random() * 50000) + 1000,
    difficulty_score: Math.floor(Math.random() * 100),
    competition_level: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
    cost_per_click: Math.random() * 5 + 0.5,
    current_rank: null,
    target_rank: null,
    category: 'technology',
    is_active: true,
    last_checked_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));
}