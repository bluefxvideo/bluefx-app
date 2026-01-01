// Affiliate Toolkit Prompt Templates
import { ScriptType, AffiliateOffer } from './types';

export function getPromptForScriptType(
  scriptType: ScriptType,
  offer: AffiliateOffer,
  customPrompt?: string
): string {
  // Use aggregated_content if available (includes transcriptions), otherwise fall back to offer_content
  const fullContent = offer.aggregated_content || offer.offer_content || 'No description provided';

  const offerContext = `
OFFER DETAILS:
- Product Name: ${offer.name}
- Niche: ${offer.niche || 'General'}
- Offer Content/Description: ${fullContent}
`;

  switch (scriptType) {
    case 'short_video':
      return `Write a 30-60 second video script for TikTok/Reels/Shorts.

OFFER: ${offer.name}
NICHE: ${offer.niche || 'General'}

OFFER INFORMATION:
${fullContent}

REQUIREMENTS:
- Hook: First line must grab attention in 2-3 seconds
- Body: Address the pain point, introduce the solution
- CTA: End with "link in bio" or similar
- Tone: Casual, authentic, like talking to a friend
- Length: 30-60 seconds when spoken naturally

OUTPUT FORMAT:
Provide the script in this exact format, nothing else:

HOOK:
[The opening line - attention grabber]

SCRIPT:
[The main body of the script - conversational, flows naturally]

CTA:
[The closing call to action]

---

CRITICAL OUTPUT RULES:
- Output ONLY the script text
- NO markdown formatting (no **, no *, no #)
- NO [Visual Directions] or [B-Roll] notes
- NO section explanations or meta-commentary
- NO "Here's your script:" introductions
- Just the raw script, ready to paste and read aloud`;

    case 'long_video':
      return `Write a 5-10 minute YouTube video script.

OFFER: ${offer.name}
NICHE: ${offer.niche || 'General'}

OFFER INFORMATION:
${fullContent}

STRUCTURE:
- Hook (0:00-0:30): Grab attention, promise value
- Problem (0:30-2:00): Describe the struggle
- Failed solutions (2:00-3:30): What doesn't work
- Discovery (3:30-5:00): The breakthrough
- Solution (5:00-7:00): Present the product
- Benefits (7:00-8:30): Why it works
- CTA (8:30-9:30): Call to action
- Recap (9:30-10:00): Quick summary

OUTPUT FORMAT:

TITLE OPTIONS:
[3 title options, one per line]

HOOK:
[Opening that grabs attention]

PROBLEM:
[Describe the pain point]

FAILED SOLUTIONS:
[What they've tried that doesn't work]

DISCOVERY:
[The aha moment]

SOLUTION:
[Present the product]

BENEFITS:
[Why it works]

CTA:
[Call to action]

RECAP:
[Quick summary]

---

CRITICAL OUTPUT RULES:
- Output ONLY the script text
- NO markdown formatting (no ** or *)
- NO [Visual Directions] or [B-Roll] notes
- NO explanations or meta-commentary
- Just clean text ready to read aloud
- Each section flows naturally into the next`;

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

    case 'hooks':
      return `Generate 10 scroll-stopping hooks for short-form video.

OFFER: ${offer.name}
NICHE: ${offer.niche || 'General'}

OFFER INFORMATION:
${fullContent}

Generate 10 different hooks. Each hook is 1-2 sentences that would make someone stop scrolling.

Use variety:
- Questions
- Bold claims
- Story openers
- Curiosity gaps
- Statistics
- Pattern interrupts

OUTPUT FORMAT (exactly like this):

1. [Hook text here]

2. [Hook text here]

3. [Hook text here]

4. [Hook text here]

5. [Hook text here]

6. [Hook text here]

7. [Hook text here]

8. [Hook text here]

9. [Hook text here]

10. [Hook text here]

---

CRITICAL OUTPUT RULES:
- Just the numbered hooks
- NO labels like [QUESTION] or [BOLD CLAIM]
- NO explanations or meta-commentary
- NO markdown formatting
- Clean text only, ready to use as video openers`;

    case 'content_calendar':
      return `${offerContext}

TASK: Create a complete 30-day content calendar for promoting this offer on social media.

STRATEGY:
- Week 1 (Days 1-7): Build AWARENESS - Introduce the problem, create curiosity
- Week 2 (Days 8-14): Agitate PAIN POINTS - Deep dive into struggles and frustrations
- Week 3 (Days 15-21): Present SOLUTION - Reveal the product, show benefits
- Week 4 (Days 22-30): Drive ACTION - Social proof, urgency, final push

REQUIREMENTS:
- 30 unique content pieces (one per day)
- Mix of formats throughout:
  • Short video scripts (TikTok/Reels) - include hook + brief concept
  • Text posts (Facebook/Instagram/X) - full post ready to use
  • Story ideas - brief concept for multi-slide stories
  • Carousel concepts - topic + slide breakdown
- Vary the angles so content doesn't feel repetitive
- Each piece should be actionable - ready to create or post
- Include the content type label for each day

OUTPUT FORMAT:

════════════════════════════════════════
WEEK 1: AWARENESS & CURIOSITY (Days 1-7)
════════════════════════════════════════

📅 DAY 1 - [SHORT VIDEO]
Hook: "..."
Concept: Brief description of the video content
CTA: Link in bio / Follow for more

---

📅 DAY 2 - [TEXT POST]
"Full post text here ready to copy and paste..."

Hashtags: #relevant #hashtags

---

📅 DAY 3 - [CAROUSEL]
Topic: ...
Slide 1: ...
Slide 2: ...
Slide 3: ...
Slide 4: ...
Slide 5: CTA

---

📅 DAY 4 - [STORY SEQUENCE]
Story 1: ...
Story 2: ...
Story 3: ...
Story 4: CTA with link

---

(Continue for all 7 days of Week 1)

════════════════════════════════════════
WEEK 2: PAIN POINTS & PROBLEMS (Days 8-14)
════════════════════════════════════════

(Days 8-14 with similar format)

════════════════════════════════════════
WEEK 3: SOLUTION & BENEFITS (Days 15-21)
════════════════════════════════════════

(Days 15-21 with similar format)

════════════════════════════════════════
WEEK 4: ACTION & URGENCY (Days 22-30)
════════════════════════════════════════

(Days 22-30 with similar format)

---

📊 CONTENT MIX SUMMARY:
- Short Videos: X
- Text Posts: X
- Carousels: X
- Story Sequences: X`;

    case 'cinematic_storyboard':
      return `Generate a professional 9-panel cinematic storyboard for video production.

${offer.name !== 'Custom Content' ? `PRODUCT/OFFER CONTEXT:
- Product: ${offer.name}
- Niche: ${offer.niche || 'General'}
- Details: ${fullContent}

` : ''}USER'S STORY DESCRIPTION:
${customPrompt || 'Please describe your story concept.'}

TASK: Create a complete 9-panel storyboard with detailed visual descriptions optimized for AI image generation.

CRITICAL REQUIREMENTS:
1. Each frame description MUST be 200-300 characters
2. Include visual style keywords: "photorealistic, cinematic lighting, [mood], [color palette]"
3. Maintain consistency across all 9 frames (same characters, environment, lighting)
4. Each description should work as a standalone AI image prompt

SHOT TYPE PROGRESSION:
- Frames 1-3: Establishing shots (wide to medium-wide)
- Frames 4-6: Core coverage (medium to close)
- Frames 7-9: Details and angles (extreme close, low angle, high angle)

OUTPUT FORMAT (follow exactly):

STORY: [One sentence summary of the story]

STORYBOARD SEQUENCE:

Frame 1 (ELS - Extreme Long Shot):
[Detailed visual description - environment, lighting, mood, composition. End with: "photorealistic, cinematic lighting, [mood descriptor]"]

Frame 2 (LS - Long Shot):
[Detailed visual description showing full subject in environment]

Frame 3 (MLS - Medium Long Shot):
[Subject from knees up, showing action and environment context]

Frame 4 (MS - Medium Shot):
[Subject from waist up, showing emotion and gesture]

Frame 5 (MCU - Medium Close-Up):
[Subject from chest up, focus on expression and detail]

Frame 6 (CU - Close-Up):
[Face or important object, emotional focus]

Frame 7 (ECU - Extreme Close-Up):
[Eyes, hands, or crucial detail - maximum emotional impact]

Frame 8 (Low Angle):
[Looking up at subject - conveys power, importance, or drama]

Frame 9 (High Angle):
[Looking down at subject or scene - conveys vulnerability or overview]

DIALOGUE/NARRATION NOTES:
- Frame X: "Dialogue or narration text here"
- Frame Y: "More dialogue or narration"
[Include 3-5 key dialogue/narration moments]

---

CRITICAL OUTPUT RULES:
- NO markdown formatting (no ** or *)
- Keep each frame description on its own line
- Make descriptions detailed enough for AI image generation
- Maintain visual consistency (lighting, style, color palette) across all frames`;

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
