// Humanizer for generated scripts.
// Pattern list adapted from Wikipedia's "Signs of AI writing" (WikiProject AI Cleanup),
// plus spoken-word rules because these scripts are read aloud by TTS.

export interface AiTell {
  pattern: string;
  matches: string[];
}

export interface AiTellReport {
  total: number;
  tells: AiTell[];
}

// Each entry: label + regex. Word-boundary, case-insensitive, global.
const TELL_PATTERNS: Array<[string, RegExp]> = [
  ['Inflated importance', /\b(stands? as|serves? as|is a testament|testament to|a (?:vital|significant|crucial|pivotal|key) (?:role|moment|step)|underscor(?:es|ing) (?:its|the)|reflects broader|enduring|indelible mark|evolving landscape|setting the stage|game[- ]changer|revolutioniz\w+)\b/gi],
  ['Overused AI words', /\b(delve|tapestry|landscape of|leverag\w+|elevate|unlock(?:ing)? (?:the|your)|seamless(?:ly)?|robust|cutting[- ]edge|next[- ]level|supercharge|effortless(?:ly)?|empower(?:s|ing)?|harness(?:ing)?|streamline)\b/gi],
  ['Sales adjectives', /\b(vibrant|breathtaking|stunning|groundbreaking|renowned|must[- ]have|world[- ]class|state[- ]of[- ]the[- ]art|ultimate|incredible|amazing|revolutionary)\b/gi],
  ['Not X but Y', /\b(not (?:just|only|merely) [^.!?\n]{2,60}?,? (?:but|it'?s|its) )/gi],
  ['Shallow -ing tail', /,\s(?:highlighting|underscoring|emphasizing|ensuring|showcasing|fostering|cultivating|reflecting|symbolizing) \b/gi],
  ['Fake-candid opener', /(^|[.!?]\s+)(honestly\?|look,|here'?s the thing|let'?s be honest|real talk|the truth is)/gim],
  ['Announcing the point', /\b(let'?s dive in|let'?s break (?:this|it) down|here'?s what you need to know|without further ado|in this video,? (?:i'?m going to|we'?ll|we will)|now let'?s look at)\b/gi],
  ['Pretend deeper truth', /\b(the real question is|at its core|what really matters|the deeper issue|the heart of the matter|fundamentally)\b/gi],
  ['Chatbot residue', /\b(i hope this helps|certainly!|of course!|great question|absolutely!|as an ai|feel free to|let me know if)\b/gi],
  ['Filler phrases', /\b(in order to|due to the fact that|at this point in time|in the event that|it is important to note|it'?s worth noting|needless to say|as you can see)\b/gi],
  ['Generic upbeat ending', /\b(the future (?:is|looks) bright|exciting times (?:lie )?ahead|the possibilities are endless|the sky'?s the limit|take (?:it|your \w+) to the next level)\b/gi],
  ['Formulaic saying', /\b(\w+ is the (?:new|language|currency|architecture) of \w+)\b/gi],
  ['Em/en dash', /[—–]|\s--\s/g],
  ['Forced triad', /\b(\w+), (\w+), and (\w+)\b(?=[.!?])/g],
];

export function detectAiTells(text: string): AiTellReport {
  const tells: AiTell[] = [];
  for (const [pattern, re] of TELL_PATTERNS) {
    const matches = Array.from(text.matchAll(re)).map((m) => m[0].trim()).filter(Boolean);
    if (matches.length) tells.push({ pattern, matches: matches.slice(0, 8) });
  }
  return { total: tells.reduce((n, t) => n + t.matches.length, 0), tells };
}

export function getHumanizePrompt(script: string, voiceSample: string | null, spoken: boolean): string {
  const voiceBlock = voiceSample
    ? `## The writer's own voice (match this)
Read this sample of how the writer actually talks about their business. Match its sentence length, word choice, punctuation habits and rhythm. Do not make it more formal than the sample.

---
${voiceSample.slice(0, 6000)}
---
`
    : `## Voice
No sample is available. Write like one experienced person talking to one viewer: plain words, contractions, short sentences, an occasional aside.
`;

  const spokenBlock = spoken
    ? `## Spoken-word rules (this script is read aloud by a voice engine)
- Vary sentence length. Break up sentences longer than about 25 words; leave good short and medium sentences alone. Do not chop every sentence into fragments.
- Use contractions. No parentheses; a voice engine reads them flat.
- Write numbers the way you would say them.
- No bullet lists inside narration. Keep any section labels (HOOK:, CTA:, SCENE 1:) exactly as they are.
- End on the concrete call to action, not on a vague upbeat line.
`
    : '';

  return `You are an editor who removes the fingerprints of machine writing from marketing scripts so they sound like the person who sells the product wrote them.

${voiceBlock}
## What to remove (do not just swap one word, restructure the sentence)
1. Inflated importance: "stands as a testament", "pivotal", "game-changer", "revolutionize", "unlock", "elevate", "supercharge", "seamless", "cutting-edge", "next level".
2. Sales adjectives with no information: "incredible", "amazing", "stunning", "ultimate", "world-class". Replace with the specific thing that is good.
3. "Not just X, it's Y" and "not only... but also" constructions. Say the one thing you mean.
4. Forced groups of three. Two items or four are fine when that is the real count.
5. Trailing -ing phrases that fake depth ("..., ensuring maximum results").
6. Fake-candid openers ("Honestly?", "Here's the thing", "Let's be honest") and announcements ("Let's dive in", "In this video I'm going to show you").
7. "The real question is", "at its core", "what really matters".
8. Chatbot residue ("Great question", "I hope this helps", "feel free to").
9. Filler ("in order to", "it's worth noting", "as you can see", "needless to say").
10. Generic upbeat endings ("the possibilities are endless", "take it to the next level").
11. Em dashes and en dashes. Use a period, comma, or colon instead.
12. Repeated sentence openings and the same word three times in a row of sentences.
${spokenBlock}
## Hard rules
- Keep every claim, number, price, name, offer detail and call to action, at the same strength: do not hedge a confident claim or inflate a modest one. Do not add any fact, statistic, testimonial or guarantee that is not in the script.
- Keep the structure and any section labels. Same language as the input.
- Output ONLY the rewritten script. No preamble, no notes, no quotes around it.

## Script to rewrite
---
${script}
---`;
}
