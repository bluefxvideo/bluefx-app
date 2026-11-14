# ClickBank affiliate funnel (spec, 2026-11-14)

Owner request (2026-11-13/14): a SEPARATE funnel for ClickBank affiliates. Free video ad opt-in on its own link →
$49 clean video ad sold through ClickBank item 12 (vendor bluefx02) → after payment exactly today's $49 thank-you
experience (paid strip + clean video + AI Media Machine sales page) with the affiliate's hop kept on every AIMM button.
Own MailerLite groups/automations, a per-affiliate report and a per-affiliate block switch.

**The three existing funnels must behave byte-for-byte as today**: AI Media Machine funnel (/free-video-ad, refs like
`fb-…`, `bfxhome`, null), $49 FastSpring funnel (/free-ad, refs `svc-…`), home page leads. Every change below is an
added branch keyed on the new ref prefix. If you are unsure whether a change alters an existing funnel, do not make it;
write it in your report instead.

Copy rules for anything a visitor, buyer or ClickBank can see: plain simple English, no em dashes, never the word "gift".

## 0. Hard "do not touch" list

- ClickBank: nothing in the account (item 12's pitch URL `https://bluefx.net/ai-stock-image-bundle-2-no-prompts/` and
  thank-you URL `https://bluefx.net/ai-stock-image-bundle-2-no-prompts-ty/` stay; the approved PitchPlus flow 55851 and
  its pages/links stay; no new upsell flow).
- Zapier: no changes (both zaps post every bluefx02 sale to POST /api/webhooks/clickbank; zap B carries vendorVariables).
- Existing MailerLite automations and groups: no edits.
- `create_free_video_lead` / `claim_free_video_lead` SQL functions: no changes. Caps, queue and duplicate rules stay shared.
- Never add '12' to `targetProductIds` in the ClickBank route (that would create AIMM accounts for $49 buyers).
- Never write item-12 rows to `webhook_events` with event_type 'SALE' (attributeSales, the reconcile cron and the
  entitlement code read every clickbank SALE row as an AIMM purchase).
- Do not rename or remove any existing export, placement, constant, group id, event name or copy key. Only add.
- No `npm run build`, no dev server, no git commit, no database writes, no MailerLite/ClickBank/Zapier calls during the
  build. (The integrator runs typecheck/lint/build and tests afterwards.)

## 1. Funnel identity (ref prefix)

A lead (and every page event) belongs to the ClickBank funnel when its `ref` starts with `cbaff-`.

- Landing page: `/your-video-ad` (route `src/app/(funnel)/your-video-ad/page.tsx`, a re-export of the
  /free-video-ad page exactly like `src/app/(funnel)/free-ad/page.tsx`).
- ref on that page = `cbaff-<nickname lowercased>` where the nickname comes from `?affiliate=` and must match
  `^[a-z0-9_]{1,30}$` after lowercasing; otherwise `cbaff-no-affiliate`. `?ref=`/`?utm_campaign=` are ignored there.
- Owner's own browser on that page: `cbaff-owner-test` (route.ts rewrites with ownerTestRef; the funnel must survive).
- On every OTHER page, a hand-made `cbaff-…` tag loses the prefix (same idea as `svc-`), so no link can move a lead
  between funnels. Outputs of `funnelRef` for any input that does not start with `cbaff-` must stay identical.
- Hyphens never occur in ClickBank nicknames, so `no-affiliate` and `owner-test` can never collide with a real one.

