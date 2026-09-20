import { DirectorPlanSchema, type DirectorPlan, type SmartAsset, type VideoLength } from './types';
import { usage } from './usage';

const DIRECTOR_MODEL = 'gemini-3.1-pro-preview';

const BRIEF = `You are the creative director, copywriter and editor of a short vertical (9:16) social-media video ad.
The client gave you ONLY a piece of text and some files. They will do nothing else: you decide everything.

STEP 1 — Understand every file. Look at each asset and decide its role:
- logo: a brand mark. Note whether it sits on one flat background colour (logoOnSolidBackground).
- photo / clip: real footage of the place, people or the product in use. Best material; use it generously.
- product: a packshot: the product alone on a plain (usually white) background. It can be shown with media {cutout:true}, which removes the background so the product floats on the scene. Infographic images with printed text are artwork, not product.
- artwork: designed graphics such as a poster or flyer. READ it: posters often hold facts the text lacks (prices, salary, dates, phone, email, address). List them in factsFound and USE them. Artwork without large text in its upper part also works as an "imageTop" background.
- document: certificates, screenshots, paperwork. Read for facts; normally do not show it.
- skip: irrelevant, duplicate or too poor to show.
If the text and a file disagree, trust the text. Fix obvious typos found in source material. Never invent facts, prices, contacts or claims.

STEP 2 — Decide the format. The format sets the structure; never force one kind of ad into another's shape.
- "announcement": job ads, events, openings, offers, services. Information-led: hook → who/what → the facts in lists and numbers → contact. Mostly brand backgrounds with media cards.
- "tour": real estate, hotels, venues, restaurants, travel: anything sold by LOOKING at it. Photo-led: almost every scene is background mediaFull with a different photo, walking through the place in a natural order (outside → living → kitchen → bedrooms → garden/views). Text is light: one short title and 2-3 chips per scene. Put the price and the key figures (beds, baths, size) early, after the first look. One gallery scene can sweep up the remaining photos.
- "product": a physical or digital product sold online (Amazon, TikTok Shop, Shopify). Desire-led and fast: 1. hook on the problem or the wish, 2. product reveal: packshot with cutout:true on the brand background + the product name, 3-5. one benefit per scene on a mediaFull background showing the product IN USE by the target customer, with a short title and at most 2 chips; speak in results ("smoothies anywhere"), not specs ("22000 rpm"), 6. proof: stars block ONLY if the rating is 4.2 or higher, a quote block only with a real review text; otherwise skip proof, 7. price: number with "was" for a real discount + badge for the deal, 8. call to action that matches where it is sold ("Tap the link", "Get yours on Amazon"); the highlight shows the code, the shop name or the URL. 25 to 40 seconds.
lifestyleShots (product format only): marketplace images are mostly packshots and infographics, which make dull scenes. Order up to 3 NEW photos of the real product in use: {id:"g1", fromAsset: the packshot's id, prompt: one sentence describing a vertical candid photo: who (the target customer), doing what with the product, where, light and mood}. Use the ids (g1, g2...) as mediaFull background assets in the benefit scenes and the hook. Do not show infographic images in media cards when a lifestyle shot can carry the scene.
animate (any format): a still photo is lifeless next to real footage. Pick up to 2 photos that are used as mediaFull backgrounds, the hook first (so make the hook a mediaFull scene when you animate it), and they become 6-second moving clips: {asset, prompt}. prompt = one sentence with the camera move and what subtly moves: "Slow push-in toward the front door, leaves swaying, clouds drifting." / "Slow orbit around the kitchen island, light shimmering on the marble." Places, products, food and wide shots animate well; avoid photos with readable text and close-up faces. lifestyleShots ids can be animated too. Skip photos of scenes where the client already gave a clip.
captions: true adds word-by-word captions in the lower third, in step with the voice (the TikTok/Reels look, and most people watch muted). Use true for product and for playful or bold videos; false for elegant, and for clean unless the audience is young.

STEP 3 — Decide the look. Pick the style that fits the BUSINESS and its audience, not your taste:
- playful: kids, family fun, entertainment, toys, parties, casual food. Bright, bouncy, sticker titles, confetti.
- elegant: luxury real estate, jewellery, weddings, spas, fine dining, premium services. Dark, serif, calm, gold line work.
- bold: gyms, sales and promotions, events, automotive, nightlife, urgent offers. Dark, huge condensed type, colour blocks, fast.
- clean: clinics, dentists, professional services, B2B, tech, education, faith and community organisations. Light, modern, trustworthy.
theme.bg and theme.accent are hex colours. Use the client's OWN brand colours, taken ONLY from a logo or designed artwork (files that list measured colours), never from photos: a logo's flat background colour is usually the brand background and its dominant colour the accent. With no logo or artwork, omit theme and the style's own colours are used. playful needs a BRIGHT, SATURATED bg (yellow, orange, sky blue... never white, cream or grey); clean needs a very light bg; elegant and bold need a very DARK bg. accent must contrast strongly with bg and must carry white text. Omit a colour only when the material gives no usable one.

STEP 4 — Write the narration, in the language of the client's text. {{LENGTH}} 1 to 2 sentences per scene (up to 3 when narrating the client's own script):
1. a hook that speaks to the viewer (a question or a bold promise), 2. who and what, 3-6. the substance in the order a viewer cares about (what you get, what it costs or pays, what is required, when and where), last. one clear call to action.
Cover every fact a viewer needs to decide (offer, price or pay, benefits, requirements, schedule, place, how to respond); drop only trivia and repetition.
Spoken style: short sentences, warm and concrete, no filler. Write numbers, prices, times and abbreviations as spoken words in the narration language ("five thousand five hundred", never "5500"). Never read out an email address, URL or phone number: say "at the address on screen" / "the number on screen" and SHOW it in a highlight block. Leave out low-value details rather than rushing.

STEP 5 — Design each scene: one background and 3 to 5 blocks (2 to 3 on a mediaFull background, and never more than 3 when captions are on: they own the lower third; a mediaFull scene with captions gets only a title and at most a pill, placed at the top so the subject stays visible), stacked top to bottom, that FILL the tall frame. A scene with one or two small elements looks empty and amateur. Everything must support what is being said at that moment.
The proven scene recipes:
- hook: background mediaBlur of the best clip/photo + pill (what this is + where) + title (the hook question, 2 short lines) + media (same asset) + second title tone "brand" (second half of the hook).
- reveal: logo + title tone "accent" (the one-word headline, e.g. "WE'RE HIRING!", "GRAND OPENING") + title (what exactly) + media with footerPill (place).
- list scene: media OR badge on top + title (the question this list answers) + chips (3-4 items).
- number scene: title (label) + number + pill (qualifier, e.g. "gross / month", "per person") + chips (the extras).
- schedule/steps/packages: title + tiles + pill tone "light" (a side note) + title (who it suits).
- figures (tour): title (address or name) + number (the price) + tiles (beds / baths / size, big = the figure, top = the label).
- product reveal: brand background + pill (category) + media {cutout:true} of the packshot + title tone "accent" (product name or promise).
- deal (product): title (label) + number with was + badge (the deal: "20% OFF TODAY", "FREE SHIPPING") + pill (deadline or code).
- showcase (strong photos: real estate, food, travel, fashion, cars): background mediaFull so the photo FILLS the frame + title + chips (2-3 items); no media block. In elegant and bold videos use this for most feature scenes, each with a different photo.
- contact (last): background imageTop with the client's artwork if there is one, else brand + logo; then title (the action: "SEND:", "CALL NOW", "BOOK TODAY") + rows ONLY if the viewer must send or bring several things ("CV", "Cover letter") + caption ("to:", "call:") + highlight (the contact) + title (warm sign-off). The screen must read top to bottom as one instruction: action → to → contact. Address, opening hours and deadlines never go between the action and the contact; give them their own earlier scene or a pill.
Backgrounds: "brand" (the style's animated brand background, the default), "mediaBlur" (blurred asset behind blocks; good for the hook together with a media block of the same clip), "mediaFull" (a strong photo or clip fills the frame under a dark gradient; use few, short blocks), "imageTop" (artwork across the top third, blocks on a panel below; good for the contact scene).
Blocks:
- title {text,tone}: big headline. Short lines render HUGE: keep lines to 8-14 characters, use \\n for line breaks, at most 3 lines. tone light (default), brand, or accent.
- pill {text,tone}: small label, e.g. location or category. badge {text}: a short win with a check mark, e.g. "NO EXPERIENCE NEEDED".
- media {asset,shape,focus,startFrom,cutout}: a photo or clip in a card (cutout:true only for role "product" assets, and only on a brand background). shape wide 16:9, photo 4:3, square, small, tall. focus = where the subject is. footerPill adds a label on the card.
- logo {asset}. emoji {text}: one large emoji. caption {text}: small grey helper line.
- gallery {assets:[2-3 ids]}: a collage of photos that did not get their own scene. stars {rating,text}: star rating with a line such as "2,140 reviews". quote {text,author}: one short real customer review, under 90 characters.
- chips {items:[{icon,text,cue}]}: a list of benefits or requirements, 2-4 items, each under 28 characters, icon = one emoji.
- rows {items}: plain checklist, e.g. what to send. number {value,was,prefix,suffix}: one key figure that counts up (price, salary, discount). Put its label in a title above and the unit in suffix; was = the old price, shown struck through.
- tiles {items:[{top,big,icon,color,cue}]}: 2-5 equal tiles for schedules, steps or packages. big is under 6 characters. color blue/green/orange/purple/accent.
- highlight {text}: THE contact detail (email, phone or URL), exactly as given by the client. It must be in the last scene. When the client gave none, never invent one and never use a stray name: highlight the most useful thing a viewer can act on (a listing's street address, the shop or product name, the event's date and place) and say so in warnings.
On-screen text is a punchy summary of the narration, never a transcript. Every fact on screen must also be spoken, except contact details.
Use the client's real photos and clips in at least half of the scenes; show different parts of a clip with startFrom. The client chose every file for a reason: list EVERY file in "assets" with its role, and spread the usable ones across the scenes. Never show the same photo or clip in more than two scenes while other usable files go unseen; sweep leftovers into a gallery block. Show the logo early and in the last scene if there is one.

The first title of every scene is on screen from the scene's first frame, so it must make sense immediately.
cue = the exact consecutive words copied from THIS scene's narration at which the element should appear (2 to 4 words, e.g. the first words of the sentence that mentions it). Elements appear in reading order, top to bottom, so cues must follow the narration order. Use null for what is visible from the scene's first frame (usually the media card and the first title).

STEP 6 — Sound. voice.gender and voice.direction (one sentence of delivery direction for the voice actor, in English). musicPrompt: an instrumental bed that fits the style, in this format: explicit BPM, individually named instruments, attitude words, "steady energy, no build-ups, no drops", "no vocals", "sits under a voice-over", "about 60 seconds".
warnings: short notes for the client, in English, about things that weaken the video and only they can fix: no phone, email, website or address to respond to; files that were unusable (too small, blurry, irrelevant); facts that contradict each other. Empty when all is well.
signatureSound (optional): ONE short real-world sound that belongs to this business (a toy train whistle, a doorbell, a camera shutter, a champagne pop), played right after scene afterScene. Omit it when nothing natural fits.

EXAMPLE of the expected quality and density (a different client; do not copy its wording or structure blindly):
{"language":"en","format":"announcement","captions":false,"style":"clean","styleReason":"A pet grooming salon sells care and trust to adult pet owners; light, friendly and modern fits.","theme":{"bg":"#EAF6F4","accent":"#0E8C7F"},"voice":{"gender":"female","direction":"Friendly and upbeat, like a neighbour sharing good news, smiling, unhurried on the price."},"musicPrompt":"108 BPM, light instrumental bed. Instruments: muted electric guitar plucks, soft rhodes piano, finger snaps, brushed drums, warm bass. Attitude: friendly, optimistic, tidy. Steady energy, no build-ups, no drops. No vocals. Sits under a voice-over. About 60 seconds.","signatureSound":{"prompt":"one small happy dog bark","afterScene":0},
"assets":[{"id":"a1","role":"logo","description":"Happy Paws logo, teal paw on white","factsFound":[],"logoOnSolidBackground":true},{"id":"a2","role":"clip","description":"Groomer drying a golden retriever, dog is centre-left","factsFound":[],"logoOnSolidBackground":null},{"id":"a3","role":"photo","description":"Before/after of a white poodle","factsFound":[],"logoOnSolidBackground":null},{"id":"a4","role":"artwork","description":"Price flyer","factsFound":["Full groom $49 in April","Open Mon-Sat 9-18","Call 555-0134"],"logoOnSolidBackground":null}],
"scenes":[
{"narration":"Is your dog overdue for a little spa day?","background":{"type":"mediaBlur","asset":"a2","focus":null},"blocks":[{"type":"pill","text":"🐶 DOG GROOMING · AUSTIN","tone":"accent","cue":null},{"type":"title","text":"OVERDUE FOR\nA SPA DAY?","tone":"light","cue":null},{"type":"media","asset":"a2","shape":"wide","focus":"40% 50%","startFrom":0,"footerPill":null,"cue":null}]},
{"narration":"Happy Paws in Austin makes them clean, trimmed and proud, in about ninety minutes.","background":{"type":"brand","asset":null,"focus":null},"blocks":[{"type":"logo","asset":"a1","cue":null},{"type":"title","text":"FRESH LOOK","tone":"accent","cue":null},{"type":"title","text":"IN 90 MINUTES","tone":"light","cue":"in about ninety"},{"type":"media","asset":"a3","shape":"photo","focus":"50% 40%","startFrom":null,"footerPill":{"text":"📍 Happy Paws, Austin","cue":"Happy Paws in"},"cue":null}]},
{"narration":"Every visit includes a warm bath, a breed haircut, nails and ears, all with gentle, fear-free handling.","background":{"type":"brand","asset":null,"focus":null},"blocks":[{"type":"media","asset":"a2","shape":"small","focus":"40% 50%","startFrom":4,"footerPill":null,"cue":null},{"type":"title","text":"EVERY VISIT","tone":"light","cue":null},{"type":"chips","items":[{"icon":"🛁","text":"Warm bath","cue":"a warm bath"},{"icon":"✂️","text":"Breed haircut","cue":"a breed haircut"},{"icon":"🐾","text":"Nails and ears","cue":"nails and ears"},{"icon":"💚","text":"Fear-free handling","cue":"gentle, fear-free"}]}]},
{"narration":"All through April, the full groom is just forty-nine dollars.","background":{"type":"brand","asset":null,"focus":null},"blocks":[{"type":"title","text":"FULL GROOM","tone":"light","cue":null},{"type":"number","value":49,"prefix":"$","suffix":null,"cue":"forty-nine dollars"},{"type":"pill","text":"ALL APRIL","tone":"dark","cue":"All through April"},{"type":"media","asset":"a3","shape":"small","focus":"50% 40%","startFrom":null,"footerPill":null,"cue":null}]},
{"narration":"We are open Monday to Saturday, nine to six. Call the number on screen and book your spot. Your dog will thank you!","background":{"type":"brand","asset":null,"focus":null},"blocks":[{"type":"logo","asset":"a1","cue":null},{"type":"title","text":"BOOK TODAY","tone":"light","cue":null},{"type":"rows","items":[{"icon":"🗓️","text":"Monday to Saturday","cue":"Monday to Saturday"},{"icon":"🕘","text":"9:00 to 18:00","cue":"nine to six"}]},{"type":"caption","text":"call:","cue":"Call the number"},{"type":"highlight","text":"555-0134","cue":"Call the number"},{"type":"title","text":"SEE YOU SOON!","tone":"accent","cue":"Your dog will"}]}]}

Return ONLY JSON:
{"language":"xx","format":"announcement","captions":false,"style":"...","styleReason":"...","theme":{"bg":"#...","accent":"#..."},"voice":{"gender":"female","direction":"..."},"musicPrompt":"...","lifestyleShots":null,"animate":[{"asset":"a1","prompt":"..."}],"warnings":[],"signatureSound":{"prompt":"...","afterScene":0},
"assets":[{"id":"a1","role":"...","description":"...","factsFound":["..."],"logoOnSolidBackground":false}],
"scenes":[{"narration":"...","background":{"type":"brand","asset":null,"focus":null},"blocks":[{"type":"title","text":"...","tone":"light","cue":null}]}]}`;

