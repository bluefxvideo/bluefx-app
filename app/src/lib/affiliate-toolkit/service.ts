// Affiliate Toolkit Service - Client-side wrapper for server actions
import { AffiliateOffer, LibraryProduct, UserBusinessOffer, ScriptType } from './types';
import type { HumanizeScriptResponse } from '@/actions/tools/affiliate-script-generator';
import {
  generateAffiliateScript,
  refineAffiliateScript,
  humanizeAffiliateScript,
  fetchAffiliateOffers,
  fetchAllOffersForContentGenerator as fetchAllOffersAction
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

// Fetch all offers from both library and user's business offers
export async function fetchAllOffersForContentGenerator(): Promise<{
  libraryProducts: LibraryProduct[];
  userOffers: UserBusinessOffer[];
}> {
  const result = await fetchAllOffersAction();

  if (!result.success) {
    throw new Error(result.error || 'Failed to fetch offers');
  }

  return {
    libraryProducts: result.libraryProducts || [],
    userOffers: result.userOffers || []
  };
}

// Rewrite a script so it sounds like the user, not a chatbot
export async function humanizeScript(
  currentScript: string,
  scriptType?: ScriptType,
  offerId?: string | null
): Promise<Required<Pick<HumanizeScriptResponse, 'script' | 'tellsBefore' | 'tellsAfter'>>> {
  const result = await humanizeAffiliateScript({ currentScript, scriptType, offerId });
  if (!result.success || !result.script) {
    throw new Error(result.error || 'Failed to humanize script');
  }
  return { script: result.script, tellsBefore: result.tellsBefore ?? 0, tellsAfter: result.tellsAfter ?? 0 };
}
