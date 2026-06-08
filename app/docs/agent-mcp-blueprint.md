# Making AI Media Machine agent-native (a "Blotato for generation")

> Status: **exploratory blueprint** — not yet scheduled for implementation. Written 2026-06 after reviewing how Blotato is driven from Claude Cowork. Revisit when ready to build.

## Context

In the reference tutorial, Sabrina drives **Blotato** entirely from Claude Cowork: she adds Blotato as a **custom MCP connector** (a remote URL + an API key), and the agent then generates media, edits it, publishes to many social platforms, schedules posts, and manages a content calendar — all by calling Blotato's tools.

The goal: understand **what BlueFX would need so its clients could use AI Media Machine the same way** — connect it to Claude (Cowork/Code) or any MCP-capable agent and have the agent run the tools. This is a **gap analysis + roadmap**. Eventual target: a **self-serve feature available to all subscribers**.

Blotato needed three things we must map onto BlueFX:
1. A **remote MCP server** the agent connects to.
2. A **per-user API key** to authenticate the agent as that client.
3. A tool surface: **generate media, publish, schedule, manage calendar, read assets/accounts**.

---

## What BlueFX already has (the good news)

- **~14 generation tools** (cinematographer, script-to-video, talking avatar, video swap, thumbnail, logo, voice-over, music, ebook, content-multiplier, video-analyzer, clone-video-ad, youtube-repurpose). Entry actions in `app/src/actions/tools/*` + DB actions in `app/src/actions/database/*-database.ts`.
- **Most heavy generation actions already take an explicit `user_id`** and don't depend on the browser session — nearly ready to call server-to-server (logo, cinematographer, thumbnail, talking-avatar, video-swap).
- **Credit + subscription gating is already `user_id`-parameterized**: `deductCredits(user_id,…)`, `ensureCreditsForUsage(userId, amount)` in `app/src/lib/credits/subscription-entitlement.ts`.
- **A precedent for non-browser auth**: `app/src/app/api/script-video/store-export/route.ts` branches on `x-api-key` (`INTERNAL_API_KEY`) → uses the admin Supabase client with an explicit user. Exact pattern an MCP server would reuse.
- **Async job plumbing**: results from Replicate/Hedra/FAL land in per-tool tables + `ai_predictions` via webhooks (`app/src/app/api/webhooks/{replicate-ai,hedra-ai,fal-ai,voice-over-ai}`).
- **Social OAuth connections** for X, Facebook, LinkedIn, Instagram, TikTok → encrypted tokens in `social_platform_connections` (`app/src/app/api/auth/callback/[platform]/route.ts`).
- **Working posting actions** that call platform APIs: Facebook, LinkedIn, X/Twitter, YouTube, WordPress (`app/src/actions/tools/*-posting.ts`).
- **A scheduling scaffold**: `scheduled_posts` table + `createScheduledPosts/getScheduledPosts/reschedulePost/cancelScheduledPost` in `content-multiplier-v2-actions.ts`.
- **Cron + token pattern** already used (Coolify scheduled task + `CRON_SECRET_TOKEN`) — the model for any new background worker.

---

## What's missing (what we'd need to build)

### 1. The MCP server itself — *doesn't exist*
No MCP server or `@modelcontextprotocol` dependency anywhere. Core new piece.
- **Where**: new route group `app/src/app/api/mcp/` in the main app (reuses existing public URL, DB, provider keys, tool code — no new Docker service). Exposed at a stable URL clients paste into Claude, e.g. `https://app.bluefx.net/api/mcp` (or a `mcp.bluefx.net` subdomain).
- **Transport**: Streamable HTTP MCP (JSON-RPC) via `@modelcontextprotocol/sdk`, stateless JSON mode so each tool call is one request (no long-held connections — friendly to Coolify).
- **Tool surface**:
  - *Generation* — one tool per generator. Sync tools return the media URL inline; async tools return a `prediction_id`/`batch_id`.
  - *Job status* — `get_generation_status(id)` reads `ai_predictions` + the per-tool table (**async tools need a "start job → poll status" pattern**, since the agent has no browser realtime channel).
  - *Asset library* — `list_my_assets`, `get_asset_url` (per-tool history tables, filtered by user).
  - *Publishing* — `publish_now`, `schedule_post`, `list_scheduled`, `reschedule`, `cancel`, `list_connected_accounts`.
  - *Account* — `get_credit_balance`, `get_subscription_status`.

### 2. Per-user API keys — *doesn't exist*
There's an internal static key, but **no user-facing key system**. For self-serve we'd need:
- An `api_keys` table (store only a **hash** of the secret + display prefix, plus `scopes`, `last_used_at`, `revoked_at`). Mirror the existing `scheduled_posts` migration's RLS/service-role pattern.
- A **settings UI** to generate / copy-once / revoke keys, and show the connector URL + setup instructions.
- The MCP server authenticates each request: `Bearer <key>` → hash lookup → `user_id` → run everything via the admin client filtered by that `user_id` (same shape as the `store-export` internal-key branch).
- **Rate-limiting + per-key usage logging** (`api_key_usage` table) — important for a self-serve, all-subscribers rollout.

