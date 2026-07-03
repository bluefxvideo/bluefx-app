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
