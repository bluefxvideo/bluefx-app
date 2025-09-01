'use server';

export interface ViralTrendsRequest {
  platform?: string;
  category?: string;
  limit?: number;
  min_viral_score?: number;
}

export interface TrendSearchRequest {
  query: string;
  platforms?: string[];
}

export interface ViralTrendsResponse {
  success: boolean;
  data?: Array<{
    id: string;
    content: string;
    platform: string;
    hashtags: string[];
    engagement_score: number;
    viral_potential: number;
    trend_strength: number;
    category: string;
    source_url?: string;
    created_at: string;
  }>;
  total_count?: number;
  error?: string;
}

export async function getViralTrends(
  request: ViralTrendsRequest = {}
): Promise<ViralTrendsResponse> {
  try {
    const youtubeData = await fetchYouTubeTrends(request);
    
    return {
      success: true,
      data: youtubeData,
      total_count: youtubeData.length
    };
    
  } catch (error) {
    console.error('Get viral trends error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch viral trends'
    };
  }
}

export async function searchTrends(
  query: string
): Promise<ViralTrendsResponse> {
  try {
    const youtubeData = await searchYouTubeVideos(query);
    
    return {
      success: true,
      data: youtubeData,
      total_count: youtubeData.length
    };
    
  } catch (error) {
    console.error('Search trends error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Search failed'
    };
  }
}

export async function analyzeTrendPotential(
  _content: string
): Promise<{ success: boolean; viral_score?: number; recommendations?: string[]; error?: string }> {
  try {
    // TODO: Implement AI-powered viral potential analysis
    // For now, return mock analysis
    const viral_score = Math.floor(Math.random() * 40) + 60; // 60-100 range
    
    const recommendations = [
      'Add more trending hashtags',
      'Include call-to-action',
      'Optimize for mobile viewing',
      'Use current trending music',
      'Add interactive elements'
    ];
    
    return {
      success: true,
      viral_score,
      recommendations: recommendations.slice(0, 3)
    };
    
  } catch (error) {
    console.error('Analyze trend potential error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Analysis failed'
    };
  }
}

async function generateMockViralTrends(request: ViralTrendsRequest) {
  const platforms = ['tiktok', 'instagram', 'twitter', 'youtube'];
  
  const trendTemplates = [
    {
      content: "AI is changing everything in 2025",
      hashtags: ['AI2025', 'TechTrends', 'Innovation', 'FutureNow'],
      category: 'technology'
    },
    {
      content: "10-second morning routine that changed my life",
      hashtags: ['MorningRoutine', 'Productivity', 'LifeHacks', 'Wellness'],
      category: 'lifestyle'
    },
    {
      content: "This marketing strategy got 1M views in 24 hours",
      hashtags: ['Marketing', 'Viral', 'Growth', 'Business'],
      category: 'business'
    },
    {
      content: "Dancing trend taking over social media",
      hashtags: ['Dance', 'Viral', 'Trending', 'Fun'],
      category: 'entertainment'
    },
    {
      content: "Free online course teaching valuable skills",
      hashtags: ['Education', 'Learning', 'Free', 'Skills'],
      category: 'education'
    }
  ];
  
  return trendTemplates.map((template, index) => ({
    id: `viral-${Date.now()}-${index}`,
    content: template.content,
    platform: platforms[index % platforms.length],
    hashtags: template.hashtags,
    engagement_score: Math.floor(Math.random() * 1000000) + 50000,
    viral_potential: Math.floor(Math.random() * 40) + 60,
    trend_strength: Math.floor(Math.random() * 30) + 70,
    category: template.category,
    source_url: `https://example.com/trend-${index}`,
    created_at: new Date().toISOString()
  })).filter(trend => {
    if (request.platform && trend.platform !== request.platform) return false;
    if (request.category && trend.category !== request.category) return false;
    if (request.min_viral_score && trend.viral_potential < request.min_viral_score) return false;
    return true;
  }).slice(0, request.limit || 50);
}

