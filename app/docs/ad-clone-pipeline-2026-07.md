# True Ad-Clone Pipeline — Spec & Verified Experiments (2026-07-03)

Positioning target: **"The AI That Clones Winning Video Ads"** — the whole
marketing plan (120+ creatives, "Can AI Clone This?" series) depends on the
product producing VISUAL clones, not text-inspired lookalikes.

## Why today's Clone Video Ad can't clone
Current flow: video → Gemini 2.5 Flash **prose** analysis → text→image →
image→video. All visual DNA (framing, lighting, motion, set) dies at the text
bottleneck. Output is "similar vibe", never a clone.

## Target pipeline (all stages demoed on a real ad: Pringles "Stuck In :30")
1. **Ingest** — yt-dlp/social URL (exists).
2. **Shot segmentation** — ffmpeg `select='gt(scene,0.2)'` → found all 15 shots
   with timestamps in seconds, free. (Needs ffmpeg in app container or run on
   remotion service.)
3. **Per-shot assets** — keyframe JPEG at shot midpoint + the shot's own clip.
   RULE: fal reference clips must be **2.0–15s** — pad short shots from
   neighbors (hit this: 1.79s shot rejected, video_duration_too_short).
4. **Structured analysis** — Gemini on keyframes + whisper transcript →
   per-shot JSON: framing, camera, action, on-screen text, role
   (hook/proof/CTA), swap targets. (Prompt/schema upgrade of video-analyzer.)
5. **Swap plan** — user's product/persona images mapped per shot (shot-board UI).
6. **Per-shot rebuild — TWO PATHS, verified on the same shot:**
   - **Path B (default, ~$0.15/scene)**: keyframe → nano-banana-pro /edit swaps
     product IN THE ACTUAL FRAME (~$0.05, near pixel-perfect: kept milkshake
     glass, watch, framing) → Seedance 1.5 i2v animates it (4s 720p audio-off
     = $0.105 verified; motion described from text analysis).
   - **Path A (hero-shot upgrade, ~$1.31/scene verified)**: Seedance 2.0
     reference-to-video with [Video1]=original shot clip + [Image1]=product →
     inherits exact source choreography/cinematography, but regenerates all
     pixels (details drift: lost milkshake, framing shifted).
   - Verdict: B wins static fidelity, A wins motion fidelity. B default,
     A as per-scene "exact motion" upsell.
7. **Assembly** — editor + VO (Seedance audio refs / TTS) + caption overlays
   (video models mangle text — always overlay type in-editor) + music tool.

## Verified cost per 30s clone (7-scene typical)
- All Path B: **~$1-2** · with 2 hero upgrades: **~$4-5** · all Path A: ~$9
- Retail 100-150 credits → healthy margin; cheap enough for guilt-free
  per-scene regeneration.

## Demo artifacts (Supabase videos/tests/)
- `pringles-scene4.mp4` — original shot (cut from the real ad)
- `test-8-pringles-scene-clone.mp4` — Path A motion-transfer clone ($1.31)
- `test-9-pringles-clone-cheap.mp4` — Path B keyframe clone ($0.105 + $0.05)
- `images/tests/pringles-scene4-swapped.png` — nano-banana frame swap
- Shot board montage generated locally (15 keyframes, ffmpeg).

## Known gaps / techniques still needed
- Persona consistency across shots: generate character once → pass as element
  refs (Seedance ≤9 imgs / Kling elements) in every shot. Orchestration, not
  new models. Kling O3 ref-to-video: verified cheaper ($1.34 for 15s 3-shot)
  + native multi_prompt, but strict input rules (frontal+reference pairs,
  ≥300px, 0.4-2.5 AR) and no audio refs.
- Aging/transformation arcs (Pringles-style): no model does this — skip.
- Pixel-surgical swaps: video-inpainting model class (Runway/Wan-Edit) —
  research later as a "perfection" tier; full-reshoot is legally safer anyway.
- Marketing synergy: every pipeline run on a famous ad = one "Can AI Clone
  This?" episode (shot board + side-by-side are the creative).

## Addendum (2026-07-03): Path B locked in — model bake-off results
Owner decision: **Path B only** (keyframe swap + animate); no motion-transfer tier for now.

Bake-off on the ad's opening shot (6.8s single take, party kitchen, FOUR Pringles
products in frame — hero can in hands + 3 on table):
- **GPT Image 2** (`openai/gpt-image-2/edit` on fal, billed via FAL — exists, newer
  than nano banana 2): WINNER. All four products swapped at natural scale/perspective,
  people/lighting/grade untouched, frame stays cinematic.
- **Nano Banana 2** (`fal-ai/nano-banana-2/edit`): hero swap OK, but table products
  pasted oversized/floating across the letterbox, one Pringles can survived. Fallback only.
- **Animation: LTX 2.3 Fast i2v** — 6s @1080p in ~40s wall-clock, 6 billable units
  ($0.24-0.36). Scene total ≈ **$0.50** (vs $1.31 motion-transfer).

Stack: keyframes (ffmpeg, free) → GPT Image 2 swap (~$0.10-0.25) → LTX Fast animate
(~$0.30) → assemble. Seedance 1.5 i2v as per-scene quality step-up.
Artifacts: images/tests/pringles-scene1-swapped-gpt2.jpg, videos/tests/test-10-scene1-pathB-ltx.mp4.

## Addendum 2 (2026-07-03): animation model retest + the action-arc prompt rule
- LTX 2.3 Fast on the busy party scene: **rejected by owner — visible morphing,
  inconsistent realism.** LTX stays for simple b-roll only, NOT people-heavy scenes.
- Same keyframe re-animated: **Seedance 1.5 i2v ($0.157 verified, 0.13 Mtok — cheaper
  than LTX here!)** and **Kling v3 standard i2v (~$0.34, 3.6 units)** — both hold
  background people far better (owner confirmed "people look real in both").
- **Action fidelity bug found**: prompt said "struggles to pull his hand out" → models
  animated the hand coming OUT; the source gag requires it to STAY stuck.
  **RULE for the per-shot analysis schema: every shot prompt must encode an action
  ARC with a locked end-state** (start state → attempts → end state) plus explicit
  invariants ("the bottle NEVER comes off"), and use `negative_prompt` where the
  model supports it (Kling has it; Seedance doesn't).
- Path B stack (pending final owner eyeball of the fixed-prompt reruns):
  GPT Image 2 swap → Seedance 1.5 or Kling v3 animate → scene total $0.30-0.60.
