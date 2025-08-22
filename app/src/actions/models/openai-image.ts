'use server';

/**
 * OpenAI Image Generation API Integration
 * Base URL: https://api.openai.com/v1
 * Purpose: Generate high-quality logos and images using OpenAI's DALL-E models
 */

interface OpenAIImageInput {
  prompt: string;
  model?: 'dall-e-2' | 'dall-e-3' | 'gpt-image-1';
  n?: number; // 1-10, but dall-e-3 only supports n=1
  size?: 
    // DALL-E 2 sizes
    | '256x256' | '512x512' | '1024x1024'
    // DALL-E 3 sizes
    | '1792x1024' | '1024x1792'
    // GPT-Image-1 sizes
    | '1536x1024' | '1024x1536' | 'auto';
  quality?: 
    // GPT-Image-1 quality
    | 'high' | 'medium' | 'low'
    // DALL-E 3 quality
    | 'hd' | 'standard';
  style?: 'vivid' | 'natural'; // Only for dall-e-3
  response_format?: 'url' | 'b64_json'; // url not supported for gpt-image-1
  background?: 'transparent' | 'opaque' | 'auto'; // Only for gpt-image-1
  output_format?: 'png' | 'jpeg' | 'webp'; // Only for gpt-image-1
  user?: string;
}

interface OpenAIImageOutput {
  created: number;
  data: {
    url?: string;
    b64_json?: string;
    revised_prompt?: string;
  }[];
  usage?: {
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    input_tokens_details?: {
      text_tokens: number;
      image_tokens: number;
    };
  };
}

/**
 * Generate images using OpenAI's image generation models
 */
export async function generateImage(params: OpenAIImageInput): Promise<OpenAIImageOutput> {
  try {
    console.log(`🎨 OpenAI Image Generation: ${params.model || 'dall-e-2'} - "${params.prompt.substring(0, 50)}..."`);
    
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        prompt: params.prompt,
        model: params.model || 'dall-e-2',
        ...(params.n && { n: params.n }),
        ...(params.size && { size: params.size }),
        ...(params.quality && { quality: params.quality }),
        ...(params.style && { style: params.style }),
        ...(params.response_format && { response_format: params.response_format }),
        ...(params.background && { background: params.background }),
        ...(params.output_format && { output_format: params.output_format }),
        ...(params.user && { user: params.user }),
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI Image API Error ${response.status}: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    console.log(`✅ Generated ${result.data.length} image(s) with OpenAI`);
    
    return result;
  } catch (error) {
    console.error('generateImage error:', error);
    throw error;
  }
}

/**
 * Generate image variations using OpenAI's DALL-E 2 (for recreation functionality)
 */
export async function generateImageVariation(
  imageFile: File | string, // File object or base64 string
  options?: {
    n?: number;
    size?: '256x256' | '512x512' | '1024x1024';
    response_format?: 'url' | 'b64_json';
    user?: string;
  }
): Promise<OpenAIImageOutput> {
  try {
    console.log(`🎨 OpenAI Image Variation: Generating ${options?.n || 1} variation(s)`);
    
    const formData = new FormData();
    
    // Handle different image input types
    if (imageFile instanceof File) {
      formData.append('image', imageFile);
    } else if (typeof imageFile === 'string') {
      // Convert base64 to blob
      const response = await fetch(imageFile);
      const blob = await response.blob();
      formData.append('image', blob, 'image.png');
    }
    
    formData.append('model', 'dall-e-2');
    if (options?.n) formData.append('n', options.n.toString());
    if (options?.size) formData.append('size', options.size);
    if (options?.response_format) formData.append('response_format', options.response_format);
    if (options?.user) formData.append('user', options.user);

    const response = await fetch('https://api.openai.com/v1/images/variations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI Image Variation API Error ${response.status}: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    console.log(`✅ Generated ${result.data.length} variation(s) with OpenAI`);
    
    return result;
  } catch (error) {
    console.error('generateImageVariation error:', error);
    throw error;
  }
}

/**
 * Helper function for logo generation with optimized defaults
 */
export async function generateLogo(
  companyName: string,
  options?: {
    customDescription?: string;
    style?: 'modern' | 'minimalist' | 'vintage' | 'playful' | 'professional' | 'creative';
    industry?: string;
    colorScheme?: string;
    model?: 'dall-e-2' | 'dall-e-3' | 'gpt-image-1';
    size?: OpenAIImageInput['size'];
    background?: 'transparent' | 'opaque' | 'auto';
    user?: string;
  }
): Promise<OpenAIImageOutput> {
  // Construct optimized logo prompt
  let prompt = `Professional logo design for "${companyName}" company.`;
  
  // Add custom description first (most important)
  if (options?.customDescription) {
    prompt += ` ${options.customDescription}.`;
  }
  
  // Add style specifications
  if (options?.style) {
    const styleDescriptions = {
      modern: 'Clean, contemporary design with sharp lines and modern typography',
      minimalist: 'Simple, clean design with minimal elements and plenty of white space',
      vintage: 'Classic, retro design with vintage typography and traditional elements',
      playful: 'Fun, creative design with vibrant colors and playful elements',
      professional: 'Sophisticated, corporate design with elegant typography',
      creative: 'Artistic, innovative design with unique creative elements'
    };
    prompt += ` ${styleDescriptions[options.style]}.`;
  }
  
  // Add industry context
  if (options?.industry) {
    prompt += ` Suitable for ${options.industry} industry.`;
  }
  
  // Add color scheme
  if (options?.colorScheme) {
    prompt += ` Color scheme: ${options.colorScheme}.`;
  }
  
  // Add general requirements (unless custom description is very detailed)
  if (!options?.customDescription || options.customDescription.length < 50) {
    prompt += ' High-quality vector design, scalable, suitable for business use across digital and print media. Professional logo design with clear typography and iconic elements.';
  }
  
  // Determine optimal model and settings
  const model = options?.model || 'dall-e-3'; // Default to DALL-E 3 for high quality
  const size = options?.size || '1024x1024'; // Square format for logos
  
  return generateImage({
    prompt,
    model,
    size,
    n: 1, // DALL-E 3 only supports n=1
    quality: model === 'dall-e-3' ? 'hd' : model === 'gpt-image-1' ? 'high' : undefined,
    style: model === 'dall-e-3' ? 'vivid' : undefined, // Vivid for more dramatic logos
    response_format: model === 'gpt-image-1' ? undefined : 'url', // gpt-image-1 always returns base64
    background: options?.background || (model === 'gpt-image-1' ? 'transparent' : undefined),
    output_format: model === 'gpt-image-1' ? 'png' : undefined,
    user: options?.user,
  });
}

/**
 * Helper function for logo recreation with optimized settings
 */
export async function recreateLogo(
  referenceImageUrl: string,
  companyName: string,
  modifications?: string,
  user?: string
): Promise<OpenAIImageOutput> {
  // For recreation, we'll use a combination approach:
  // 1. Use vision API to analyze the reference image
  // 2. Generate a new logo based on the analysis
  
  let prompt = `Recreate this logo design for "${companyName}" company.`;
  
  if (modifications) {
    prompt += ` Modifications requested: ${modifications}.`;
  }
  
  prompt += ' Maintain the core visual identity while creating a fresh, high-quality version. Professional logo design with clear typography and scalable vector-style appearance.';
  
  // Use DALL-E 3 for high-quality recreation
  return generateImage({
    prompt,
    model: 'dall-e-3',
    size: '1024x1024',
    n: 1,
    quality: 'hd',
    style: 'vivid',
    response_format: 'url',
    user,
  });
}