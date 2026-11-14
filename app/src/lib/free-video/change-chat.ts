import { alertOwner } from '@/lib/free-video/alerts';
import { FREE_DIRECTOR } from '@/lib/free-video/config';
import { eventsTable, readSettings, recordEvent } from '@/lib/free-video/leads';
import { displayDomain } from '@/lib/free-video/website';
import { readPlan } from '@/lib/smart-video/jobs';
import { sceneText } from '@/lib/smart-video/script-rules';
import type { FreeVideoLead } from '@/types/free-video';

/**
 * The change chat on the unlock page (owner 2026-10-27: "let them type in the changes ... the AI should understand
 * and acknowledge ... ask him this, this and that ... after you make the purchase, we will apply the following
 * changes"). Before the payment the visitor tells the AI what to change; the AI knows the video ad's own script,
 * asks short questions when something is unclear, accepts only changes the team can make, and ends with a list.
 * The list is saved as a change_plan event; when the payment arrives, unlock.ts turns it into the first
 * change_request (the owner's email). Until the Phantom applies the list by itself, the promise is "within 24 hours".
 */
export const CHAT_MAX_MESSAGES = 16;
export const CHAT_MAX_CHARS = 600;
/** Model calls per lead per day: enough for a long talk, never a free chatbot. */
const CHAT_DAILY_CAP = 40;
const CHAT_TIMEOUT_MS = 25_000;

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface ChatAnswer {
  reply: string;
  /** The confirmed change list once the visitor agreed to it, else null. */
  changes: string[] | null;
}

/** The video ad's words, scene by scene, for the model. Empty when the plan cannot be read. */
async function scriptOf(lead: FreeVideoLead): Promise<string> {
  try {
    const settings = await readSettings(true);
    if (!settings?.system_user_id || !lead.job_id) return '';
    const saved = await readPlan(settings.system_user_id, lead.job_id);
    return saved.plan.scenes.map((scene, i) => `Scene ${i + 1}: ${sceneText(scene)}`).join('\n');
  } catch {
    return '';
  }
}

/** Model calls this lead made in the last 24 hours. */
async function callsToday(leadId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await eventsTable().select('id', { count: 'exact', head: true }).eq('lead_id', leadId).eq('event', 'change_chat').gt('at', since);
  return count ?? 0;
}

/**
 * `lifetime`: a lead on the AI Media Machine offer (the free thank-you page, owner 2026-11-02): one free change by the AI
 * engine, then the customer makes every next change in the AI Media Machine; no team, no $49.
 */
