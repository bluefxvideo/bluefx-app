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
      return `You are a professional cinematographer and storyboard artist. Generate a comprehensive 9-panel cinematic storyboard for video production.

${offer.name !== 'Custom Content' ? `PRODUCT/OFFER CONTEXT:
- Product: ${offer.name}
- Niche: ${offer.niche || 'General'}
- Details: ${fullContent}

` : ''}USER'S STORY DESCRIPTION:
${customPrompt || 'Please describe your story concept.'}

TASK: Before generating the storyboard, analyze the story to understand:
- Who are the main characters/subjects?
- What is the setting/environment?
- What is the mood/tone?
- What is the visual style?

Then create a complete 9-panel storyboard with detailed visual descriptions optimized for AI image generation.

CRITICAL REQUIREMENTS:
1. Each frame description MUST be 2-3 detailed sentences (not just bullet points)
2. SUBJECT DESCRIPTION: Include detailed character/subject description (age, physical features, build, facial features, hair, clothing details, accessories, expression, demeanor)
3. ENVIRONMENT DESCRIPTION: Include detailed setting (specific location type, time of day, lighting conditions, key environmental elements, atmosphere, color palette)
4. Maintain STRICT CONSISTENCY across all 9 frames (same character appearance, same clothing, same environment, same lighting)
5. Each description should work as a standalone AI image generation prompt
6. Use professional cinematography terminology

OUTPUT FORMAT (follow this exact structure):

CINEMATIC STORYBOARD

STORY: [Brief 1-2 sentence story summary]

SUBJECT DESCRIPTION:
[Detailed character/subject description: age, physical features, build, facial features, hair, clothing details, accessories, expression, demeanor - 3-4 sentences with specific visual details]

ENVIRONMENT DESCRIPTION:
[Detailed setting: specific location type, time of day, lighting conditions (golden hour/overcast/interior/etc.), key environmental elements, atmosphere, color palette, architectural details - 3-4 sentences with specific visual details]

CAMERA COVERAGE:

Row 1 (Establishing Wide Shots):

EXTREME LONG SHOT (ELS):
[Detailed scene description showing subject small within vast environment, spatial context, environmental scope, wide perspective - 2-3 sentences]

LONG SHOT (LS):
[Full body head-to-toe view, complete subject visible, surrounding environment context, natural positioning - 2-3 sentences]

MEDIUM LONG SHOT (MLS):
[Subject framed from knees up, three-quarter or American shot style, action beginning to be visible, environmental context still present - 2-3 sentences]

Row 2 (Core Character Coverage):

MEDIUM SHOT (MS):
[Waist-up framing, focus on action and interaction, upper body clearly visible, specific action description, environmental elements in background - 2-3 sentences]

MEDIUM CLOSE-UP (MCU):
[Chest-up framing, intimate character view, facial expression details, emotional state visible, shallow depth of field beginning - 2-3 sentences]

CLOSE-UP (CU):
[Tight face framing only, detailed facial features, authentic human expression, emotional nuance, skin texture visible, shallow depth of field with background bokeh - 2-3 sentences]

Row 3 (Details & Perspective):

EXTREME CLOSE-UP (ECU):
[Macro detail shot of specific element: hands, eyes, object, texture - extreme detail description, tactile quality, minute details visible - 2-3 sentences]

LOW ANGLE SHOT:
[Worm's eye view looking upward at subject, heroic or imposing perspective, environmental context above, perspective distortion noted - 2-3 sentences]

HIGH ANGLE SHOT:
[Bird's eye view looking down on subject, overhead perspective, spatial relationship visible, top-down composition - 2-3 sentences]


TECHNICAL SPECIFICATIONS:
Camera System: Shot on Arri Alexa LF cinema camera
Image Quality: Ultra-photorealistic, professional cinematography, 8k resolution, highly detailed
Lighting: [Specific lighting description based on environment - e.g., "Natural golden hour sunlight", "Soft overcast daylight", "Interior fluorescent and window light mix", etc.]
Color Grading: [Specific color palette - e.g., "Natural desaturated tones with warm amber highlights", "Cool blue-gray tones", "Rich saturated colors", etc.]
Texture Detail: Authentic skin texture and fabric detail, realistic material surfaces, natural imperfections
Depth of Field: Realistic cinema lens bokeh, shallow depth on close-ups, natural focus fall-off
Film Characteristics: Film grain texture, natural photographic quality
Consistency: Same character appearance across all 9 frames (identical face, hair, clothing, environment), same lighting and time of day throughout
Aesthetic: Documentary realism style, 100% photographic reality, zero cartoon or illustration qualities
Aspect Ratio: 16:9 cinematic widescreen format

DIALOGUE/NARRATION NOTES: (Optional - only include if story requires it)
Frame [number]: "[Dialogue or narration text]"
Frame [number]: "[Dialogue or narration text]"
[Include 2-5 key dialogue/narration moments if applicable]

USAGE NOTES:
Copy this entire storyboard script into the AI Cinematographer Storyboard tab to generate your 9-panel visual storyboard grid.

---

CRITICAL OUTPUT RULES:
- NO markdown formatting (no ** or *, no # headers)
- Each frame description must be 2-3 detailed sentences, not abbreviated
- Be highly specific with visual details for AI image generation
- Maintain visual consistency (subject appearance, lighting, style, color palette) across ALL frames
- Use professional cinematography terminology throughout
- The output will be used directly to generate AI images, so clarity and detail are essential`;

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