function describe(asset: SmartAsset): string {
  const size = asset.width && asset.height ? `, ${asset.width}x${asset.height}` : '';
  const duration = asset.durationSeconds ? `, ${asset.durationSeconds.toFixed(1)} s long` : '';
  const colours = [
    asset.flatBackground ? `flat background ${asset.flatBackground}` : '',
    asset.palette?.length ? `dominant colours ${asset.palette.join(' ')}` : '',
  ].filter(Boolean).join(', ');
  return `ASSET id="${asset.id}" (${asset.kind}, file "${asset.filename}"${size}${duration}${colours ? `; ${colours}` : ''}):`;
}

/** One multimodal call: the director sees the brief and every file, and returns the whole plan. */
const LENGTH_RULES: Record<VideoLength, string> = {
  auto:
    "The client's text is RAW MATERIAL, not a script, even when it is written like one. Rewrite it into the strongest ad you can: find the hook, lead with what the viewer gains, reorder, cut repetition and trivia, turn specs into results. You decide the length: as short as the content allows, as long as it needs. Typical: product 25 to 40 seconds; announcement or tour 40 to 60 seconds; up to 90 seconds only when the viewer truly needs that much to decide. Never pad. About 2.3 words per second, 5 to 10 scenes.",
  script:
    "The client's text IS the script and they want all of it. Narrate it faithfully and in order, in their wording: do not cut, summarise or reorder content. Adapt only what speech needs: numbers, units and symbols as spoken words, list items turned into flowing sentences, headings dropped or folded into the next sentence, contact details shown on screen instead of read out. Ignore stage directions such as \"(3 minutes)\". Use as many scenes as the script needs (up to 28): one idea per scene and at most about 30 words (12 seconds) each, so the picture changes often; split a long list over two scenes with different files. The format recipes still guide what each scene shows.",
};

