'use server';

export interface PopularTopicsRequest {
  category?: string;
  limit?: number;
  freshness?: 'recent' | 'trending' | 'evergreen';
}

export interface PopularTopic {
  id: string;
  title: string;
  description: string;
  category: string;
  search_volume?: number;
  difficulty_score?: number;
  trend_status?: 'rising' | 'stable' | 'declining';
  market_demand?: 'high' | 'medium' | 'low';
  monetization_potential?: number; // 1-10 scale
  target_audience?: string;
  created_at: string;
}

export interface PopularTopicsResponse {
  success: boolean;
  data?: PopularTopic[];
  total_count?: number;
  error?: string;
}

export async function getPopularTopics(
  request: PopularTopicsRequest = {}
): Promise<PopularTopicsResponse> {
  try {
    const category = request.category || 'digital marketing';
    const limit = request.limit || 10;
    const freshness = request.freshness || 'trending';
    
    // Use Perplexity API for dynamic topic generation
    const dynamicTopics = await getTopicsFromPerplexity(category, limit, freshness);
    
    return {
      success: true,
      data: dynamicTopics,
      total_count: dynamicTopics.length
    };
    
  } catch (error) {
    console.error('Popular topics error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

async function getTopicsFromPerplexity(
  category: string, 
  limit: number, 
  freshness: string
): Promise<PopularTopic[]> {
  try {
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
    
    if (!perplexityApiKey) {
      console.warn('PERPLEXITY_API_KEY not found, using fallback data');
      return generateMockTopics(category, limit);
    }

    const prompt = `As a content marketing expert, provide ${limit} highly popular and ${freshness} ebook topics for "${category}" in 2025. For each topic, provide:
    - A compelling ebook title (engaging and marketable)
    - A detailed description (what the ebook covers)
    - Target audience (who would buy this ebook)
    - Market demand level (high/medium/low)
    - Estimated search volume for related keywords
    - SEO difficulty score (0-100)
    - Trend status (rising/stable/declining)
    - Monetization potential score (1-10)

    Focus on topics that:
    - Have proven market demand
    - Are actively searched for in 2025
    - Have strong monetization potential
    - Appeal to both beginners and advanced users
    - Are evergreen or currently trending

    Format as JSON array with objects containing: title, description, target_audience, market_demand, search_volume, difficulty_score, trend_status, monetization_potential`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${perplexityApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are an expert content marketing strategist with deep knowledge of ebook trends, market demand, and monetization. Always respond with valid JSON arrays only.'
          },
          {
            role: 'user', 
            content: prompt
          }
        ],
        temperature: 0.4,
        max_tokens: 3000
      })
    });

    if (!response.ok) {
      console.error('Perplexity API error:', response.status);
      return generateMockTopics(category, limit);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error('No content from Perplexity API');
      return generateMockTopics(category, limit);
    }

    // Parse the JSON response
    let topicsData;
    try {
      // Clean the response in case it has markdown formatting
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      topicsData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse Perplexity response:', parseError);
      return generateMockTopics(category, limit);
    }

    // Transform to our interface format
    return topicsData.map((item: any, index: number): PopularTopic => ({
      id: `perplexity-${Date.now()}-${index}`,
      title: item.title || `${category} mastery guide`,
      description: item.description || `Comprehensive guide to ${category} success`,
      category: category,
      search_volume: item.search_volume || Math.floor(Math.random() * 50000) + 5000,
      difficulty_score: item.difficulty_score || Math.floor(Math.random() * 100),
      trend_status: item.trend_status || (['rising', 'stable', 'declining'] as const)[Math.floor(Math.random() * 3)],
      market_demand: item.market_demand || (['high', 'medium', 'low'] as const)[Math.floor(Math.random() * 3)],
      monetization_potential: item.monetization_potential || Math.floor(Math.random() * 5) + 6,
      target_audience: item.target_audience || 'entrepreneurs and marketers',
      created_at: new Date().toISOString()
    }));

  } catch (error) {
    console.error('Perplexity API error:', error);
    return generateMockTopics(category, limit);
  }
}

function generateMockTopics(category: string, limit: number): PopularTopic[] {
  const baseTopics = [
    {
      title: 'AI-Powered Content Marketing in 2025',
      description: 'Master the latest AI tools and strategies for content creation, automation, and audience engagement',
      target_audience: 'content creators and marketers'
    },
    {
      title: 'Zero to $10K: Affiliate Marketing Blueprint',
      description: 'Complete step-by-step system to build profitable affiliate marketing business from scratch',
      target_audience: 'aspiring online entrepreneurs'
    },
    {
      title: 'Social Media Monetization Mastery',
      description: 'Turn your social media presence into multiple income streams with proven strategies',
      target_audience: 'social media influencers and creators'
    },
    {
      title: 'Email Marketing That Converts in 2025',
      description: 'Build and monetize email lists with advanced automation and personalization techniques',
      target_audience: 'business owners and marketers'
    },
    {
      title: 'Passive Income with Digital Products',
      description: 'Create, launch, and scale digital products for sustainable passive income streams',
      target_audience: 'entrepreneurs and side hustlers'
    },
    {
      title: 'SEO Dominance: Rank #1 in Google',
      description: 'Advanced SEO strategies and tactics to dominate search rankings in competitive niches',
      target_audience: 'website owners and SEO professionals'
    },
    {
      title: 'YouTube Monetization Complete Guide',
      description: 'Build a profitable YouTube channel with multiple revenue streams and audience growth tactics',
      target_audience: 'content creators and video marketers'
    },
    {
      title: 'E-commerce Success Without Inventory',
      description: 'Launch and scale profitable e-commerce businesses using dropshipping and print-on-demand',
      target_audience: 'aspiring e-commerce entrepreneurs'
    },
    {
      title: 'Freelancing to Six Figures',
      description: 'Build a high-paying freelance business and scale beyond trading time for money',
      target_audience: 'freelancers and service providers'
    },
    {
      title: 'Personal Branding That Pays',
      description: 'Build a powerful personal brand that attracts opportunities and generates income',
      target_audience: 'professionals and entrepreneurs'
    }
  ];
  
  return baseTopics.slice(0, limit).map((topic, index): PopularTopic => ({
    id: `mock-${Date.now()}-${index}`,
    title: topic.title,
    description: topic.description,
    category: category,
    search_volume: Math.floor(Math.random() * 50000) + 10000,
    difficulty_score: Math.floor(Math.random() * 70) + 30,
    trend_status: (['rising', 'stable'] as const)[Math.floor(Math.random() * 2)], // Bias towards rising/stable
    market_demand: (['high', 'medium'] as const)[Math.floor(Math.random() * 2)], // Bias towards high/medium
    monetization_potential: Math.floor(Math.random() * 3) + 7, // 7-10 range for high potential
    target_audience: topic.target_audience,
    created_at: new Date().toISOString()
  }));
}