/**
 * Example usage of Ideogram V3 Turbo for logo generation
 * 
 * This demonstrates how to use the imported Ideogram V3 Turbo Replicate model
 * for generating high-quality logos with professional results.
 */

import { 
  createIdeogramV3TurboPrediction,
  getIdeogramV3TurboPrediction,
  waitForIdeogramV3TurboCompletion,
  generateLogo
} from '../actions/models/ideogram-v3-turbo';

/**
 * Example 1: Basic logo generation
 */
export async function generateBasicLogo() {
  try {
    console.log('🎨 Generating basic logo with Ideogram V3 Turbo...');
    
    const prediction = await generateLogo(
      'A modern, minimalist logo for a tech startup called "DataFlow" with clean typography and geometric elements',
      {
        aspectRatio: '1:1',
        styleType: 'Design',
        seed: 12345 // For reproducible results
      }
    );

    console.log('📝 Prediction created:', prediction.id);
    console.log('⏳ Status:', prediction.status);

    // Wait for completion
    const result = await waitForIdeogramV3TurboCompletion(prediction.id);
    
    if (result.status === 'succeeded' && result.output) {
      console.log('✅ Logo generated successfully!');
      console.log('🖼️ Generated images:', result.output);
      return result.output;
    } else {
      console.error('❌ Logo generation failed:', result.error);
    }
  } catch (error) {
    console.error('💥 Error generating logo:', error);
  }
}

/**
 * Example 2: Advanced logo generation with custom parameters
 */
export async function generateAdvancedLogo() {
  try {
    console.log('🚀 Generating advanced logo with custom parameters...');
    
    const prediction = await createIdeogramV3TurboPrediction({
      prompt: 'Professional logo for "EcoGreen Solutions" - sustainable energy company. Incorporate leaf and lightning bolt elements, modern sans-serif typography, green and blue color scheme',
      aspect_ratio: '16:9', // Horizontal logo format
      style_type: 'Design',
      magic_prompt_option: 'On', // Enhanced AI prompt optimization
      resolution: '1344x768', // High resolution
    });

    console.log('📝 Advanced prediction created:', prediction.id);

    // Poll for completion manually
    let result = prediction;
    while (result.status === 'starting' || result.status === 'processing') {
      console.log('⏳ Still processing... Status:', result.status);
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
      result = await getIdeogramV3TurboPrediction(prediction.id);
    }

    if (result.status === 'succeeded' && result.output) {
      console.log('✅ Advanced logo generated successfully!');
      console.log('🖼️ Generated images:', result.output);
      console.log('⏱️ Generation time:', result.metrics?.predict_time + 's');
      return result.output;
    } else {
      console.error('❌ Advanced logo generation failed:', result.error);
    }
  } catch (error) {
    console.error('💥 Error generating advanced logo:', error);
  }
}

/**
 * Example 3: Logo generation with style reference
 */
export async function generateLogoWithStyleReference() {
  try {
    console.log('🎭 Generating logo with style reference...');
    
    // Note: In a real scenario, you'd upload reference images to Supabase Storage first
    const styleReferenceImages = [
      'https://example.com/reference-logo-1.jpg',
      'https://example.com/reference-logo-2.jpg'
    ];

    const prediction = await createIdeogramV3TurboPrediction({
      prompt: 'Corporate logo for "InnovaTech Labs" - clean, professional, technology-focused design',
      aspect_ratio: '1:1',
      style_type: 'Design',
      style_reference_images: styleReferenceImages,
      magic_prompt_option: 'Auto',
    });

    console.log('📝 Style-referenced prediction created:', prediction.id);

    const result = await waitForIdeogramV3TurboCompletion(prediction.id);
    
    if (result.status === 'succeeded' && result.output) {
      console.log('✅ Style-referenced logo generated successfully!');
      console.log('🖼️ Generated images:', result.output);
      return result.output;
    } else {
      console.error('❌ Style-referenced logo generation failed:', result.error);
    }
  } catch (error) {
    console.error('💥 Error generating style-referenced logo:', error);
  }
}

/**
 * Example 4: Batch logo generation with different styles
 */
export async function generateLogoVariations() {
  const logoPrompt = 'Modern logo for "QuantumTech" - quantum computing company';
  const variations = [
    { style: 'Design' as const, description: 'Clean design-focused' },
    { style: 'Realistic' as const, description: 'Realistic rendering' },
    { style: '3D' as const, description: '3D visualization' },
  ];

  const results = [];

  for (const variation of variations) {
    try {
      console.log(`🎨 Generating ${variation.description} variation...`);
      
      const prediction = await generateLogo(logoPrompt, {
        styleType: variation.style,
        aspectRatio: '1:1',
      });

      const result = await waitForIdeogramV3TurboCompletion(prediction.id);
      
      if (result.status === 'succeeded' && result.output) {
        console.log(`✅ ${variation.description} variation completed`);
        results.push({
          style: variation.style,
          description: variation.description,
          images: result.output
        });
      }
    } catch (error) {
      console.error(`❌ Error generating ${variation.description} variation:`, error);
    }
  }

  console.log('🎯 All variations completed:', results.length);
  return results;
}

/**
 * Usage examples - uncomment to test
 */
export async function runExamples() {
  // Basic logo generation
  // await generateBasicLogo();
  
  // Advanced logo with custom parameters
  // await generateAdvancedLogo();
  
  // Logo with style reference
  // await generateLogoWithStyleReference();
  
  // Multiple variations
  // await generateLogoVariations();
}

// Configuration for production use
export const IDEOGRAM_CONFIG = {
  // Optimal settings for logo generation
  LOGO_DEFAULTS: {
    aspect_ratio: '1:1' as const,
    style_type: 'Design' as const, 
    magic_prompt_option: 'On' as const,
  },
  
  // Pricing information
  PRICING: {
    cost_per_image: 0.03, // $0.03 per output image
    description: 'Approximately 33 images for $1'
  },
  
  // Model information
  MODEL_INFO: {
    name: 'Ideogram V3 Turbo',
    version: 'f8a8eb2c75d7d86ec58e3b8309cee63acb437fbab2695bc5004acf64d2de61a7',
    description: 'Fastest and cheapest Ideogram v3 model',
    hardware: 'CPU',
    commercial_use: true
  }
};