import { scriptWords } from './timing';
import { usage } from './usage';

/**
 * Captions show numbers the way people write them: "10 eggs", "$12", "642 Main Street".
 *
 * The voice needs numbers spelled out ("twelve dollars"), so the script has them in words,
 * and the captions, which show the script word by word, did too ("TWELVE DOLLARS").
 * The transcript of the recording is no help: it writes "$12 dollars", "5:00" for "at five",
 * and leaves small numbers as words.
 *
 * So one small model call reads the lines and names each number phrase with its digit form.
 * The model only names; code decides. A phrase counts only if it is found word for word in
 * its line, the digit form contains a digit and brings in no word that was not in the phrase.
 * Anything else, or a failed call, leaves the captions as they were.
 */

// The small model missed a number now and then ("by eight" stayed in words in one run of three);
// this one gave the same, complete answer every time. It takes 10 to 25 seconds, which costs
// nothing: the call runs while the voice and the music are being made.
const MODEL = 'gemini-3.6-flash';

/** Words `from`..`to` of a line (as scriptWords counts them) are shown as `text`. */
export interface NumberSpan {
  from: number;
  to: number;
  text: string;
}

const ENDING = /[.,!?;:…—–]+$/;
const lettersOf = (text: string) => text.toLowerCase().replace(/[^\p{L}]+/gu, '');
const wordsOf = (text: string) => text.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);

/** Where a quoted phrase sits in a line, searching from word `after` on. */
function locate(words: { token: string }[], phrase: string, after: number): [number, number] | null {
  const wanted = scriptWords(phrase).map((word) => word.token);
  if (!wanted.length) return null;
  for (let i = after; i + wanted.length <= words.length; i++) {
    if (wanted.every((token, k) => words[i + k].token === token)) return [i, i + wanted.length - 1];
  }
  return null;
}

/** The spans of one line from what the model named, with everything doubtful left out. */
function spansOf(line: string, named: { words: string; digits: string }[]): NumberSpan[] {
  const words = scriptWords(line);
  const spans: NumberSpan[] = [];
  let after = 0;
  for (const { words: phrase, digits } of named) {
    const found = locate(words, phrase, after);
    const text = digits.trim().replace(ENDING, '');
    const spoken = lettersOf(phrase);
    if (!found || !/\p{N}/u.test(text) || text.length > 32) continue;
    // "5 PM" for "five p.m." is fine; a word that was never said is not.
    if (!wordsOf(text).every((word) => spoken.includes(word))) continue;
    // The punctuation that ended the phrase ends the digits too: "twelve dollars," → "$12,".
    spans.push({ from: found[0], to: found[1], text: text + (ENDING.exec(words[found[1]].raw)?.[0] ?? '') });
    after = found[1] + 1;
  }
  return spans;
}

/**
 * The number phrases of every line, by line text. A line without numbers gets an empty
 * list, so it counts as checked; a failed call returns nothing and the captions stay in words.
 */
export async function captionDigits(lines: string[], languageName: string, model = MODEL): Promise<Record<string, NumberSpan[]>> {
  const unique = [...new Set(lines.map((line) => line.trim()).filter(Boolean))];
  if (!unique.length) return {};
  const prompt = `These are the spoken lines of a video ad in ${languageName}. The captions show them word by word.

Find every number that is written out in words: counts ("ten eggs"), prices, amounts, times, dates, years, ages, percentages, measurements, house numbers, phone numbers.
For each one give the exact words as they stand in the line, and how a caption writes them with digits in ${languageName}.
Examples in English: "ten" → "10"; "twelve dollars" → "$12"; "twenty percent" → "20%"; "nine to six" → "9 to 6"; "at five" → quote "five", write "5"; "six forty-two Main Street" → quote "six forty-two", write "642"; "five thousand five hundred" → "5,500"; "two million" → "2 million"; "two for one" → "2 for 1".

Rules:
- Quote only the number words, plus a currency or percent word that the digits take in. Leave the words around them out.
- A price keeps the ad's currency sign even where the currency is not said again: "a pizza is twelve dollars and a salad is six" → "$12" and "$6". A number that is not money never gets a sign.
- An amount that is written twice, like "$12 dollars", is written once: "$12".
- Leave alone what is not a number: "one of the best", "no one", "the one", "someone"; "zero" where it means "no" ("zero effort", "zero risk"); "first", "second" and other ordinals; "a couple", "a few", "dozens", "half".
- Never change a value. When in doubt, leave the phrase out.

Answer JSON only: {"numbers":[{"line":1,"words":"twelve dollars","digits":"$12"}]}. An empty list when there are none.

LINES:
${unique.map((line, i) => `${i + 1}. ${line}`).join('\n')}`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GOOGLE_GENERATIVE_AI_API_KEY || '' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0 } }),
      signal: AbortSignal.timeout(75_000),
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
    const json = await res.json();
    usage.captionNumbers(unique.length);
    const text = (json.candidates?.[0]?.content?.parts || []).map((part: { text?: string }) => part.text || '').join('');
    const named = (JSON.parse(text).numbers || []) as { line?: number; words?: string; digits?: string }[];
    return Object.fromEntries(
      unique.map((line, i) => [
        line,
        spansOf(
          line,
          named.flatMap((n) => (n.line === i + 1 && typeof n.words === 'string' && typeof n.digits === 'string' ? [{ words: n.words, digits: n.digits }] : []))
        ),
      ])
    );
  } catch (error) {
    console.warn('⚠️ Caption numbers stay in words:', String(error).slice(0, 160));
    return {};
  }
}

/** The caption words of a line with its number phrases merged into their digit form. Pure. */
export function withDigits<T extends { raw: string; time: number }>(tokens: T[], spans: NumberSpan[] | undefined): T[] {
  if (!spans?.length) return tokens;
  const shown: T[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const span = spans.find((s) => s.from === i && s.to < tokens.length);
    if (span) {
      // One caption word from the first spoken word of the phrase to the next word after it.
      shown.push({ ...tokens[i], raw: span.text });
      i = span.to;
    } else shown.push(tokens[i]);
  }
  return shown;
}
