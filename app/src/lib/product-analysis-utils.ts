import type { ProductAnalysis } from '@/actions/tools/product-image-analyzer';

/**
 * Build a PRODUCT SUBSTITUTION prompt block from the analysis.
 *
 * IMPORTANT: Keep this minimal. We only describe the product TYPE and CATEGORY
 * so the breakdown AI knows what kind of product to reference in scenes.
 * We do NOT describe visual details (colors, label text, etc.) because the
 * image generator will use the actual uploaded reference image for that.
 * Over-describing the label causes the AI to invent text instead of using the reference.
 */
export function buildProductSubstitutionPrompt(
  analysis: ProductAnalysis,
  imageLabels?: string[]
): string {
  const lines: string[] = [
    '## PRODUCT REFERENCE IMAGE',
    'The user is uploading a reference image of their product.',
    'A reference image is provided to the image generator — it will automatically match the product appearance.',
    '',
    'RULES FOR VISUAL PROMPTS:',
    '- Keep all scene descriptions exactly as they are from the original video',
    '- Do NOT change the product type, actions, or scene composition',
    '- NEVER write any brand names, product names, or label text in visual prompts',
    '- When the product package/container appears, refer to it as "image reference 1" so the image generator uses the uploaded product photo',
    '- Example: "A hand holding image reference 1 in a kitchen setting"',
    '- Everything else (hands, backgrounds, actions, lighting) stays exactly as the original',
    '',
    'RULES FOR NARRATION:',
    `- The user's product brand is: ${analysis.brandName}`,
    `- Product name: ${analysis.productName}`,
    '- Use these in the narration/voiceover script where the original mentions the competitor brand',
  ];

  if (analysis.keyIngredients.length > 0) {
    lines.push(`- Key ingredients to mention in narration: ${analysis.keyIngredients.slice(0, 3).join(', ')}`);
  }

  return lines.join('\n');
}
