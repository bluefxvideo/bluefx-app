import net from 'node:net';
import { isLive, ML_GROUP_SERVICE_JOINED } from '@/lib/free-video/config';
import { getLeadByToken, recordEvent, transitionUnlock } from '@/lib/free-video/leads';
import { trackPurchase } from '@/lib/free-video/meta';
import { handOverMemberClean, mailAllowed } from '@/lib/free-video/notify';
import { SERVICE, servicePagePath } from '@/lib/free-video/offer';
import { readUnlockOrder, startCleanRender } from '@/lib/free-video/unlock';
import type { FreeVideoLead } from '@/types/free-video';
import { subscribeToMailerLite } from '@/lib/mailerlite/subscribe';

/**
 * A paid Unlimited Video Ads order (any FastSpring path containing SERVICE.productMarker: the $99, $299 or $599 phase of
 * the service funnel's offer, funnel.ts), after the
 * FastSpring webhook has logged it (its done-for-you branch: no app user, plan or credit change). With the lead's view
 * token in the order's tag freeVideoLead:
 * - Facebook gets a Purchase with the lead's saved click ids, so the service funnel's campaign can optimize on it;
 * - the buyer joins 'Unlimited Video Ads - Joined', the exit of the service's follow-up emails;
 * - a 'service_paid' event on the lead (the owner's record of whose free video ad the order belongs to);
 * - the clean version of the lead's free video ad (no SAMPLE stamp) starts rendering, the same render as the $99 unlock;
 *   when it is ready the owner is alerted to check it and send it (notify.ts handOverServiceClean), never emailed.
 * Only order.completed, once per order (the caller passes only a newly logged event). A FastSpring test order on the live
 * server does nothing here. Never throws: the order itself is already logged.
 */
export async function handleServiceOrder(eventType: string, data: unknown): Promise<void> {
  if (eventType !== 'order.completed') return;
  try {
    const order = readUnlockOrder(data);
    const product = order.products.find((path) => path.toLowerCase().includes(SERVICE.productMarker));
    if (!product) return;
    const phasePrice = SERVICE.phases.find((phase) => phase.product?.toLowerCase() === product.toLowerCase())?.price ?? 99;
    if (order.live === false && isLive()) {
      console.log(`⚠️ [free-video] Service order ${order.id} is a FastSpring test order: no Purchase, no group`);
      return;
    }
    const lead = order.token ? await getLeadByToken(order.token) : null;
    const email = order.email ?? lead?.email ?? null;

    if (email && ML_GROUP_SERVICE_JOINED && mailAllowed(email)) {
      const joined = await subscribeToMailerLite({ email, groups: [ML_GROUP_SERVICE_JOINED] });
      if (!joined.ok) console.error(`❌ [free-video] Service buyer of order ${order.id} not added to 'Unlimited Video Ads - Joined'`);
    }
    if (!lead || !order.id) {
      console.log(`⚠️ [free-video] Service order ${order.id ?? '?'} has no free video ad tag: no Purchase sent to Facebook`);
      return;
    }

    const raw = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
    const ip = typeof raw.ipAddress === 'string' && net.isIP(raw.ipAddress.trim()) ? raw.ipAddress.trim() : null;
    await recordEvent({ event: 'service_paid', leadId: lead.id, placement: SERVICE.placement, ref: lead.ref, meta: { order: order.id, amount: order.amount } });
    await trackPurchase(
      lead,
      { id: order.id, amount: order.amount, currency: order.currency, email: order.email, ip },
      { product, placement: SERVICE.placement, value: phasePrice, sourcePath: servicePagePath(lead.view_token) }
    );
    await startMemberClean(lead, order.id, order.amount, order.currency);
    console.log(`✅ [free-video] Service order ${order.id} for ${lead.website_domain}: Purchase sent, buyer joined the Joined group, clean video ad started`);
  } catch (error) {
    console.error('❌ [free-video] Service order follow-up failed:', error);
  }
}

/**
 * The member's free video ad without the SAMPLE stamp (owner 2026-10-25: their first video ad, sent the same day): the
 * lead's unlock becomes 'paid' with this order (unique, so a repeated webhook changes nothing) and the clean render
 * starts at once when the video ad is done (otherwise the runner starts it when the video ad finishes). A clean
 * version that already exists (an earlier $99 unlock) is simply handed to the team again.
 */
async function startMemberClean(lead: FreeVideoLead, orderId: string, amount: number | null, currency: string | null): Promise<void> {
  if (lead.unlock_status === 'none' || lead.unlock_status === 'refunded') {
    const again = lead.unlock_status === 'refunded';
    const paid = await transitionUnlock(
      lead.id,
      { from: [lead.unlock_status], strict: true },
      {
        unlock_status: 'paid',
        unlock_order_id: orderId,
        unlock_amount: amount,
        unlock_currency: currency,
        unlocked_at: new Date().toISOString(),
        ...(again ? { clean_attempts: 0, clean_claimed_at: null, clean_ready_at: null, clean_video_url: null, unlock_emailed_at: null } : {}),
      }
    ).catch((error: unknown) => {
      // 23505: this order is already on the lead (the same webhook twice).
      if ((error as { code?: string }).code !== '23505') console.error(`❌ [free-video] Member clean of lead ${lead.id} not started:`, error);
      return null;
    });
    if (paid?.status === 'done') startCleanRender(paid.id, true);
    return;
  }
  // A clean version from an earlier $99 unlock: the team gets it right away.
  if (lead.unlock_status === 'ready' && lead.clean_video_url) await handOverMemberClean(lead);
}
