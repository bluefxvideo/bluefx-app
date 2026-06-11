# Expert UX/UI design review — 2026-06

Six-lens design crit (first-run, ergonomics, copy, mobile, accessibility, IA/flows) of the dashboard app, from the perspective of the actual customer: a busy, non-technical marketer paying $37/mo. ~50 findings, synthesized and prioritized below. Companion to `usability-audit-2026-06.md` (which covered bugs/stability — all fixed).

---

## The 6 themes that matter most

### 1. 📱 Mobile is effectively broken (highest structural gap)
The 38/62 horizontal `ResizablePanelGroup` used by ~15 tool pages doesn't adapt — on a 390px phone the input panel is ~150px wide and the drag handle is 1px. Grids (`grid-cols-3`) don't collapse, icon-only collapsed sidebar relies on hover tooltips (don't exist on touch), dialogs can overflow the viewport with keyboard open, no safe-area insets.
**Core fix:** stack the two panels vertically below `md` (input above output), collapse all grids to `grid-cols-1 sm:grid-cols-2 md:grid-cols-3`, ≥44px touch targets, responsive Buy-Credits dialog. Even if creation stays desktop-first, *reviewing results and topping up credits* must work on a phone.

### 2. 🧭 No path to first success (highest churn lever)
A new trial user sees a welcome header, credit stats, a showcase of videos *other people* made, and a 24-item sidebar — and nothing that says "do this first."
- Trial banner CTA is "View subscription" (a dead end) instead of "Start creating"
- Empty states are passive ("Your generated images will appear here") — no example prompts, no "Try this" button
- Tutorials exist but hide behind a small header button
- No prefilled example prompts anywhere; blank textarea = blank mind
**Core fixes:** a "Create your first video in 3 minutes" card at the top of the dashboard (dismiss after first generation); reframe the trial banner around possibility ("100 credits ≈ 3–5 videos") with a Start Creating CTA; smart empty states with one-click "Try this prompt"; surface tutorials in the empty state and as a first-visit nudge.

### 3. ⏳ Long generations are a black box
2–5 minute video/music jobs show a bare spinner. No stages, no ETA, no "safe to navigate away" reassurance (the new global notifier makes leaving safe — but nothing *tells* users that).
**Core fix:** staged progress ("Analyzing script ✓ → Generating visuals … → Encoding") + rough ETA + a line: "Feel free to keep working — we'll notify you when it's ready." Also: a "Regenerate with changes" affordance so users can tweak-and-rerun without redoing the whole wizard (worst in Script-to-Video's 5-step flow).

### 4. ✍️ Copy speaks engineer, not marketer (cheapest big win)
Worst offenders, with rewrites:
| Where | Now | Better |
|---|---|---|
| Video Maker | `Seed (Optional)` | "Consistency (optional) — enter a number to get the same result every time" |
| Video Maker | `Fast` / `Pro` | Outcome names: "Quick 4K — great for TikTok/Reels" / "Premium — best for hero content" |
| Resolution pills | `1K / 2K / 4K` bare | Add helper: "1080p is plenty for social — use 4K only for big screens" |
| Duration pills | `6s / 2 cr` | `6s (2 credits)` — nobody knows "cr" |
| First-frame upload | "Leave empty for text-to-video mode" | "Optional — upload an image to start from a specific look, or skip it" |
| Everywhere | Generate vs Create vs Make | Standardize on **Create** |
| Headings | "Ready to Create Magic ✨" | Sentence case, emoji out of headings (keep for success toasts) |
| Errors | terse/dev-flavored | Add the next step: "…Try a longer sample." |

### 5. ♿ Accessibility debt that affects everyone
- `text-zinc-500` secondary text fails WCAG AA on the dark background (hundreds of uses) → bump zinc-500→zinc-400, zinc-400→zinc-300 for help text
- Icon-only buttons (delete/copy/play/close) widely missing `aria-label`
- Selection state is color-only (pills/tabs) → add check icon / border for color-blind users
- Collapsible sidebar categories lack `aria-expanded`; weak focus rings (`ring-white/50`); placeholder-as-label antipattern; no skip-to-content link

### 6. 🔗 Tools don't flow into each other
- **No unified "My Library"** — creations are scattered across per-tool History tabs (the single biggest IA gap; needs a `/dashboard/library` aggregating all content types)
- Script Generator → Script-to-Video handoff exists (localStorage bridge) but is invisible — make "Turn into Video" a primary CTA on script output
- Analyze Video gives a breakdown then dead-ends — add "Next steps: Clone this ad / Recreate with AI"
- The editor.bluefx.net jump is unexplained — users suddenly lose the app chrome; add a departure note or embed with a "← Back" banner
- Sidebar credit badge is view-only → make it open BuyCreditsDialog (1 click from anywhere)
- No favorites/recents in the 24-item sidebar

---

## Prioritized backlog

### Quick wins (a day-ish of work, high yield)
1. Copy pass: the table above (seed, Fast/Pro, cr, resolution helpers, verb standardization, emoji/case cleanup, error rewrites)
2. Trial banner → "Start creating" CTA + possibility framing
3. Sidebar credit badge → opens BuyCreditsDialog
4. Contrast bump (zinc-500→400, 400→300 on help text) + focus-ring strengthening
5. aria-labels on icon-only buttons + `aria-expanded` on sidebar categories + check icon on selected pills
6. Empty states: add a "Try this prompt" button (3 curated prompts per flagship tool)
7. Grid responsiveness: add `grid-cols-1 sm:` prefixes to the fixed grids
8. "We'll notify you when it's ready" line under generation spinners (the notifier already exists!)
9. Ref-image cap feedback (12/14 counter) + "3–5 images work best" tip

### Moderate (each a focused session)
10. Mobile layout: vertical stacking below `md` for StandardToolLayout + dialog max-h + touch targets + collapsed-sidebar labels
11. Dashboard "Get started in 3 minutes" card + tutorial surfacing (first-visit nudge)
12. Staged progress + ETA for long generations
13. Script→Video + Analyze→Clone handoff CTAs
14. Wizard save/resume + "Regenerate with changes" (Script-to-Video)
15. External-editor departure context (modal or embedded banner)
16. Model selector comparison card (Quick vs Premium with cost examples)

### Projects (design + backend)
17. **My Library** — unified cross-tool content hub (+ favorites/pinning)
18. Onboarding checklist / first-week milestones with progress
19. Sidebar favorites/recents personalization

---

*Sources: 6 parallel expert reviews; per-finding file:line citations are in the workflow output. Note: some credit-CTA findings were already partially addressed by the InsufficientCreditsNotice shipped 2026-06-10 — the remaining gap is the clickable sidebar badge + low-credit nudge.*