### `src/lib/free-video/funnel.ts` additions (exact names)
```ts
export const CB_LANDING_PATH = '/your-video-ad';
export const CB_REF_PREFIX = 'cbaff-';
export const CB_NO_AFFILIATE = 'no-affiliate';
export const isClickBankRef = (ref: string | null | undefined): boolean;      // startsWith('cbaff-')
export const isClickBankLandingPath = (pathname: string): boolean;
export function cbAffiliateNick(raw: string | null | undefined): string | null; // lowercase + regex, else null
export function cbRefFor(affiliate: string | null | undefined): string;       // 'cbaff-<nick>' | 'cbaff-no-affiliate'
export function affiliateOfRef(ref: string | null | undefined): string | null; // nick, or null for no-affiliate/owner-test/non-cb
export type FunnelName = 'app' | 'service' | 'cb';
export function funnelOf(ref: string | null | undefined): FunnelName;         // cb before service before app
// changed (additive): ownerTestRef(ref) returns 'cbaff-owner-test' for cb refs; isOwnerTestRef also accepts it.
// changed: funnelRef(raw, pathname, affiliate?) — on the CB page returns cbRefFor(affiliate); elsewhere strips 'cbaff-' then behaves as today.
```

### Offer
`offerOf` returns `'video'` for cb refs too (`sw ? sw.offer : isClickBankRef(ref) || isServiceRef(ref) ? 'video' : 'machine'`).
No new offer value. So a cb lead inherits every $49 page behaviour (the /v/<token> → /v/<token>/unlock redirect, the
change tools, the free-change email wording). Funnel-specific overrides use `funnelOf(lead.ref) === 'cb'` at these
points only: checkout (§3), price + copy + hidden FastSpring offers (§4), MailerLite groups (§6), Facebook tracking (§2),
stats/admin (§7), offer switch (blocked for cb leads in both directions: a cb lead can't be switched, and nobody can be
switched into the cb funnel because there is no cb offer value).

### View
`FreeVideoView` (types/free-video.ts) gets two optional fields set by `toView`:
```ts
funnel?: 'app' | 'service' | 'cb';   // always set by toView from funnelOf(lead.ref)
affiliate?: string;                   // cb leads with a real nickname only
```

## 2. Intake, blocking, Facebook

- `free-video-landing.tsx`: `cbPage = isClickBankLandingPath(pathname)`. On the cb page: the ref comes from
  `refTagFromUrl()` which must pass `?affiliate=` to `funnelRef` (use-free-video-beacon.ts); the duplicate/one-per-business
  refusal behaves like /free-ad (no AI Media Machine box, sentence stripped); the browser pixel Lead is not fired.
- `meta-pixel.tsx`: do not load the BlueFX Meta pixel on the cb landing path.
- `meta.ts` `sendableLead`: false for cb refs (no server Lead / InitiateCheckout / Purchase for the cb funnel).
- `api/free-video/route.ts` `after()`:
  - queued cb lead: `trackLead` is a no-op via sendableLead; `saveHop` as today; `joinLeadsGroup` (notify routes cb leads to the CB group); `kickQueue`.
  - rejected cb lead: `joinNoVideoGroup` (notify routes cb leads to the CB group) EXCEPT blocked-affiliate leads (no MailerLite at all).
