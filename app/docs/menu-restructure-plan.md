# Dashboard menu restructure plan

> From the "Top money opportunity" sketch (2026-06-08). Goal: simplify a confusing menu, add missing basic tools, and tuck experimental/secondary tools into a collapsible category. Single source of nav config: `app/src/components/user/dashboard-sidebar.tsx` (`toolCategories`).

## Target structure (final)

| # | Category | Tools (in order) | Notes |
|---|---|---|---|
| 1 | **Video Tools** | Video Maker · Clone Video Ad · Video Ad From Script · AI Avatar | renames + the two we already split |
| 2 | **Research** | Find Video Ads · Analyze Video | slimmed; rest move to Experimental |
| 3 | **Image Tools** | Image Maker 🆕 · Image Editor 🆕 · Thumbnail Maker | Logo moved to Experimental |
| 4 | **Audio Tools** | Music · Voice | renames only; Music internals unchanged (Lyra 3 model swap is a later, separate task) |
| 5 | **Writing Tools** | Script Generator · My Scripts · Ebook Writer · Prompt Library | future: rework into a Claude/GPT-style chat (later) |
| 6 | **Reel Estate** | ReelEstate | moved DOWN (important, but not first) |
| 7 | **Experimental Tools** ⌄ | Script to Video · Video Swap · YouTube Repurpose · Content Multiplier · Logo Maker · Trending Keywords · Viral Trends · Top Offers · Top Affiliate Products · Train My Business | **collapsible, collapsed by default** |

### Locked decisions (2026-06-08)
- **Renames = label only** (keep existing routes; zero breakage).
- **Image Maker = built** with Nano Banana 2; supports text-to-image **and** editing (up to 14 reference images → Nano Banana 2 `/edit` endpoint) + a History tab. Model name not shown in UI.
- **Image Editor = dropped** — folded into Image Maker (the reference-image upload already does edit/restyle/combine via the `/edit` endpoint). No separate tool.
- **Logo Maker → moved into Experimental Tools** (kept, not removed).

## Old → new mapping

**Renames (label only — keep existing routes):**
- AI Cinematographer → **Video Maker** (`/dashboard/ai-cinematographer`)
- Talking Avatar → **AI Avatar** (`/dashboard/talking-avatar`)
- Winning Ads → **Find Video Ads** (`/dashboard/winning-ads`)
- Video Analyzer → **Analyze Video** (`/dashboard/video-analyzer`) — and **move** to Research
- Thumbnail Machine → **Thumbnail Maker** (`/dashboard/thumbnail-machine`)
- Music Maker → **Music** (`/dashboard/music-maker`)
- Voice Over → **Voice** (`/dashboard/voice-over`)

**Moves into Experimental (existing tools, routes unchanged):**
- Script to Video, Video Swap (from Video) · YouTube Repurpose, Content Multiplier (from Writing) · **Logo Maker** (`/dashboard/logo-generator`, from Image) · Trending Keywords, Viral Trends, Top Offers, Top Affiliate Products (from Research) · Train My Business (from "My Business" — that category is dissolved)

**New tools (need building):** Image Maker, Image Editor (simple).

## Work breakdown

### Phase 1 — Sidebar reorg + renames (config only, ~1–2h, low risk)
Edit the `toolCategories` array in `dashboard-sidebar.tsx`: rename labels, reorder categories (Reel Estate down, Experimental last), move tools between categories, delete the Logo entry, dissolve "My Business", slim "Research", add the "Experimental Tools" category. Pick lucide icons for Image Maker / Image Editor. **This alone delivers ~80% of the visible restructure.**

### Phase 2 — Collapsible "Experimental Tools" dropdown (sidebar render, ~2–3h)
The sidebar currently renders every category as a static header + list ([dashboard-sidebar.tsx:465](app/src/components/user/dashboard-sidebar.tsx)). Add:
- optional `collapsible?: boolean` + `defaultCollapsed?: boolean` on a category,
- collapse state (`useState`, persisted to `localStorage`),
- a chevron/twirl toggle on the category header; hide its tools when collapsed.
Default **Experimental → collapsed**. (Generic enough to reuse for other categories later.)

### Phase 3 — New tools (real feature builds)
- **Image Maker** (~1–2 days): new route `/dashboard/image-maker` + component. **Reuse existing backend** — the FAL Nano Banana image generation already powering `executeStartingShot` (`app/src/actions/tools/ai-cinematographer.ts`) and the thumbnail/image models. Inputs: prompt, aspect ratio, model (fast/pro), optional reference images; output saved to the user's library; credits like Starting Shot.
- **Image Editor — simple** (~2 days): new route `/dashboard/image-editor` + component built on the existing FAL editing backend at `app/src/app/api/editor/edit-image/route.ts`. Scope: upload/pick an image + a text instruction → edited image (e.g. add/remove/replace elements, restyle), saved to library, credited per edit. No layers/full canvas for v1.

### Future (noted, not now)
- **Writing Tools → Claude/GPT-style chat** interface — a larger redesign; revisit after the reorg.
- **Music → Lyra 3** — a model swap inside `music-machine.ts`, independent of the menu. Leave the Music tool's internals as-is for now; do this later.

## Verification
- Run the app, log in, confirm the sidebar matches the target table: order, renames, Experimental collapsed by default and expandable, active-highlighting still works (uses `usePathname`), no dead links.
- New tools: generate an image via Image Maker → lands in library + deducts credits; (if built) edit an image via Image Editor.
