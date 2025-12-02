// Affiliate Toolkit Service - Client-side wrapper for server actions
import { AffiliateOffer, ScriptType } from './types';
import {
  generateAffiliateScript,
  refineAffiliateScript,
  fetchAffiliateOffers
} from '@/actions/tools/affiliate-script-generator';

// Fetch all affiliate offers from Supabase
export async function fetchOffers(): Promise<AffiliateOffer[]> {
  const result = await fetchAffiliateOffers();

  if (!result.success || !result.offers) {
    throw new Error(result.error || 'Failed to fetch offers');
  }

  return result.offers;
}

// Generate script using the server action
export async function generateScript(
  offer: AffiliateOffer,
  scriptType: ScriptType,
  customPrompt?: string
): Promise<string> {
  const result = await generateAffiliateScript({
    offer,
    scriptType,
    customPrompt
  });

  if (!result.success || !result.script) {
    throw new Error(result.error || 'Failed to generate script');
  }

  return result.script;
}

// Refine existing script with follow-up instructions
export async function refineScript(
  currentScript: string,
  refinementInstructions: string
): Promise<string> {
  const result = await refineAffiliateScript({
    currentScript,
    refinementInstructions
  });

  if (!result.success || !result.script) {
    throw new Error(result.error || 'Failed to refine script');
  }

  return result.script;
}
