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

function prompt(lead: FreeVideoLead, script: string): string {
  const domain = displayDomain(lead.website_domain);
  return `You are the friendly assistant of Szilard's video team at BlueFX. ${lead.first_name || 'The customer'} made a free sample video ad for ${domain} and can get the full video ad without the watermark. Before buying, the customer tells you what to change, and you make sure the team knows exactly what to do.

THE VIDEO AD'S SCRIPT, SCENE BY SCENE:
${script || '(not available)'}

CHANGES THE TEAM CAN MAKE:
- Any words in the script: a line, the first line, product or service wording, the offer, prices, the business name said the right way.
- The phone number, website, address or email shown or said at the end.
- The voice: man or woman, accent, calmer or more energetic.
- The music: calmer, more upbeat, another style, or no music.
- The person on camera: a different presenter, made as a picture, so almost any look works: man or woman, any age, clothes, hats, glasses, facial hair, a shop or outdoor background (keep it tasteful); or no person at all.
- The customer's own photos, logo or video clips: the customer emails them to support@bluefx.net after buying.
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
- Then ask ONE helpful question that makes the change come out right, when there is one worth asking. Examples: for a new presenter, age or look (casual or in a suit); for no music, whether they still want a calm background sound or total silence; for a voice, man or woman and calm or upbeat; for a name said wrong, how the name should sound, like "CAR-low"; for a phone number, the number.
- Once their answers are in, ask if there is anything else they would like changed, unless the customer already said that's all ("that's it", "nothing else", "that's all"): then finish right away.
- Only when they say that's everything, sum up the changes in a short friendly sentence and mention they can get their changed video ad with the green button. Never push the button earlier.
- 1 to 3 short sentences per message. Vary your words; don't start every message with "Got it".
- Say "your video ad", never "it" for the video ad. No dashes. No emojis. Never mention prices or the AI.
- Never promise a time other than this: after the payment, a real person on the team makes the changes and sends the changed video ad by email within 24 hours.
- When something can't be done, say so kindly and offer the closest change the team can make.

WHEN THE LIST IS CLEAR: only after the customer said there is nothing else, set "done" to true and put each change as one short line in "changes" in plain words a customer understands (for example "Put 555-123-4567 on the last screen", "A man in his 50s on camera instead of the woman"; never the word AI). Before that, "done" is false and "changes" is empty. If the customer adds more later, set "done" to true again with the full updated list.

Answer ONLY as JSON: {"reply": string, "done": boolean, "changes": string[]}`;
}

/** One turn of the chat. Throws on a model or database error (the route answers with a friendly fallback). */
export async function chatTurn(lead: FreeVideoLead, messages: ChatMessage[]): Promise<ChatAnswer | 'limit'> {
  if ((await callsToday(lead.id)) >= CHAT_DAILY_CAP) return 'limit';
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set');
  const script = await scriptOf(lead);
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${FREE_DIRECTOR.model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: prompt(lead, script) }] },
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
  const changes =
    parsed.done === true && Array.isArray(parsed.changes)
      ? parsed.changes.filter((c): c is string => typeof c === 'string' && c.trim().length > 2).map((c) => c.trim().slice(0, 200)).slice(0, 12)
      : [];
  const last = messages[messages.length - 1]?.text ?? '';
  await recordEvent({ event: 'change_chat', leadId: lead.id, ref: lead.ref, meta: { said: last.slice(0, CHAT_MAX_CHARS), reply: reply.slice(0, 600) } });
  if (changes.length) await recordEvent({ event: 'change_plan', leadId: lead.id, ref: lead.ref, meta: { changes } });
  return { reply, changes: changes.length ? changes : null };
}

/** The newest confirmed change list of a lead, or null. */
export async function latestChangePlan(leadId: string): Promise<string[] | null> {
  const { data, error } = await eventsTable().select('meta').eq('lead_id', leadId).eq('event', 'change_plan').order('at', { ascending: false }).limit(1);
  if (error) throw new Error(`change plan not read: ${error.message}`);
  const changes = (data?.[0]?.meta as { changes?: unknown } | undefined)?.changes;
  return Array.isArray(changes) && changes.length ? (changes.filter((c) => typeof c === 'string') as string[]) : null;
}

/** The texts of the changes a buyer asked for so far (newest last), for the ready page. */
export async function requestedChanges(leadId: string): Promise<string[]> {
  const { data } = await eventsTable().select('meta').eq('lead_id', leadId).eq('event', 'change_request').order('at', { ascending: true });
  return (data ?? []).map((row: { meta?: { text?: unknown } }) => (typeof row.meta?.text === 'string' ? row.meta.text : '')).filter(Boolean);
}
