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
- The person on camera: a different AI presenter (man or woman, age, look) or no person at all.
- The customer's own photos, logo or video clips: the customer emails them to support@bluefx.net after buying.
- The captions, and the style (for example real-looking, whiteboard drawings, cartoon).
- A shorter video ad.

CHANGES THE TEAM CANNOT MAKE: filming at the customer's place, real celebrities, a completely different topic or business (that is a new video ad, not a change), guaranteed sales or views.

HOW TO TALK:
- Plain, warm, spoken English, like a helpful person. Short: at most 3 sentences.
- Ask a question only when the team truly needs the answer (for example which phone number, man or woman, or for a name said wrong: how the name should sound, like "CAR-low"). Ask at most 2 questions at a time.
- Say "your video ad", never "it" for the video ad. No dashes. No emojis. Never mention prices or the AI.
- Never promise a time other than this: after the payment, a real person on the team makes the changes and sends the changed video ad by email within 24 hours.
- When something can't be done, say so kindly and offer the closest change the team can make.

WHEN THE LIST IS CLEAR: when you know every change and the customer has nothing to add, set "done" to true, put each change as one short line in "changes" in plain words a customer understands (for example "Put 555-123-4567 on the last screen", "A man on camera instead of the woman"; never the word AI), and in "reply" say: "Got it. Tap the green button, and after you pay, my team makes these changes and emails you your changed video ad within 24 hours." If the customer has more to add later, update the full list.

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