async function generateSearchMockTrends(query: string) {
  const platforms = ['tiktok', 'instagram', 'twitter', 'youtube'];
  
  const searchResults = [
    `${query} explained in 60 seconds`,
    `Why everyone is talking about ${query}`,
    `${query} trend you need to know`,
    `The truth about ${query}`,
    `${query} is everywhere right now`,
    `How ${query} went viral`,
    `${query} challenge taking over`,
    `Everyone is doing ${query} wrong`
  ];
  
  return searchResults.map((content, index) => ({
    id: `search-${Date.now()}-${index}`,
    content,
    platform: platforms[index % platforms.length],
    hashtags: [query, 'Viral', 'Trending', 'MustWatch'],
    engagement_score: Math.floor(Math.random() * 500000) + 100000,
    viral_potential: Math.floor(Math.random() * 30) + 70,
    trend_strength: Math.floor(Math.random() * 25) + 75,
    category: 'trending',
    source_url: `https://example.com/search-${index}`,
    created_at: new Date().toISOString()
  }));
}

// Real YouTube API integration
async function fetchYouTubeTrends(request: ViralTrendsRequest) {
  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
  
  if (!YOUTUBE_API_KEY) {
    console.warn('YOUTUBE_API_KEY not found, using mock data');
    return generateMockViralTrends(request);
  }

  try {
    // Get trending videos from YouTube API
    const categoryId = getCategoryId(request.category);
    const maxResults = Math.min(request.limit || 50, 50); // YouTube API limit
    
    const url = `https://www.googleapis.com/youtube/v3/videos?` +
      `part=snippet,statistics,contentDetails&` +
      `chart=mostPopular&` +
      `maxResults=${maxResults}&` +
      `regionCode=US&` +
      `${categoryId ? `videoCategoryId=${categoryId}&` : ''}` +
      `key=${YOUTUBE_API_KEY}`;

    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('YouTube API error:', response.status, response.statusText);
      return generateMockViralTrends(request);
    }

    const data = await response.json();
    
    return data.items?.map((video: any) => ({
      id: video.id,
      content: video.snippet.title,
      platform: 'youtube',
      hashtags: extractHashtags(video.snippet.description || ''),
      engagement_score: parseInt(video.statistics.viewCount || '0'),
      viral_potential: calculateViralPotential(video.statistics),
      trend_strength: calculateTrendStrength(video.statistics),
      category: getCategoryName(video.snippet.categoryId),
      source_url: `https://www.youtube.com/watch?v=${video.id}`,
      created_at: video.snippet.publishedAt,
      views: formatNumber(video.statistics.viewCount),
      likes: formatNumber(video.statistics.likeCount),
      comments: formatNumber(video.statistics.commentCount),
      duration: formatDuration(video.contentDetails.duration),
      creator: video.snippet.channelTitle,
      thumbnail: video.snippet.thumbnails?.maxresdefault?.url || video.snippet.thumbnails?.high?.url
    })) || [];
    
  } catch (error) {
    console.error('YouTube API fetch error:', error);
    return generateMockViralTrends(request);
  }
}

async function searchYouTubeVideos(query: string) {
  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
  
  if (!YOUTUBE_API_KEY) {
    console.warn('YOUTUBE_API_KEY not found, using mock data');
    return generateSearchMockTrends(query);
  }

  try {
    // Search for videos using YouTube API
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?` +
      `part=snippet&` +
      `q=${encodeURIComponent(query)}&` +
      `type=video&` +
      `order=relevance&` +
      `maxResults=25&` +
      `key=${YOUTUBE_API_KEY}`;

    const searchResponse = await fetch(searchUrl);
    
    if (!searchResponse.ok) {
      console.error('YouTube Search API error:', searchResponse.status);
      return generateSearchMockTrends(query);
    }

    const searchData = await searchResponse.json();
    const videoIds = searchData.items?.map((item: any) => item.id.videoId).join(',');
    
    if (!videoIds) {
      return [];
    }

    // Get detailed video information
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?` +
      `part=snippet,statistics,contentDetails&` +
      `id=${videoIds}&` +
      `key=${YOUTUBE_API_KEY}`;

    const detailsResponse = await fetch(detailsUrl);
    const detailsData = await detailsResponse.json();
    
    return detailsData.items?.map((video: any) => ({
      id: video.id,
      content: video.snippet.title,
      platform: 'youtube',
      hashtags: extractHashtags(video.snippet.description || '').concat([query]),
      engagement_score: parseInt(video.statistics.viewCount || '0'),
      viral_potential: calculateViralPotential(video.statistics),
      trend_strength: calculateTrendStrength(video.statistics),
      category: getCategoryName(video.snippet.categoryId),
      source_url: `https://www.youtube.com/watch?v=${video.id}`,
      created_at: video.snippet.publishedAt,
      views: formatNumber(video.statistics.viewCount),
      likes: formatNumber(video.statistics.likeCount),
      comments: formatNumber(video.statistics.commentCount),
      duration: formatDuration(video.contentDetails.duration),
      creator: video.snippet.channelTitle,
      thumbnail: video.snippet.thumbnails?.maxresdefault?.url || video.snippet.thumbnails?.high?.url
    })) || [];
    
  } catch (error) {
    console.error('YouTube Search API error:', error);
    return generateSearchMockTrends(query);
  }
}

