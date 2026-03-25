'use server';

import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';

const productAnalysisSchema = z.object({
  brandName: z.string().describe('Brand name visible on the product label, or "Unknown" if not readable'),
  productName: z.string().describe('Full product name as shown on the label'),
  productType: z.string().describe('Type of product: jar, bottle, packet, box, tube, pouch, can, gummies, capsules, powder, etc.'),
  productCategory: z.string().describe('Category: supplement, skincare, food, beverage, cleaning, etc.'),
  primaryColors: z.array(z.string()).describe('Main colors of the product/packaging'),
  keyIngredients: z.array(z.string()).describe('Key ingredients or claims visible on the label'),
});

export type ProductAnalysis = z.infer<typeof productAnalysisSchema>;

export interface ProductAnalysisResult {
  success: boolean;
  analysis: ProductAnalysis | null;
  error?: string;
}

/**
 * Analyze a product image using Gemini 2.5 Flash vision.
 * Extracts brand, product type, colors, ingredients, claims, etc.
 * Used to auto-substitute competitor product details in video recreation.
 */
export async function analyzeProductImage(
  imageDataUrl: string
): Promise<ProductAnalysisResult> {
  if (!imageDataUrl) {
    return { success: false, analysis: null, error: 'No image provided' };
  }

  try {
    console.log('🔍 Analyzing product image with Gemini vision...');

    const result = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: productAnalysisSchema,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: imageDataUrl,
            },
            {
              type: 'text',
              text: `Analyze this product image. Extract basic product information only.

Focus on:
1. Brand name and product name (read the label)
2. What type of product/container it is (jar, bottle, packet, gummies, capsules, powder, etc.)
3. Product category (supplement, skincare, food, etc.)
4. Main colors of the packaging
5. Key ingredients if visible

Be precise about what you see. Keep it brief — we only need enough to know what kind of product this is, not a detailed visual description.`,
            },
          ],
        },
      ],
    });

    console.log('✅ Product image analysis complete:', result.object.brandName, result.object.productName);

    return {
      success: true,
      analysis: result.object,
    };
  } catch (error) {
    console.error('❌ Product image analysis failed:', error);
    return {
      success: false,
      analysis: null,
      error: error instanceof Error ? error.message : 'Failed to analyze product image',
    };
  }
}

// buildProductSubstitutionPrompt moved to @/lib/product-analysis-utils.ts (non-server-action)
