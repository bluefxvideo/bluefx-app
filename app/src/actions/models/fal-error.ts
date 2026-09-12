/**
 * Turn a raw FAL error response into a message safe to show users:
 * no third-party provider names, no raw JSON, and safety rejections become
 * an actionable explanation. FAL surfaces blocks two ways —
 *   - hard: type "content_policy_violation" ("flagged by a content checker")
 *   - soft: "The model did not generate the expected output for this prompt"
 * Both are usually the safety checker; the wording tells the user what to fix.
 */
function falDetailMessage(errorText: string): string {
  // Extract the human-readable msg(s) from fal's {"detail":[{msg,...}]} shape
  try {
    const parsed = JSON.parse(errorText) as { detail?: Array<{ msg?: string }> | string };
    return Array.isArray(parsed.detail)
      ? parsed.detail.map((d) => d.msg || '').filter(Boolean).join(' ')
      : String(parsed.detail || '');
  } catch {
    return errorText;
  }
}

/**
 * True when fal rejected the request on safety grounds rather than failing.
 * GPT Image 2.5 answers 422 with type "content_policy_violation" (billable
 * units 0) for things Nano Banana accepts, e.g. a reference photo of a woman
 * in a low-cut top, so callers can rerun the same request on Nano Banana 2.
 */
export function isFalSafetyRefusal(errorText: string): boolean {
  const detailMsg = falDetailMessage(errorText);
  return (
    detailMsg.includes('flagged by a content checker') ||
    errorText.includes('content_policy_violation') ||
    detailMsg.includes('did not generate the expected output')
  );
}

export function friendlyFalImageError(status: number, errorText: string): string {
  const detailMsg = falDetailMessage(errorText);

  if (detailMsg.includes('flagged by a content checker') || errorText.includes('content_policy_violation')) {
    return 'Blocked by the image safety filter: the prompt (or a reference image) was flagged as inappropriate. Remove suggestive wording — e.g. "sexy", revealing-clothing or body-focused descriptions — and generate again. Credits for this attempt were not kept.';
  }
  if (detailMsg.includes('did not generate the expected output')) {
    return 'The image engine declined this prompt without producing an image — usually the safety checker (suggestive wording, or edits like that to photos of real people), sometimes an instruction it cannot apply to this frame. Reword the swap instruction and generate again. Credits for this attempt were not kept.';
  }
  return `Image engine error (${status}): ${detailMsg.substring(0, 160) || 'no details returned'}`;
}
