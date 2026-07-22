/**
 * Turn a raw FAL error response into a message safe to show users:
 * no third-party provider names, no raw JSON, and safety rejections become
 * an actionable explanation. FAL surfaces blocks two ways —
 *   - hard: type "content_policy_violation" ("flagged by a content checker")
 *   - soft: "The model did not generate the expected output for this prompt"
 * Both are usually the safety checker; the wording tells the user what to fix.
 */
export function friendlyFalImageError(status: number, errorText: string): string {
  // Extract the human-readable msg(s) from fal's {"detail":[{msg,...}]} shape
  let detailMsg = '';
  try {
    const parsed = JSON.parse(errorText) as { detail?: Array<{ msg?: string }> | string };
    detailMsg = Array.isArray(parsed.detail)
      ? parsed.detail.map((d) => d.msg || '').filter(Boolean).join(' ')
      : String(parsed.detail || '');
  } catch {
    detailMsg = errorText;
  }

  if (detailMsg.includes('flagged by a content checker') || errorText.includes('content_policy_violation')) {
    return 'Blocked by the image safety filter: the prompt (or a reference image) was flagged as inappropriate. Remove suggestive wording — e.g. "sexy", revealing-clothing or body-focused descriptions — and generate again. Credits for this attempt were not kept.';
  }
  if (detailMsg.includes('did not generate the expected output')) {
    return 'The image engine declined this prompt without producing an image — usually the safety checker (suggestive wording, or edits like that to photos of real people), sometimes an instruction it cannot apply to this frame. Reword the swap instruction and generate again. Credits for this attempt were not kept.';
  }
  return `Image engine error (${status}): ${detailMsg.substring(0, 160) || 'no details returned'}`;
}
