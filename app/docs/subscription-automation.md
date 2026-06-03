# Subscription & Credit Automation

How new customers, trial→paid conversions, and monthly credit renewals are kept
correct. Two layers working together:

1. **Webhooks (real-time / push)** — FastSpring & ClickBank POST lifecycle events
   to `/api/webhooks/*`. Instant reactions: signup creates the account, a charge
   flips trial→active and grants 600.
2. **Reconcile cron (daily / pull)** — `/api/cron/subscription-reconcile` calls the
   FastSpring API for every subscription and heals any drift. This is the safety net
   that makes the system robust to missed or mis-configured webhook events.

## Credit policy (decided 2026-06-03)

| Subscription status | Monthly credits |
|---|---|
| `active` (paying) | 600 / month, renewed each 30-day period |
| `trial` | initial 100 at signup, **not** auto-renewed |
| `cancelled` / none | no new grants (existing + purchased bonus credits still spendable) |

Enforced centrally in `src/lib/credits/subscription-entitlement.ts`
(`ensureCreditsForUsage`), called by every tool's `deductCredits`. A user who looks
like `trial` but has actually converted is healed just-in-time via a live FastSpring
check, so paying users are never wrongly blocked.

## 1. Schedule the cron on Coolify

Vercel cron (`vercel.json`) does **not** run under Coolify hosting. Add a Coolify
**Scheduled Task** on the main app service:

- **Command:**
  ```
  curl -fsS -H "Authorization: Bearer $CRON_SECRET_TOKEN" https://<your-domain>/api/cron/subscription-reconcile
  ```
- **Frequency:** `0 2 * * *` (daily, 02:00 UTC)

Also schedule the existing credit top-up safety job the same way (optional — the
reconcile cron already renews active subscribers):
```
curl -fsS -H "Authorization: Bearer $CRON_SECRET_TOKEN" https://<your-domain>/api/cron/credit-renewal
```

`CRON_SECRET_TOKEN` and `FASTSPRING_USERNAME` / `FASTSPRING_API_KEY` must be present
in the app's environment (they already are).

### First run: dry-run it

Before the first live run, confirm what it will change (no writes):
```
curl -H "Authorization: Bearer $CRON_SECRET_TOKEN" "https://<your-domain>/api/cron/subscription-reconcile?dryRun=1"
```
Review the `outcomes` tally, then run without `?dryRun=1`.

## 2. Enable the FastSpring webhook events

Only `subscription.activated` was being delivered (1 of 329 charge events ever
received), which is why conversions never updated. In the FastSpring dashboard →
**Developer Tools → Webhooks**, ensure these events are enabled for the endpoint
`https://<your-domain>/api/webhooks/fastspring`:

- `subscription.activated`
- `subscription.charge.completed`  ← the trial→paid conversion + monthly rebill (was missing)
- `subscription.updated`
- `subscription.canceled`
- `subscription.deactivated`
- `order.completed`

(Signature verification uses `FASTSPRING_WEBHOOK_SECRET`.)

## Open follow-ups

- **ClickBank reconciliation.** ~30 subscriptions have no FastSpring id (ClickBank /
  manual) and can't be checked via the FastSpring API. Until a ClickBank reconciler
  exists, `ensureCreditsForUsage` *grants* credits to those `trial` users rather than
  risk blocking a real payer (see the TODO in `subscription-entitlement.ts`).
- **Backfill.** `scripts/reconcile-subscriptions.mjs` is the one-off backfill tool
  (dry-run by default, `--apply` to write); the cron is its productionized form.
