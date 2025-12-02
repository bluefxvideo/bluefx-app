// Affiliate Toolkit Prompt Templates
import { ScriptType, AffiliateOffer } from './types';

export function getPromptForScriptType(
  scriptType: ScriptType,
  offer: AffiliateOffer,
  customPrompt?: string
): string {
  const offerContext = `
OFFER DETAILS:
- Product Name: ${offer.name}
- Niche: ${offer.niche || 'General'}
- Offer Content/Description: ${offer.offer_content || 'No description provided'}
`;

  switch (scriptType) {
    case 'short_video':
      return `${offerContext}

Create a compelling 60-90 second video script for promoting this affiliate offer on TikTok, Instagram Reels, or YouTube Shorts.

Requirements:
- Hook in the first 3 seconds (pattern interrupt, bold claim, or question)
- Problem-agitation in seconds 4-20
- Solution introduction (the offer) in seconds 21-45
- Social proof or credibility moment in seconds 46-60
- Strong CTA with urgency in final 15-30 seconds
- Include visual/scene directions in [brackets]
- Keep language casual, conversational, and relatable
- Include 3-5 trending-style transitions or effects suggestions

Format the output with:
1. HOOK (0-3s)
2. PROBLEM (4-20s)
3. SOLUTION (21-45s)
4. PROOF (46-60s)
5. CTA (61-90s)

Each section should include the spoken script AND [visual directions].`;

    case 'long_video':
      return `${offerContext}

Create a detailed 5-10 minute YouTube video script for promoting this affiliate offer.

Structure:
1. INTRO (0-30s)
   - Pattern interrupt hook
   - Promise/benefit statement
   - Credibility establishment

2. STORY/CONTEXT (30s-2min)
   - Personal story or case study setup
   - Relatable problem narrative
   - Emotional connection

3. PROBLEM DEEP DIVE (2-4min)
   - 3-5 specific pain points
   - Cost of inaction
   - Failed solutions they've tried

4. SOLUTION REVEAL (4-6min)
   - Introduce the offer naturally
   - Key features as benefits
   - How it solves each pain point

5. PROOF & RESULTS (6-8min)
   - Testimonials or results
   - Before/after scenarios
   - Objection handling

6. CTA & CLOSE (8-10min)
   - Clear next step
   - Bonuses or urgency
   - Final value reminder

Include:
- B-roll suggestions in [brackets]
- Engagement prompts (like/subscribe moments)
- Timestamps for chapters
- SEO-friendly title and description`;

    case 'email_sequence':
      return `${offerContext}

Create a 5-email follow-up sequence to promote this affiliate offer.

EMAIL 1: The Hook (Day 0)
- Subject line options (3 variations)
- Preview text
- Story-based intro
- Soft pitch with curiosity
- CTA: Learn more

EMAIL 2: The Problem (Day 1)
- Subject line options (3 variations)
- Agitate the main pain point
- Share a relatable struggle
- Hint at the solution
- CTA: See how

EMAIL 3: The Solution (Day 2)
- Subject line options (3 variations)
- Full product reveal
- 5 key benefits
- Social proof
- CTA: Get started

EMAIL 4: Objection Crusher (Day 3)
- Subject line options (3 variations)
- Address top 3 objections
- FAQ format
- Risk reversal
- CTA: Try it now

EMAIL 5: Last Chance (Day 4)
- Subject line options (3 variations)
- Urgency/scarcity
- Summary of value
- Final testimonial
- Strong CTA with deadline

For each email include:
- Subject line A/B options
- Preview text
- Full body copy
- P.S. line
- Estimated word count`;

    case 'landing_page':
      return `${offerContext}

Create complete landing page copy for this affiliate offer.

STRUCTURE:

1. ABOVE THE FOLD
   - Headline (benefit-focused, 10 words max)
   - Subheadline (expand on promise)
   - Hero image/video description
   - Primary CTA button text
   - Trust badges description

2. PROBLEM SECTION
   - Section headline
   - 4-5 pain points with icons
   - "Sound familiar?" bridge

3. SOLUTION SECTION
   - Section headline
   - Product introduction
   - 6 key features as benefits
   - Supporting image descriptions

4. HOW IT WORKS
   - Section headline
   - 3-step process
   - Simple explanations
   - Visual descriptions

5. SOCIAL PROOF
   - Section headline
   - 3 testimonials with names
   - Results/stats
   - Logo bar description

6. PRICING/OFFER
   - Section headline
   - Value stack
   - Price anchoring
   - Bonuses (if any)
   - Guarantee

7. FAQ SECTION
   - 5-7 common questions
   - Detailed answers
   - Objection handling

8. FINAL CTA
   - Urgency statement
   - Value reminder
   - Button text
   - Risk reversal

Include wireframe notes for layout suggestions.`;

    case 'social_posts':
      return `${offerContext}

Create 10 social media posts promoting this affiliate offer, optimized for different platforms.

POSTS 1-2: FACEBOOK
- Longer format (150-300 words)
- Story-based
- Engagement question
- Link in comments note
- Emoji usage
- Hashtags (3-5)

POSTS 3-4: INSTAGRAM
- Caption (125-150 words)
- Hook first line
- Value-packed middle
- CTA with "link in bio"
- 20-30 relevant hashtags
- Image/carousel description

POSTS 5-6: TWITTER/X
- Thread format (5-7 tweets)
- Hook tweet
- Value tweets
- CTA tweet
- Quote tweet suggestion

POSTS 7-8: LINKEDIN
- Professional tone
- Industry insight angle
- Personal experience
- Business benefit focus
- 3-5 hashtags

POSTS 9-10: TIKTOK CAPTIONS
- Short, punchy (50-100 words)
- Trending sound suggestions
- Hook phrase
- CTA for bio link
- Trending hashtags

For each post include:
- Platform
- Post type (image/video/carousel/text)
- Copy
- Hashtags
- Best posting time suggestion`;

    case 'ad_copy':
      return `${offerContext}

Create multiple ad copy variations for Facebook and Google Ads.

FACEBOOK ADS (5 variations):

AD 1: Problem-Aware
- Primary text (125 words)
- Headline (40 chars)
- Description (30 chars)
- CTA button suggestion
- Image/video concept

AD 2: Solution-Aware
- Primary text (125 words)
- Headline (40 chars)
- Description (30 chars)
- CTA button suggestion
- Image/video concept

AD 3: Testimonial-Based
- Primary text (125 words)
- Headline (40 chars)
- Description (30 chars)
- CTA button suggestion
- Image concept

AD 4: Curiosity Hook
- Primary text (125 words)
- Headline (40 chars)
- Description (30 chars)
- CTA button suggestion
- Image/video concept

AD 5: Direct Response
- Primary text (125 words)
- Headline (40 chars)
- Description (30 chars)
- CTA button suggestion
- Image concept

GOOGLE ADS (5 variations):

For each:
- Headline 1 (30 chars)
- Headline 2 (30 chars)
- Headline 3 (30 chars)
- Description 1 (90 chars)
- Description 2 (90 chars)
- Display path suggestions

Include:
- Target audience for each ad
- Suggested interests/keywords
- A/B testing recommendations`;

    case 'custom':
      return `${offerContext}

USER'S CUSTOM REQUEST:
${customPrompt || 'Please provide your custom prompt.'}

Create the requested content following these guidelines:
- Be specific and actionable
- Include clear formatting
- Provide multiple options where applicable
- Ensure all copy is conversion-focused
- Maintain the offer's value proposition throughout`;

    default:
      return offerContext;
  }
}

export function getRefinementPrompt(
  currentScript: string,
  refinementInstructions: string
): string {
  return `Here is the current script/content:

---
${currentScript}
---

Please modify the above content according to these instructions:
${refinementInstructions}

Maintain the same general structure and format, but apply the requested changes. Output the complete revised version.`;
}