function prompt(lead: FreeVideoLead, script: string, freeUsed: boolean, lifetime = false): string {
  const domain = displayDomain(lead.website_domain);
  const intro = lifetime
    ? `${lead.first_name || 'The customer'} made a free sample video ad for ${domain} with the AI Media Machine, the tool that made it. The customer gets one change free right now, and you make sure the change is clear.`
    : `${lead.first_name || 'The customer'} made a free sample video ad for ${domain} and can get the full video ad without the watermark. Before buying, the customer tells you what to change, and you make sure the team knows exactly what to do.`;
  return `You are the friendly assistant of Szilard's video team at BlueFX. ${intro}

THE VIDEO AD'S SCRIPT, SCENE BY SCENE:
${script || '(not available)'}

CHANGES THE TEAM CAN MAKE:
- Any words in the script: a line, the first line, product or service wording, the offer, prices, the business name said the right way.
- The phone number, website, address or email shown or said at the end.
- The voice: man or woman, accent, calmer or more energetic.
- The music: calmer, more upbeat, another style, or no music.
- The person on camera: a different presenter, made as a picture, so almost any look works: man or woman, any age, clothes, hats, glasses, facial hair, a shop or outdoor background (keep it tasteful); or no person at all.
${lifetime ? "- The customer's own photos, logo or video clips: not in the free change; with the AI Media Machine the customer adds them in the change box." : "- The customer's own photos, logo or video clips: the customer emails them to support@bluefx.net after buying."}
- The captions.
- A completely different video style, one of these 8 (the same looks as the style gallery on the page; the team remakes the video ad in the chosen style):
  * Hand-drawn: a hand draws the story on a whiteboard.
  * Vintage TV: a 1950s black-and-white TV ad. Good for barbers, bakeries, family businesses.
  * News studio: a news anchor opens, then the business's photos tell the story. Good for restaurants, openings, events.
  * Cartoon: friendly cartoon pictures and speech bubbles. Good for insurance, finance, dental, apps.
  * Comic book: comic panels, halftone dots and speech bubbles. Good for auto repair, gyms, food, local deals.
  * Chalkboard: a hand draws the story in chalk. Good for cafes, bakeries, restaurants, teachers.
  * Scrapbook: the business's photos as Polaroids with handwritten notes. Good for bakeries, family businesses.
  * Clay: a claymation ad with clay characters. Good for plumbers, cleaners, pets, family services.
  When the customer wants another style, ask which one and name the 8; when they ask what a style looks like, describe it in one sentence; when they ask which fits best, suggest 1 or 2 that suit their business (from the script) and say why in a few words.
- A shorter video ad.

CHANGES THE TEAM CANNOT MAKE: filming at the customer's place, real celebrities, a completely different topic or business (that is a new video ad, not a change), guaranteed sales or views.

HOW TO TALK (like a friendly person on the team chatting with a customer, never like a form):
- React to what the customer said first, in your own words, warmly and briefly ("A man on camera and no music, sure, we can do both.").
- Do NOT ask questions (owner 2026-11-01: "he should start the change and not ask me"). Make the sensible choices yourself and write them into the list: a presenter's look and clothes that fit the business, music that fits the video ad, a voice that fits the presenter. Never ask "anything else?".
- Ask ONE short question only when a change cannot be made without it: a phone number, website, address or name they did not give, how a name should sound, or a new video style without saying which of the 8.
${lifetime ? (freeUsed ? "- When the list is complete, confirm it in one short friendly sentence and say the free change is already used: with the AI Media Machine they make this change themselves, typed just like here, in about 3 minutes." : "- When the list is complete, confirm it in one short friendly sentence and say you are making these changes now, free: their new video ad shows up right here on this page in about 5 minutes, with the SAMPLE stamp. A completely new style is not part of the free change: say they pick any of the 8 styles in the AI Media Machine.") : freeUsed ? "- When the list is complete, confirm it in one short friendly sentence and say these changes start as soon as they get their video ad. If they think of more, they can just type it." : "- When the list is complete, confirm it in one short friendly sentence and say you are making these changes now: their new video ad shows up right here on this page in about 5 minutes, with the SAMPLE mark until they get their video ad. A completely new style is not part of this: say the team makes it after they get their video ad."}
- 1 to 3 short sentences per message. Vary your words; don't start every message with "Got it".
- Say "your video ad", never "it" for the video ad. No dashes. No emojis. Never mention prices or the AI.
${lifetime ? "- Never promise a time other than this: the free change takes about 5 minutes; in the AI Media Machine every next change takes about 3 minutes. Never offer the team, a person or email for changes." : `- Never promise a time other than this: ${freeUsed ? '' : 'the free change takes about 5 minutes; '}right after the payment, our AI engine makes the changes on their page in about 5 to 10 minutes, and a real person on the team fixes anything that is not right (within 24 hours). A completely new style is made by the team, within 24 hours.`}
- When something can't be done, say so kindly and offer the closest change the team can make.

THE LIST: in every answer, "changes" holds every change the customer asked for so far, one short line each, in plain words a customer understands (for example "Put 555-123-4567 on the last screen", "A man in his 50s on camera instead of the woman"; never the word AI). Write what is known so far even when a detail is still open (for example "A different person on camera" before they said man or woman), and update the lines as answers come in. The customer may pay at any moment, so the list must always be complete. Set "done" to true as soon as every change in the list can be made without another answer (that is almost always the first answer); "done" is false only while you wait for the one missing detail. If the customer adds more later, set "done" to true again with the full updated list.

Answer ONLY as JSON: {"reply": string, "done": boolean, "changes": string[]}`;
}

/**
 * After the free change: the list holds only what was asked since (the page ticks the free change's own lines as made,
 * and a payment then starts only the new lines; owner 2026-11-04, Shannon's new request showed with a tick).
 */
function madeNote(freeText: string): string {
  return `\n\nALREADY MADE BY THE FREE CHANGE (it is in the video ad now):\n${freeText}\n"changes" holds ONLY what the customer asked for after that free change. Never repeat those lines, unless the customer says one of them is still not right: then write it again as a new line saying what is still wrong (for example "Lubbock is still said wrong by the person on camera").`;
}