### 3. Decouple a handful of actions from the browser session
Most generators already take `user_id`. The cookie-bound ones must be split into a `…Core(userId, …)` function (callable by both the existing UI action and the MCP server): **voice-over, music, video-analyzer, the content-multiplier scheduling CRUD, and the 5 posting actions**. Low-risk refactor (extract core, keep the thin cookie wrapper).

### 4. Finish the publishing/scheduling layer — *scaffolded but NOT functional*
Biggest functional gap; exactly Blotato's core strength:
- **`triggerImmediatePost` is a TODO stub** — writes `scheduled_posts` rows but never actually posts. Wire it to a **platform dispatcher** that calls the real posting actions.
- **No background worker fires scheduled posts** — need a `cron/publish-due-posts` route (clone of `cron/credit-renewal`) that finds due posts, publishes, retries, updates status. Run via Coolify scheduled task.
- **No Instagram or TikTok posting** — only OAuth connect + content generation exist. The platforms Sabrina demos most. **⚠️ Longest-lead item**: both require the platforms' Content Publishing APIs and **formal app review** (Meta App Review; TikTok audit) — weeks of external lead time, gated by the platforms.
- **Optional "next free slot" scheduling** — a `posting_schedules` table (weekly slots) + slot finder, to match Blotato's most-used mode.

### 5. Credits / subscription gating for agent usage
Mostly inherited for free (actions already deduct credits). Add an explicit `ensureCreditsForUsage(userId, cost)` check at the MCP boundary so agent calls get the same "upgrade to continue" behavior; decide whether publishing costs credits.

### 6. (Optional, matches the Blotato UX) "Skills" pack + docs
Blotato pairs the connector with pre-built Claude **marketing skills**. BlueFX could publish a small skills pack + a setup/instructions page for a guided experience.

---

## Auth recommendation
**Start with API keys** (the Blotato model; reuses our existing internal-key pattern — lowest risk, fastest). The **OAuth one-click "Connect" connector** is nicer UX but a separate, larger auth-server build; add later as polish. So: **API key first → OAuth connector as a fast follow.**

---

## Phased roadmap & effort

| Phase | Scope | Rough effort |
|---|---|---|
| **0. Foundations** | `api_keys` table + generate/revoke actions + settings UI + add MCP SDK | ~2–3 days |
| **1. MCP MVP** | MCP endpoint + auth resolver + read tools (`get_credit_balance`, `list_connected_accounts`, `list_my_assets`) + already-decoupled generators + `get_generation_status`. Demoable Blotato-style loop. | ~3–5 days |
| **2. Remaining generators** | Decouple voice-over/music/video-analyzer/scheduling CRUD/posting; expose all generation tools | ~3–4 days |
| **3. Publishing completion** | Dispatcher, wire `triggerImmediatePost`, `publish-due-posts` cron, schedule/list/reschedule/cancel tools, retries (X/FB/LinkedIn/YouTube/WordPress) | ~3–5 days |
| **4. Hardening (needed for self-serve)** | Rate limits, usage logging + caps, scopes, error normalization, docs | ~2–3 days |
| **5. IG/TikTok + best-time** | IG/TikTok posting **behind platform approvals**; `next_free_slot` scheduling | Build ~3–5 days, **gated on weeks of platform-approval lead time** |

**Critical-path / longest-lead:** Instagram (Meta App Review) and TikTok (content-posting audit) approvals — submit in parallel with Phase 1 if full parity is wanted.

---

## Key files (reuse / precedent)
- `app/src/app/api/script-video/store-export/route.ts` — the `INTERNAL_API_KEY` → admin-client-with-explicit-user pattern to replicate for MCP auth.
- `app/src/actions/tools/content-multiplier-v2-actions.ts` — the `triggerImmediatePost` stub to wire + scheduling CRUD to decouple/expose.
- `app/src/lib/credits/subscription-entitlement.ts` — `ensureCreditsForUsage(userId, amount)` for the MCP gating boundary.
- `app/src/app/api/cron/credit-renewal/route.ts` — cron template (Bearer `CRON_SECRET_TOKEN` + admin client) to clone for `publish-due-posts`.
- `app/src/app/api/auth/callback/[platform]/route.ts` + `social_platform_connections` — existing social OAuth/token storage.
- `app/src/actions/tools/{facebook,linkedin,twitter,youtube,wordpress}-posting.ts` — working posters to wrap; **instagram/tiktok do not exist yet**.

## How we'd verify (when built)
- `curl POST /api/mcp` with a real Bearer key → `initialize`, `tools/list`, `tools/call` of `get_credit_balance` (read-only).
- Add the connector in Claude with a generated key; run the full loop: generate → poll status → publish → schedule → list calendar.
- Schedule a post 2 min out; confirm `publish-due-posts` posts it (start with X, which already works).
- Confirm credits deduct exactly once; a trial-exhausted user gets the upgrade message as an MCP error.

---

## Bottom line
The lift is **moderate, not huge** — the generation engine, credit gating, social OAuth, and async plumbing already exist and are mostly `user_id`-ready. Genuinely new work: **(1) the MCP server, (2) a user API-key system, (3) finishing the publishing/scheduler** (currently a stub). The only *long, externally-gated* piece is Instagram/TikTok publishing approval. A working "generate + publish to the platforms we already support, driven from Claude" MVP is reachable in roughly **2–3 weeks of focused work**; full Blotato parity adds the IG/TikTok approval timeline on top.
