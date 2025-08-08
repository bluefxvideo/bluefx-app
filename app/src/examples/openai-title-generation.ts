/**
 * Example usage of OpenAI API for YouTube title generation
 * This demonstrates how to use the imported schema and generated actions
 */

import { createChatCompletion, generateYouTubeTitles } from '@/actions/models/openai-chat';

/**
 * Example 1: Direct chat completion usage
 */
export async function exampleDirectChatCompletion() {
  try {
    const response = await createChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that generates creative YouTube titles.'
        },
        {
          role: 'user',
          content: 'Generate 3 variations of this title: "How to Create Amazing Videos"'
        }
      ],
      temperature: 0.8,
      max_tokens: 150
    });

    console.log('Generated titles:', response.choices[0].message.content);
    return response;
  } catch (error) {
    console.error('Error generating titles:', error);
    throw error;
  }
}

/**
 * Example 2: Using the helper function for YouTube titles
 */
export async function exampleYouTubeTitleGeneration() {
  try {
    const originalTitle = "10 Tips for Better Photography";
    const titleVariations = await generateYouTubeTitles(originalTitle, 5);
    
    console.log('Original title:', originalTitle);
    console.log('Generated variations:');
    titleVariations.forEach((title, index) => {
      console.log(`${index + 1}. ${title}`);
    });

    return titleVariations;
  } catch (error) {
    console.error('Error generating YouTube titles:', error);
    throw error;
  }
}

/**
 * Example 3: Batch title generation for multiple videos
 */
export async function exampleBatchTitleGeneration(originalTitles: string[]) {
  try {
    const results = await Promise.all(
      originalTitles.map(async (title) => {
        const variations = await generateYouTubeTitles(title, 3);
        return {
          original: title,
          variations
        };
      })
    );

    console.log('Batch generation results:');
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. Original: ${result.original}`);
      result.variations.forEach((variation, vIndex) => {
        console.log(`   ${vIndex + 1}. ${variation}`);
      });
    });

    return results;
  } catch (error) {
    console.error('Error in batch title generation:', error);
    throw error;
  }
}

/**
 * Example 4: Advanced title optimization with specific criteria
 */
export async function exampleAdvancedTitleOptimization(
  originalTitle: string,
  targetKeywords: string[],
  maxLength: number = 60
) {
  try {
    const messages = [
      {
        role: 'system' as const,
        content: `You are a YouTube SEO expert. Generate 5 optimized title variations that:
1. Include these keywords: ${targetKeywords.join(', ')}
2. Are under ${maxLength} characters
3. Use emotional triggers and power words
4. Maintain clarity and readability
5. Are click-worthy but not clickbait

Return only the titles, one per line.`
      },
      {
        role: 'user' as const,
        content: `Optimize this title: "${originalTitle}"`
      }
    ];

    const response = await createChatCompletion({
      model: 'gpt-4o',
      messages,
      temperature: 0.7,
      max_tokens: 200
    });

    const optimizedTitles = response.choices[0].message.content
      ?.split('\n')
      .map(title => title.trim())
      .filter(title => title.length > 0 && title.length <= maxLength) || [];

    console.log('Advanced optimization results:');
    console.log('Original:', originalTitle);
    console.log('Keywords:', targetKeywords.join(', '));
    console.log('Max length:', maxLength);
    console.log('Optimized titles:');
    optimizedTitles.forEach((title, index) => {
      console.log(`${index + 1}. ${title} (${title.length} chars)`);
    });

    return optimizedTitles;
  } catch (error) {
    console.error('Error in advanced title optimization:', error);
    throw error;
  }
}