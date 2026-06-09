# App-wide usability & stability audit — 2026-06

Six parallel audit passes (feedback/silent failures, cross-tool consistency, dead paths, async-generation UX, credits UX, code stability). ~45 findings. Prioritized below. Verified items are marked ✓.

---

## P0 — Critical (users actively hurt today)

1. **✓ ALL toasts in the app are silent.** 41 files call `toast.success/error/...` from sonner, but `<Toaster />` is rendered **nowhere** (not in root or dashboard layout). Every error, success, and insufficient-credit message across Talking Avatar, Music, Video Swap, Cinematographer, Content Multiplier, uploads, OAuth, etc. is invisible. Same bug class as the script-to-video ToastContainer we fixed — but global. **Fix: render `<Toaster />` once in `src/app/layout.tsx`.** This single line likely resolves the majority of "nothing happens" complaints.
2. **✓ Broken-syntax files ship to prod** via `ignoreBuildErrors: true`: `script-to-video/panels/script-input-panel.tsx:213` + several `content-multiplier` files have unterminated strings (TS1002). These components are *actually broken at runtime*. Fix the strings; longer-term flip `ignoreBuildErrors` off.
3. **No error boundaries anywhere** (`error.tsx` / `global-error.tsx` missing). Any render error blanks the whole dashboard with no message. Add dashboard + global error boundaries with a retry button.
4. **Failures eat credits with no refund.** Voice-over webhook has a literal `TODO: Handle credit refunds` (`api/webhooks/voice-over-ai/route.ts:154`); async video tools (cinematographer, talking-avatar, script-to-video) deduct upfront and never refund on failed jobs. Video Analyzer (deduct-after-success) is the correct pattern.
5. **Stuck-forever spinners.** Cinematographer and Music have no generation timeout — if a webhook is missed, `isGenerating` never clears (music's polling fallback is localhost-only). Add max-wait timeouts + DB-polling fallback in prod.
6. **Script-to-Video redirects to the editor even when generation partially failed** and after a `setTimeout` race; `onSuccess` checks a `currentUserId` variable that's out of scope (always undefined), so the guarded branch never runs.

## P1 — High (confusing / error-prone)

7. **Insufficient-credit feedback is invisible or absent** (depends on toasts; some tools have none at all). Show inline error + a "Buy Credits" button next to Generate.
8. **Sidebar credit count is stale** — 30s polling instead of the realtime subscription that already exists in `useCredits`. Spend credits → sidebar lies for 30s.
9. **No completion notification if user navigates away** during an async generation (no global banner/notification center; toasts are page-local and currently silent anyway).
10. **Trial users get zero trial messaging on the dashboard** — only `/dashboard/subscription` shows "100 credits" copy. New trial users see a bare number with no upgrade CTA.
11. **Credit costs shown inconsistently before generating** — Image Maker/Music/Thumbnail show "· N credits" on the button; Voice, Talking Avatar steps, Script-to-Video don't (or differ in format).
12. **Naming mismatches after the sidebar renames** (labels were renamed, page headers weren't): sidebar "Video Maker" → page "AI Cinematographer"; "Thumbnail Maker" → "Thumbnail Machine"; "Voice" → "Voice Over Studio"; "Music" → "Music Maker"; "AI Avatar" → "Talking Avatar"; "Find Video Ads" → "Winning Ads"; "Analyze Video" → "Video Analyzer". Update `StandardToolPage` titles to match the sidebar.
13. **Ebook Writer hardcodes `error={undefined}`** to all tabs (`ebook-writer-page.tsx:99-137`) — errors can never display.
14. **Cryptic timeout messages with no recovery path** (Talking Avatar 10-min timeout, image 60s timeout): don't say whether credits were taken or whether the result may still appear in History.
15. **`require()` at runtime inside script-to-video hooks** (`use-script-to-video.tsx:41,114,240`) + missing `typeof window` guard on a localStorage read — flaky persistence/redirects. Replace with top-level imports + guards.
16. **localStorage holds full generation results** (can exceed quota silently) — persist only ids; rely on store/DB.

## P2 — Medium (friction & debris)

17. Dead/duplicate routes: `/dashboard/logo-machine` (duplicate of logo-generator), root `/subscription` vs `/dashboard/subscription`, `/dashboard/business-tools` (no page.tsx → 404), legacy thumbnail sub-routes (`/pro`, `/face-swap`, `/recreate`) silently fall through, `video-analyzer` opens old `/dashboard/ai-recreate` URL.
18. Debris shipping to prod: 5 unused debug/test components in script-to-video (~23KB), `caption-overlay.tsx.bak`, `src/examples/` (3 files incl. old openai example), dead `SendToAIPanel`.
19. Subscription FAQ mentions a **pause feature that doesn't exist**.
20. Cinematographer batch storyboard failures: summary only, no per-batch retry.
21. Client/server credit estimates use different formulas (script-to-video).
22. No central "tool costs" reference page.

---

## Suggested fix batches

- **Batch 1 — "make feedback real" (small, huge impact):** mount `<Toaster />` globally; fix the 5 broken-syntax files; add `error.tsx`/`global-error.tsx`; fix ebook `error={undefined}`; wire Image Maker upload errors. (~1 session)
- **Batch 2 — "don't eat money/time":** voice-over refund + async-tool refund-on-failure (or deduct-on-success); generation timeouts + prod polling fallback for cinematographer/music; script-to-video redirect guard + scope bug.
- **Batch 3 — "consistency":** page titles ↔ sidebar names; credit-cost on every Generate button; insufficient-credits inline + Buy Credits CTA; live sidebar credits; trial banner on dashboard.
- **Batch 4 — "cleanup":** dead routes/redirects, debug components, .bak, examples/, pause-FAQ copy, require()→imports, localStorage slimming.