- Block switch: table `free_video_cb_affiliates` (§8). In `createLead`, AFTER the caps and duplicate checks and BEFORE the
  website pre-check: when `isClickBankRef(input.ref)` and `affiliateOfRef(input.ref)` is blocked → insert the lead with
  `status:'rejected'`, `reason: 'Affiliate blocked: <nick>'`, `is_customer:false`, no pre-check, and return
  `fail(503, 'closed', ERRORS.closed, stored.lead)` (the visitor sees "Today's free video ads are all taken. Please come
  back tomorrow."). The lead is kept so the report can count it.
- `src/lib/free-video/cb-affiliates.ts` (new, server-only):
```ts
export const CB_BLOCKED_REASON_PREFIX = 'Affiliate blocked: ';
export type CbAffiliateStatus = 'active' | 'blocked';
export interface CbAffiliateRow { nickname: string; status: CbAffiliateStatus; note: string | null; updated_by: string | null; created_at: string; updated_at: string }
export async function isAffiliateBlocked(nick: string | null): Promise<boolean>; // 20 s cache; DB error → false (never blocks by accident)
export async function cbAffiliateRows(): Promise<CbAffiliateRow[]>;             // throws on DB error
export async function setAffiliateStatus(nick: string, status: CbAffiliateStatus, opts: { note?: string | null; by?: string | null }): Promise<CbAffiliateRow>;
export async function rejectQueuedLeadsOf(nick: string): Promise<number>;       // cb leads of that nick still 'queued' → 'rejected' with the blocked reason (transitionLead guard from ['queued'])
```
- `free-video-status.tsx`: the unreadable state's "Try again" link goes to `/your-video-ad?affiliate=<nick>` for cb leads
  (`view.funnel === 'cb'`, `view.affiliate`), `/your-video-ad` when no nick. Other funnels unchanged.

## 3. Checkout: ClickBank item 12

`src/lib/free-video/offer.ts` additions:
```ts
export const CB_UNLOCK = {
  vendor: 'bluefx02',
  item: '12',
  price: '$49',
  priceUsd: 49,
  payUrl: 'https://bluefx02.pay.clickbank.net/?cbitems=12',
  tokenParam: 'fvt',          // seller variable: comes back in vendorVariables and on the thank-you page
  vtidPrefix: 'fvcb49',       // vtid = fvcb49_<lead id first 8 hex>; NOT in PLACEMENTS / leadPrefixOfVtid
  descriptor: 'CLKBANK*AIVideoAd',
  productName: 'AI Video Ad',
  thankYouUrl: 'https://bluefx.net/ai-stock-image-bundle-2-no-prompts-ty/',
} as const;
export function cbUnlockCheckoutUrl(token: string, leadId: string): string;
// → https://bluefx02.pay.clickbank.net/?cbitems=12&vtid=fvcb49_<lead8>&fvt=<token>   (no cbfid, no template)
```
`/go/fvunlock` (go/[placement]/route.ts): keep every existing guard (paid → unlock page, rejected/failed → video page,
closed → video page). Then, only for cb leads, redirect to
`withHop(cbUnlockCheckoutUrl(token, lead.id), hopFromSearchParams(query) ?? await savedHop(lead.id))` instead of the
FastSpring link. FastSpring leads keep the current line exactly.

## 4. The $49 page for cb leads (/v/<token>/unlock)

- Price: fixed `{ launch:false, price:'$49', regular:'$49', product:'clickbank-item-12', endsAt:null }` (no "$99", no
  strike-through, no timer, no "price ends" line). The FastSpring clock (`unlockPriceOf`) is not read for cb leads.
- No FastSpring popup: `storefront = null` for cb leads; `useFastSpringPopup` must return early when the storefront is
  null (FastSpring leads unchanged). The buy buttons open `/go/fvunlock?t=` in a new tab (ClickBank order form); the
  original tab sets clickedAt and polls (existing behaviour).
- Copy for cb leads: trust line "Secure checkout by ClickBank."; refund line "60-day money-back guarantee through
  ClickBank." (wherever the FastSpring/30-day wording shows); after-click note mentions ClickBank; phone bar texts adapted.
- The ClickBank retailer disclaimer (`<Legal/>`, result-page.tsx) at the bottom of the offer view for cb leads.
- Hide every FastSpring-sold offer for cb leads (Weekly Video Plan trial/plan on the ready state, any service link).
- Return from the thank-you page: `/v/<token>/unlock?paid=cb&r=<receipt>`.
  - While `unlock.state === 'available'` and `paid=cb`: show a "Payment received. We're confirming it with ClickBank…"
    state (no offer, no buy buttons, so nobody pays twice), POST once to `/api/free-video/<token>/cb-confirm`
    with `{ receipt: r }`, then poll every 4 s (existing POLL_MS) for up to 10 minutes; after that show "It's taking a
    little longer. We'll email you the moment your clean video ad is ready. Questions: support@bluefx.net".
  - As soon as the view flips to paid/rendering/ready, the normal Unlocking/Ready states render (paid strip + AimmUpsell).
  - For cb leads the paid strip also shows: "Your order is processed by ClickBank. It shows on your statement as
    CLKBANK*AIVideoAd." (plus the receipt if `r` is present).
- AimmUpsell / ResultSalesPage for cb leads: identical buttons and placements (fvres*, fvsplit, fvresbar); add an
  optional prop so the browser pixel InitiateCheckout is not fired for cb leads (OfferButton `pixel?: boolean`, default true).

## 5. Sale handling (server)

### Webhook branch (`src/app/api/webhooks/clickbank/route.ts`)
Insert right after the x-zapier-secret check and before anything else:
```ts
const videoAd = clickBankVideoAdIn(payload);       // 'only' | 'mixed' | null  (vendor bluefx02 AND item 12)
if (videoAd) {
  const result = await handleClickBankVideoAdPost(payload, request.headers.get('content-type'));
  if (videoAd === 'only') return NextResponse.json(result.body, { status: result.status });
}
```
Own try/catch inside the handler: 500 only on a database error, otherwise 200 (duplicate / pending / unmatched / ignored).
`'mixed'` (item 12 plus another item on one receipt) handles item 12 and then falls through so the AIMM code runs as today.

### `src/lib/free-video/clickbank-video-ad.ts` (new, server-only)
- Parsers (pure, exported for the checks): receipt normalisation `R = receipt.split('__')[0].trim().toUpperCase()`;
  transaction type from `transaction_type | transactionType`; item set from flat `itemNo` (split on commas),
  `lineItemData` (JSON string — also try `'`→`"` — array, object), and `vendorVariables` cbitems; vendor from
  `vendor | account` lowercased; email from `customer.email | customer_email | email | customerEmail`; affiliate;
  trackingId (`trackingId | tracking_id | vtid | tid`, ignore `@nil`); `fvt` and `vtid` from `vendorVariables`
  (a JSON string or object; `item` an array or a single object; tolerate garbage); zap = 'B' when `vendorVariables`
  or `lineItemData` is present, else 'A'.
- Lead match order: `fvt` → `getLeadByToken`; else vtid `fvcb49_<8hex>` (from trackingId or vendorVariables vtid) →
  the cb lead whose id starts with those 8 hex (uuid range query like sweep.ts does); only cb-funnel leads match.
  Zap A alone never matches by email at once (it would race zap B); the sweep does the email fallback later.
- Record every post: `webhook_events` row, processor 'clickbank', event_type 'CB_VIDEO_AD_SALE' | 'CB_VIDEO_AD_REFUND' |
  'CB_VIDEO_AD_TEST_IGNORED', event_id `cbva:<R>:<zap>:<kind>` (select-then-insert; tolerate 23505), payload =
  normalised fields (receipt R, raw receipt, item set, vendor, affiliate, trackingId, fvt, vtid, leadId|null, email,
  amount strings, country, transactionType, zap) + `raw` (the parsed post, cut to ~8 KB).
- SALE / TEST_SALE: TEST_SALE only unlocks owner-test leads (isOwnerTestRef(lead.ref), lead.source 'test', or the
  email in OWNER_TEST_EMAILS / STATS_EXCLUDED_EMAILS); otherwise recorded as CB_VIDEO_AD_TEST_IGNORED.
  Optional proof: when `CLICKBANK_CLERK_KEY` (or `APP_CLICKBANK_CLERK_KEY`) is set, confirm the receipt through
  `GET https://api.clickbank.com/rest/1.3/orders2/<R>` (headers `Authorization: <key>`, `Accept: application/json`,
  same as src/app/api/cron/subscription-reconcile/route.ts) and require item 12 in it; when the key is missing, accept
  (the AIMM path does the same) and log `unverified-no-key`. A clear "no such order" answer → do not unlock, alert.
- Unlock = the shared `applyUnlockPayment` (below) with `orderId 'cb:<R>'`, amount `CB_UNLOCK.priceUsd`, currency 'USD',
  `{ facebook:false, processor:'clickbank' }`, then `joinCbPaidGroup(lead)` (notify). Idempotency is the lead's
  `unlock_order_id` (unique index): a lead already carrying `cb:<R>` → duplicate (record only).
- Refund / chargeback types `RFND | REFUND | TEST_RFND | TEST_REFUND | CGBK | TEST_CGBK | INSF`: find the lead by
  `unlock_order_id = 'cb:<R>'`, move paid/rendering/ready/failed → refunded (guarded, as handleUnlockRefund does),
  record, alert the owner. Unmatched → record only. Never touch user_subscriptions / user_credits / profiles.
- `confirmClickBankReceipt(token: string, receipt: string): Promise<'paid' | 'pending' | 'invalid'>` for the cb-confirm
  route: needs the clerk key (else 'pending'); orders2 must show item 12 and either fvt === token or the order email ===
  the lead email; then apply exactly like the webhook (same idempotency).
- `retryPendingClickBankSales(): Promise<void>` for the sweep: CB_VIDEO_AD_SALE rows of the last 2 days whose receipt no
  lead carries yet → merge all posts of that receipt (fvt / vtid / email) and match again; after 3 minutes also allow
  the email fallback (exactly one cb lead with that email_key and unlock_status 'none' or 'refunded'); after 30 minutes
  still unmatched → one owner alert (free_video_alerts key `cb-unmatched-<R>`, via the existing alert helper).
- `cbPaidTokenOfReceipt(receipt: string, buyerEmail: string | null): Promise<string | null>` for the resolver route (token of
  the cb lead that carries `cb:<R>`, only while unlock_status is paid/rendering/ready, unlocked_at is at most 30 minutes old
  and emailKeyOf(buyerEmail) equals emailKeyOf(lead.email); review fix 2026-11-14: a receipt alone is not a key).

### `src/lib/free-video/unlock.ts`
Extract the steps after the order is read/confirmed into
```ts
export async function applyUnlockPayment(
  lead: FreeVideoLead,
  payment: { orderId: string; amount: number | null; currency: string | null; email: string | null; ip?: string | null },
  opts: { facebook: boolean; processor: 'fastspring' | 'clickbank' },
): Promise<UnlockOutcome>
```
(the guarded transition none/refunded → paid with the 23505 → duplicate rule, second-payment handling, Purchase only
when `opts.facebook`, vipPing, change plan, startCleanRender, the no-video alert; alert wording names the processor).
`handleFreeVideoUnlock` calls it with `{ facebook:true, processor:'fastspring' }` and stays identical in behaviour,
outcomes and alert keys. `recordUnlockEvent` gets an optional processor argument (default 'fastspring').

### Routes (new)
- `POST /api/free-video/[token]/cb-confirm` body `{ receipt }` → `{ success:true, data:{ status } }`; validates the token
  (`FREE_VIDEO_TOKEN_PATTERN`) and receipt (`^[A-Za-z0-9]{6,20}(__[A-Za-z0-9_]+)?$`); only for cb leads; never leaks order data.
- `POST /api/free-video/cb-paid` with the JSON body `{ r: <receipt>, e: <buyer email> }` (sent as text/plain, so no
  preflight) → `{ token: string | null }` with CORS `Access-Control-Allow-Origin: https://bluefx.net`, `Access-Control-Allow-
  Methods: POST, OPTIONS` (and OPTIONS), `Cache-Control: no-store`, a per-IP rate limit; used by the bluefx.net thank-you
  page when it has no token (review fix 2026-11-14; it was a GET by receipt alone).

### Sweep (`src/lib/free-video/sweep.ts`)
- Call `retryPendingClickBankSales()` in the live sweep (own try/catch, never blocks the other steps).
- `attributeSales`: unchanged matching; only the group join becomes funnel-aware: `addToBoughtGroup(email, lead.ref)`.
- Setup alert: also alert when the CB group constants are empty (like ML_GROUP_READY).

## 6. MailerLite (code side)

Groups (created 2026-11-14, ids final):
| Constant (config.ts) | Group | Id |
|---|---|---|
| `ML_GROUP_CB_LEADS` | CB Funnel - Leads | 204061356175918577 |
| `ML_GROUP_CB_READY` | CB Funnel - Ready | 204061357236029079 |
| `ML_GROUP_CB_PAID` | CB Funnel - Paid $49 | 204061358258390128 |
| `ML_GROUP_CB_UNLOCKED` | CB Funnel - Unlocked | 204061359500952970 |
| `ML_GROUP_CB_BOUGHT` | CB Funnel - Bought AIMM | 204061360723592767 |
| `ML_GROUP_CB_NO_VIDEO` | CB Funnel - No video | 204061361743857319 |

notify.ts, cb leads only (a new first branch; existing branches untouched):
- `joinLeadsGroup` → `[ML_GROUP_CB_LEADS]` (never Free Video - Leads).
- `joinNoVideoGroup` → `[ML_GROUP_CB_NO_VIDEO]` (never "No video (auto)", whose rescue email carries an affiliate=bluefx01
  link); nothing at all for blocked-affiliate leads (reason starts with CB_BLOCKED_REASON_PREFIX).
- `deliverLead` → `[ML_GROUP_CB_READY]` only (never Ready / $49 Ready / Bought); same fields as the $49 branch.
- `deliverUnlock` → `[ML_GROUP_CB_UNLOCKED]` only (never Unlocked / Bought).
- `export async function joinCbPaidGroup(lead: FreeVideoLead): Promise<void>` → `[ML_GROUP_CB_PAID]` at payment time.
- `export async function addToBoughtGroup(email: string, ref?: string | null)` → cb ref: `ML_GROUP_CB_BOUGHT`; else as today.
- `sendFreeChangeReady` and `sendCheckoutReminders`: make sure the wording/links are right for cb leads (no FastSpring
  wording; the reminder must not tell a cb buyer whose payment is still on its way that something failed: skip cb leads
  that have a CB_VIDEO_AD_SALE row or unlock_status other than none).
- vip.ts `funnelOf` label: "ClickBank funnel (<nick>)"; owner-test exclusion also for 'cbaff-owner-test' and 'svc-owner-test'.
- The automations themselves are created separately (inactive drafts, owner approves wording before anything is switched on).

## 7. Stats and admin

- funnel-stats.ts: add FunnelChoice `'cb'`; `'app'` excludes cb refs; `'all'` ("Both funnels") keeps meaning the two
  Facebook funnels (excludes cb); tagOf hides 'cbaff-no-affiliate' and 'cbaff-owner-test'; channelOfTag maps `cbaff-` to
  'clickbank'; the turned-away list follows the funnel choice for cb.
- Admin leads route: the day/week summary excludes cb leads (add a separate `cb` count field); `funnel: 'service'|'app'|'cb'`;
  POST offer switch → 409 "ClickBank funnel leads can't be switched" for cb leads.
- Leads panel: badge "ClickBank funnel" + "Affiliate <nick>"; no Switch button for cb leads; blocked leads show "Blocked".
- New tab in `src/app/dashboard/admin/page.tsx`: `value="cb-funnel"`, label "ClickBank funnel", mounting
  `src/components/admin/clickbank-funnel-panel.tsx`, backed by `src/app/api/admin/clickbank-funnel/route.ts`
  (GET report for from/to/tz; POST `{ nickname, status, note? }` → setAffiliateStatus, and on 'blocked' also
  rejectQueuedLeadsOf) and `src/lib/free-video/cb-funnel-stats.ts` (server-only, keyset paging like funnel-stats).
- Report row per affiliate (nickname, plus "No affiliate" bucket): status + toggle, leads (rows) and people (email keys),
  blocked leads, top 3 countries (countryOfIp), videos made, video cost (sum est_cost_usd), opened (first_viewed_at or an
  unlock_view event), played (video_play from non-owner browsers), $49 sales (cb leads with unlock_order_id 'cb:%' and
  unlock_status in paid/rendering/ready/failed) count + $, refunds (unlock_status refunded with a cb: order) count,
  AIMM sales (cb leads with bought_at) count + $ (amount from the webhook_events SALE row named by sale_ref),
  cost per lead, money in (gross) and money in after the 50% affiliate commission, last lead date. Totals row.
  Exclusions: source 'test', isOwnerTestRef, STATS_EXCLUDED_EMAILS (say so in the footer).

## 8. Database (additive; applied by hand in the Supabase SQL editor before the push)

`supabase/migrations/20261114000000_free_video_cb_affiliates.sql`:
```sql
create table if not exists public.free_video_cb_affiliates (
  nickname text primary key check (nickname ~ '^[a-z0-9_]{1,30}$'),
  status text not null default 'active' check (status in ('active','blocked')),
  note text check (note is null or char_length(note) <= 500),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.free_video_cb_affiliates enable row level security;
revoke all on public.free_video_cb_affiliates from anon, authenticated;
grant select, insert, update, delete on public.free_video_cb_affiliates to service_role;
```
No affiliate row = active.

## 9. bluefx.net thank-you page (static site, not in this repo)

`/Users/gyorfiszilard/Dropbox/Calude Folder/bluefx-waas/client-bluefx`: the item 12 thank-you URL stays the same; only
its content changes (standalone page, no trackers): ClickBank lines (payment accepted, processed by ClickBank,
CLKBANK*AIVideoAd on the statement, order number, support@bluefx.net, ClickBank order support link, retailer
disclaimer); identify the lead from `fvt` → `bfx_fv` cookie → `POST https://app.bluefx.net/api/free-video/cb-paid` with
`{ r: <receipt>, e: <cemail> }` (poll ~3 min; no cemail: the "later" text at once); forward (short visible delay + button) to `https://app.bluefx.net/v/<token>/unlock?paid=cb&r=<receipt>`;
fallback text when no lead is found; the old AI Stock Image Bundle #2 downloads kept folded at the bottom for earlier buyers.
Not deployed until the owner says so.

## 10. File ownership during the build (parallel builders)

| Builder | Owns (only these files) |
|---|---|
| 1 Funnel core | funnel.ts, offer-switch.ts, use-free-video-beacon.ts, free-video-landing.tsx, api/free-video/route.ts, leads.ts, types/free-video.ts, (funnel)/your-video-ad/page.tsx (new), meta.ts, meta-pixel.tsx, free-video-status.tsx, cb-affiliates.ts (new), the migration (new), src/scripts/cb-funnel-ref-checks.ts (new) |
| 2 Payments | api/webhooks/clickbank/route.ts, clickbank-video-ad.ts (new), unlock.ts, offer.ts, go/[placement]/route.ts, api/free-video/[token]/cb-confirm/route.ts (new), api/free-video/cb-paid/route.ts (new), sweep.ts, src/scripts/cb-funnel-sale-checks.ts (new) |
| 3 $49 page | (funnel)/v/[token]/unlock/page.tsx, unlock-page.tsx, unlock-page.ts (copy), unlock-price.ts, result-sales-page.tsx, offer-button.tsx |
| 4 Emails | config.ts, notify.ts, vip.ts |
| 5 Admin | dashboard/admin/page.tsx, components/admin/*, api/admin/* (existing + new), funnel-stats.ts, cb-funnel-stats.ts (new) |
| 6 Thank-you page | the bluefx.net folder only |

Cross-builder names are fixed by this spec; code against them even if the other builder's file is not written yet.