// Helper functions
function getCategoryId(category?: string): string | null {
  const categoryMap: Record<string, string> = {
    'entertainment': '24',
    'business': '28',
    'technology': '28',
    'lifestyle': '26',
    'education': '27',
    'news': '25',
    'music': '10',
    'gaming': '20',
    'sports': '17'
  };
  return category ? categoryMap[category.toLowerCase()] || null : null;
}

function getCategoryName(categoryId: string): string {
  const categoryMap: Record<string, string> = {
    '1': 'Film & Animation',
    '2': 'Autos & Vehicles',
    '10': 'Music',
    '15': 'Pets & Animals',
    '17': 'Sports',
    '19': 'Travel & Events',
    '20': 'Gaming',
    '22': 'People & Blogs',
    '23': 'Comedy',
    '24': 'Entertainment',
    '25': 'News & Politics',
    '26': 'Howto & Style',
    '27': 'Education',
    '28': 'Science & Technology'
  };
  return categoryMap[categoryId] || 'General';
}

function extractHashtags(description: string): string[] {
  const hashtagRegex = /#[\w\u0590-\u05ff]+/g;
  const hashtags = description.match(hashtagRegex) || [];
  return hashtags.map(tag => tag.substring(1)).slice(0, 5); // Remove # and limit to 5
}

function calculateViralPotential(stats: any): number {
  const views = parseInt(stats.viewCount || '0');
  const likes = parseInt(stats.likeCount || '0');
  const comments = parseInt(stats.commentCount || '0');
  
  // Calculate engagement rate and viral potential
  const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
  
  if (views > 10000000) return Math.min(95, 70 + engagementRate * 5);
  if (views > 1000000) return Math.min(85, 60 + engagementRate * 4);
  if (views > 100000) return Math.min(75, 50 + engagementRate * 3);
  if (views > 10000) return Math.min(65, 40 + engagementRate * 2);
  return Math.min(55, 30 + engagementRate);
}

function calculateTrendStrength(stats: any): number {
  const views = parseInt(stats.viewCount || '0');
  const likes = parseInt(stats.likeCount || '0');
  
  const likeRate = views > 0 ? (likes / views) * 100 : 0;
  
  if (likeRate > 5) return Math.min(95, 80 + likeRate);
  if (likeRate > 3) return Math.min(85, 70 + likeRate * 3);
  if (likeRate > 1) return Math.min(75, 60 + likeRate * 2);
  return Math.min(65, 50 + likeRate * 10);
}

function formatNumber(num: string | number): string {
  const number = typeof num === 'string' ? parseInt(num) : num;
  if (!number || number === 0) return '0';
  
  if (number >= 1000000) {
    return (number / 1000000).toFixed(1) + 'M';
  } else if (number >= 1000) {
    return (number / 1000).toFixed(1) + 'K';
  }
  return number.toString();
}

function formatDuration(duration: string): string {
  // Convert ISO 8601 duration (PT4M13S) to readable format (4:13)
  const match = duration.match(/PT(\d+M)?(\d+S)?/);
  if (!match) return '0:00';
  
  const minutes = match[1] ? parseInt(match[1].replace('M', '')) : 0;
  const seconds = match[2] ? parseInt(match[2].replace('S', '')) : 0;
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}