/** One turn of the chat. Throws on a model or database error (the route answers with a friendly fallback). */
export async function chatTurn(lead: FreeVideoLead, messages: ChatMessage[]): Promise<ChatAnswer | 'limit'> {
  if ((await callsToday(lead.id)) >= CHAT_DAILY_CAP) return 'limit';
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set');
  const script = await scriptOf(lead);
  const { freeChangeOf } = await import('@/lib/free-video/instant-change');
  const free = await freeChangeOf(lead).catch(() => null);
  const freeUsed = Boolean(free && free.status !== 'failed');
  const { offerOf, offerSwitchOf } = await import('@/lib/free-video/offer-switch');
  const lifetime = offerOf(lead, await offerSwitchOf(lead.id).catch(() => null)) === 'machine';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${FREE_DIRECTOR.model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: prompt(lead, script, freeUsed, lifetime) + (freeUsed && free ? madeNote(free.text) : '') }] },
      contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] })),
      generationConfig: { responseMimeType: 'application/json', temperature: 0.4, thinkingConfig: { thinkingLevel: 'low' } },
    }),
    signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`change chat model ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const json = await res.json();
  const text: string = (json.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
  const parsed = JSON.parse(text) as { reply?: unknown; done?: unknown; changes?: unknown };
  const reply = typeof parsed.reply === 'string' ? parsed.reply.replace(/\s[–—]\s/g, ', ').replace(/[–—]/g, ', ').trim() : '';
  if (!reply) throw new Error('change chat model gave no reply');
  // The running list is saved after every answer (owner 2026-10-27, Tim paid while the chat was still asking "man or
  // woman?" and his changes were lost): a payment at any moment carries everything asked for so far. The page only
  // shows the list (and the "Changed Video Ad" button) once the customer said that's all.
  const list = Array.isArray(parsed.changes)
    ? parsed.changes.filter((c): c is string => typeof c === 'string' && c.trim().length > 2).map((c) => c.trim().slice(0, 200)).slice(0, 12)
    : [];
  const done = parsed.done === true && list.length > 0;
  // Owner 2026-11-04 (Shannon): once the free change was used, the model still answered "we will fix it right away" and
  // nothing ran. A finished list now gets a fixed answer that says what the next change takes.
  const said = freeUsed && done ? await usedReply(lead, lifetime) : reply;
  const last = messages[messages.length - 1]?.text ?? '';
  await recordEvent({ event: 'change_chat', leadId: lead.id, ref: lead.ref, meta: { said: last.slice(0, CHAT_MAX_CHARS), reply: said.slice(0, 600) } });
  if (list.length) await recordEvent({ event: 'change_plan', leadId: lead.id, ref: lead.ref, meta: { changes: list, done } });
  return { reply: said, changes: done ? list : null };
}

/** The chat's fixed answer once the free change is used: the AI Media Machine page's, or the $49 page's with today's price. */
async function usedReply(lead: FreeVideoLead, lifetime: boolean): Promise<string> {
  if (lifetime) {
    const { RESULT_SALES } = await import('@/lib/free-video/result-sales');
    return RESULT_SALES.freeTop.free.usedReply;
  }
  const { UNLOCK_PAGE } = await import('@/lib/free-video/unlock-page');
  const { clickBankUnlockPrice, unlockPriceOf } = await import('@/lib/free-video/unlock-price');
  const { isClickBankRef } = await import('@/lib/free-video/funnel');
  // A ClickBank funnel lead always pays $49 (item 12 has one price), never the FastSpring clock's $99.
  const price = isClickBankRef(lead.ref) ? clickBankUnlockPrice() : await unlockPriceOf(lead.id).catch(() => null);
  return UNLOCK_PAGE.chat.free.usedReply(price?.price ?? '$49');
}

/** The newest change list of a lead (confirmed or still being chatted about), or null. */
export async function latestChangePlan(leadId: string): Promise<string[] | null> {
  const { data, error } = await eventsTable().select('meta').eq('lead_id', leadId).eq('event', 'change_plan').order('at', { ascending: false }).limit(1);
  if (error) throw new Error(`change plan not read: ${error.message}`);
  const changes = (data?.[0]?.meta as { changes?: unknown } | undefined)?.changes;
  return Array.isArray(changes) && changes.length ? (changes.filter((c) => typeof c === 'string') as string[]) : null;
}

/** What the customer typed in the change chat (oldest first), for the owner when no list was saved. */
export async function chatWordsOf(leadId: string): Promise<string[]> {
  const { data } = await eventsTable().select('meta').eq('lead_id', leadId).eq('event', 'change_chat').order('at', { ascending: true }).limit(40);
  return (data ?? []).map((row: { meta?: { said?: unknown } }) => (typeof row.meta?.said === 'string' ? row.meta.said.trim() : '')).filter(Boolean);
}

/** The texts of the changes a buyer asked for so far (newest last), for the ready page. */
export async function requestedChanges(leadId: string): Promise<string[]> {
  const { data } = await eventsTable().select('meta').eq('lead_id', leadId).eq('event', 'change_request').order('at', { ascending: true });
  return (data ?? []).map((row: { meta?: { text?: unknown } }) => (typeof row.meta?.text === 'string' ? row.meta.text : '')).filter(Boolean);
}

/**
 * The safety net (owner 2026-10-27, after the Google key ran dry): when the model fails, the visitor's own words are
 * saved as the change list (so the payment still carries them to the team) and the owner is emailed once a day.
 * Never throws.
 */
export async function chatFallback(lead: FreeVideoLead, messages: ChatMessage[], error: unknown): Promise<ChatAnswer> {
  const changes = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.text.trim().slice(0, 200))
    .filter(Boolean)
    .slice(-8);
  try {
    if (changes.length) await recordEvent({ event: 'change_plan', leadId: lead.id, ref: lead.ref, meta: { changes, fallback: true } });
    await alertOwner(
      [
        {
          key: `change-chat-down:${new Date().toISOString().slice(0, 10)}`,
          line: `The change chat on the $49 page could not reach Google (${String(error).slice(0, 160)}). Visitors still see a friendly answer and their own words are saved as their change list (first seen on ${displayDomain(lead.website_domain)}). Check GOOGLE_GENERATIVE_AI_API_KEY credit.`,
        },
      ],
      'the change chat is down'
    );
  } catch (e) {
    console.error('❌ [free-video] Change chat fallback could not save:', e);
  }
  return {
    reply: 'Thanks! I saved your change for my team. Tap the green button, and after you pay, a real person on my team makes your changes and emails you your changed video ad within 24 hours. Want to add something? Just type it here.',
    changes: changes.length ? changes : null,
  };
}