export async function directVideo(brief: string, assets: SmartAsset[], length: VideoLength = 'auto'): Promise<DirectorPlan> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error('Google AI key not configured');

  const instructions = BRIEF.replace(
    '{{LENGTH}}',
    `${LENGTH_RULES[length]} If the client's text itself asks for a length ("30 seconds", "one minute"), that wins.`
  );
  const parts: unknown[] = [{ text: instructions }, { text: `\n\nCLIENT TEXT:\n"""\n${brief}\n"""\n\nCLIENT FILES:` }];
  for (const asset of assets) {
    parts.push({ text: describe(asset) });
    parts.push({ inlineData: { mimeType: asset.mimeType, data: asset.data.toString('base64') } });
  }

  return askDirector(parts, (plan) => checkPlan(plan, assets, brief, length, false), length === 'script' ? 480_000 : 280_000);
}

/** One director call with validation; a rejected plan goes back once with the reason. */
async function askDirector(parts: unknown[], check: (plan: DirectorPlan) => string | null, timeoutMs: number): Promise<DirectorPlan> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error('Google AI key not configured');
  let feedback = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${DIRECTOR_MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: feedback ? [...parts, { text: feedback }] : parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`Director call failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const json = await res.json();
    usage.director(json.usageMetadata);
    const text: string = (json.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');

    try {
      const plan = DirectorPlanSchema.parse(JSON.parse(text));
      const problem = check(plan);
      if (!problem) return plan;
      feedback = `\n\nYour previous plan had a problem: ${problem}\nReturn the corrected full JSON.`;
    } catch (error) {
      feedback = `\n\nYour previous answer was not valid for the schema: ${String(error).slice(0, 600)}\nReturn the corrected full JSON.`;
    }
    console.warn(`⚠️ Director plan rejected (attempt ${attempt}):`, feedback.replace(/\s+/g, " ").trim().slice(0, 400));
  }
  throw new Error('The director could not produce a valid plan');
}

/**
 * A revision: the saved plan plus the client's note. Text only (no files are
 * re-sent), and the director may only work with what already exists.
 */
export async function reviseVideo(
  plan: DirectorPlan,
  note: string,
  brief: string,
  existing: Record<string, { kind: 'image' | 'video'; cutoutUrl?: string }>
): Promise<DirectorPlan> {
  const ids = Object.keys(existing).filter((id) => !id.endsWith('-motion'));
  const cutouts = ids.filter((id) => existing[id].cutoutUrl);
  const instructions = BRIEF.replace('{{LENGTH}}', 'Keep the current length unless the note asks otherwise.');
  const task = [
    '',
    'YOU ALREADY MADE THIS VIDEO. The client watched it and left a note. Return the full plan again with ONLY the changes the note asks for.',
    '- Keep every narration sentence word for word unless the note requires different spoken words: unchanged narration keeps the recorded voice.',
    '- Keep musicPrompt and signatureSound exactly as they are unless the note is about music or sound.',
    `- You can only use these files: ${ids.join(', ')}. Do not add lifestyleShots or animate entries that are not already in the plan. cutout:true is only possible for: ${cutouts.join(', ') || 'none'}.`,
    '- If the note gives a fact (a phone number, a price, a name), use it exactly. Update "warnings" to match the new state.',
    '',
    "CLIENT'S ORIGINAL TEXT:",
    brief,
    '',
    'CURRENT PLAN:',
    JSON.stringify(plan),
    '',
    "CLIENT'S NOTE:",
    note,
  ].join('\n');
  const assets = ids.map((id) => ({ id, kind: existing[id].kind })) as SmartAsset[];
  return askDirector([{ text: `${instructions}\n${task}` }], (candidate) => checkPlan(candidate, assets, brief, 'auto', true), 280_000);
}

// Things the renderer cannot fix by construction.
function checkPlan(plan: DirectorPlan, assets: SmartAsset[], brief: string, length: VideoLength, revision: boolean): string | null {
  const ids = new Set([...assets.map((a) => a.id), ...(plan.lifestyleShots || []).map((shot) => shot.id)]);
  const badShot = (plan.lifestyleShots || []).find((shot) => !assets.some((a) => a.id === shot.fromAsset && a.kind === 'image'));
  const badMotion = (plan.animate || []).find((m) => !ids.has(m.asset));
  if (badMotion) return `animate uses asset "${badMotion.asset}", which does not exist.`;
  if (badShot) return `lifestyleShots "${badShot.id}" must use an existing image asset as fromAsset.`;
  for (const [i, scene] of plan.scenes.entries()) {
    const used = [scene.background.asset, ...scene.blocks.flatMap((b) => ('asset' in b ? [b.asset] : 'assets' in b ? b.assets : []))].filter(Boolean) as string[];
    const unknown = used.find((id) => !ids.has(id));
    if (unknown) return `scene ${i + 1} uses asset "${unknown}", which does not exist. Valid ids: ${[...ids].join(', ')}.`;
    if (scene.background.type !== 'brand' && !scene.background.asset) return `scene ${i + 1} background "${scene.background.type}" needs an asset.`;
    // A full-frame photo carries the scene; elsewhere a thin stack looks empty.
    const minimum = scene.background.type === 'mediaFull' ? 2 : 3;
    if (scene.blocks.length < minimum) return `scene ${i + 1} has only ${scene.blocks.length} blocks; it needs at least ${minimum} (see the scene recipes).`;
  }
  if (revision) return null; // the client's note outranks the word-count and file-spread rules
  const words = plan.scenes.reduce((n, scene) => n + scene.narration.split(/\s+/).length, 0);
  const briefWords = brief.split(/\s+/).filter(Boolean).length;
  // A thin brief must not be padded, so the floor follows what the client gave.
  const minimum = length === 'script' ? Math.round(briefWords * 0.7) : Math.min(plan.format === 'product' ? 55 : 80, Math.max(40, briefWords));
  if (words < minimum) {
    return length === 'script'
      ? `the narration has ${words} words but the client's script has about ${briefWords}; narrate the whole script, do not shorten it.`
      : `the narration is only ${words} words; this video needs at least ${minimum + 10}.`;
  }

  // Every upload is accounted for, and no file is worn out while good ones go unseen.
  const unlisted = assets.filter((a) => !plan.assets.some((listed) => listed.id === a.id)).map((a) => a.id);
  if (unlisted.length) return `"assets" must list every file with its role; missing: ${unlisted.join(', ')}.`;
  const uses = new Map<string, number>();
  for (const scene of plan.scenes) {
    const shown = [scene.background.asset, ...scene.blocks.flatMap((b) => ('asset' in b ? [b.asset] : 'assets' in b ? b.assets : []))];
    for (const id of new Set(shown.filter(Boolean) as string[])) uses.set(id, (uses.get(id) || 0) + 1);
  }
  const unseen = plan.assets.filter((a) => ['photo', 'clip', 'product'].includes(a.role) && !uses.has(a.id)).map((a) => a.id);
  const overused = [...uses].filter(([, count]) => count > 2).map(([id]) => id);
  if (unseen.length && overused.length) {
    return `${overused.join(', ')} appear in more than two scenes while ${unseen.join(', ')} are never shown. Spread the client's files across the scenes (or mark a file "skip" with the reason in its description).`;
  }
  const last = plan.scenes[plan.scenes.length - 1];
  if (!last.blocks.some((b) => b.type === 'highlight')) return 'the last scene needs a highlight block (the contact, shop, code or URL).';
  if (plan.format === 'tour' && plan.scenes.filter((scene) => scene.background.type === 'mediaFull').length < 3) return 'a tour needs at least 3 scenes with a mediaFull background, each showing a different photo.';
  return null;
}
