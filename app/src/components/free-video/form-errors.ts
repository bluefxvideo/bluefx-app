/**
 * The free video form's checks and the mapping from an API answer to a message, a place and a next
 * step. Plain functions (no 'use client'), so the dev preview page can render every message too.
 */

import { ERRORS, NEXT_STEPS, SUPPORT_EMAIL, VALIDATION } from '@/lib/free-video/copy';
import type { FreeVideoErrorCode } from '@/types/free-video';

export type FormField = 'website' | 'firstName' | 'email';
export type NextStepKind = 'resend' | 'noWebsite';

export interface FormProblem {
  /** Where the message shows: under that field, or above the send button when null. */
  field: FormField | null;
  message: string;
  /** A way forward under the message, so no answer is a dead end. */
  nextStep?: NextStepKind;
  /** unreadable: the website field is emptied so the visitor types another page. */
  clearWebsite?: boolean;
}

/** The answer codes, as FreeVideoErrorCode lists them (types/free-video.ts). */
export const ERROR_CODES: readonly FreeVideoErrorCode[] = [
  'invalid',
  'refused',
  'notFound',
  'unreadable',
  'duplicateEmail',
  'duplicateSite',
  'tooMany',
  'closed',
  'paused',
  'generic',
];

/** The host name without www., the way the server keys a website. Falls back to the trimmed text. */
export function domainOf(website: string): string {
  const text = website.trim();
  try {
    return new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`).hostname.replace(/^www\./, '') || text;
  } catch {
    return text;
  }
}

/** Step 1: the website field. Null when the text can go to step 2. */
export function checkWebsite(raw: string): FormProblem | null {
  const text = raw.trim();
  if (text.length < 3) return { field: 'website', message: VALIDATION.websiteMissing };
  if (text.length > 500) return { field: 'website', message: VALIDATION.websiteLong };
  // An email address typed into the website field.
  if (text.includes('@') && !text.includes('/')) return { field: 'website', message: ERRORS.invalid };
  try {
    const host = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`).hostname;
    if (!host.includes('.')) return { field: 'website', message: ERRORS.invalid };
  } catch {
    return { field: 'website', message: ERRORS.invalid };
  }
  return null;
}

/** Step 2: the same rules as FreeVideoLeadSchema, so most typos never reach the server. */
export function checkFirstName(raw: string): FormProblem | null {
  const text = raw.trim();
  if (!text) return { field: 'firstName', message: VALIDATION.firstNameMissing };
  if (text.length > 60) return { field: 'firstName', message: VALIDATION.firstNameLong };
  if (/https?:|www\.|\.[a-z]{2,}\b|[<>@]/i.test(text)) return { field: 'firstName', message: VALIDATION.firstNameOnly };
  return null;
}

export function checkEmail(raw: string): FormProblem | null {
  const text = raw.trim();
  if (text.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)) return { field: 'email', message: VALIDATION.email };
  return null;
}

/** The message, place and next step for an answer code. */
export function problemForCode(code: FreeVideoErrorCode | undefined, website: string): FormProblem {
  const domain = domainOf(website);
  switch (code) {
    case 'invalid':
      return { field: 'website', message: ERRORS.invalid };
    case 'refused':
      return { field: 'website', message: ERRORS.refusedHost, nextStep: 'noWebsite' };
    case 'notFound':
      return { field: 'website', message: ERRORS.notFound(domain) };
    case 'unreadable':
      return { field: 'website', message: ERRORS.unreadable(domain), clearWebsite: true };
    case 'duplicateSite':
      return { field: 'website', message: ERRORS.duplicateSite(domain), nextStep: 'resend' };
    case 'duplicateEmail':
      return { field: 'email', message: ERRORS.duplicateEmail, nextStep: 'resend' };
    case 'tooMany':
      return { field: null, message: ERRORS.tooMany };
    case 'closed':
      return { field: null, message: ERRORS.closed };
    case 'paused':
      return { field: null, message: ERRORS.paused };
    default:
      return { field: null, message: ERRORS.generic };
  }
}

const asText = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
const isCode = (value: unknown): value is FreeVideoErrorCode =>
  typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);

/** A status without a code: the closest answer. */
function codeOfStatus(status: number): FreeVideoErrorCode {
  if (status === 422) return 'unreadable';
  if (status === 429) return 'tooMany';
  if (status === 503) return 'paused';
  return 'generic';
}

/**
 * An error answer of POST /api/free-video → what the form shows. Reads code and field at the top
 * level ({ success: false, error, code, field }) or inside details (createApiError's shape).
 */
export function problemFromAnswer(status: number, answer: unknown, website: string): FormProblem {
  const body = (answer && typeof answer === 'object' ? answer : {}) as Record<string, unknown>;
  const details = (body.details && typeof body.details === 'object' ? body.details : {}) as Record<string, unknown>;
  const rawCode = body.code ?? details.code;
  const code = isCode(rawCode) ? rawCode : undefined;
  const field = asText(body.field) ?? asText(details.field);
  const message = asText(body.error);

  // A field message from the schema check: the server's own words (VALIDATION in copy.ts) under that field.
  if (field && (!code || code === 'invalid')) {
    if (field === 'firstName' || field === 'email') {
      return { field, message: message ?? (field === 'email' ? VALIDATION.email : VALIDATION.firstNameMissing) };
    }
    if (field === 'website') return { field: 'website', message: message ?? ERRORS.invalid };
    // A field the form fills by itself (consent, the timer): nothing the visitor can fix in a field.
    return { field: null, message: ERRORS.generic };
  }
  const problem = problemForCode(code ?? codeOfStatus(status), website);
  // unreadable: the server's own words, which can name the real cause (a broken security certificate, website.ts).
  if (problem.clearWebsite && message) return { ...problem, message };
  return problem;
}

/** The mailto link of a next step. It opens the visitor's own email app; nothing goes to another server. */
export function nextStepHref(kind: NextStepKind, website: string): string {
  const subject = kind === 'resend' ? NEXT_STEPS.resendSubject : NEXT_STEPS.noWebsiteSubject;
  const body = kind === 'resend' ? NEXT_STEPS.resendBody(website.trim()) : NEXT_STEPS.noWebsiteBody;
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
