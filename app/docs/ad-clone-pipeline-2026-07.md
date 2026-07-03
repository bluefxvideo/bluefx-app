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

## Addendum 3 (2026-07-03): THE KEYFRAME-STATE RULE (decisive finding)
Owner review of fixed-prompt runs: Seedance 1.5 still showed "holding", Kling v3
got only a finger stuck — because the START FRAME showed him *gripping* the
bottle. i2v models won't create physically absurd states mid-clip; they correct
toward plausibility.

**Fix that worked: paint the state into the keyframe first.** GPT Image 2
re-edit ("hand trapped INSIDE the oversized bottle up to the wrist, left hand
mid-yank") produced a perfect stuck-state frame. From that frame, BOTH
Seedance 2.0 i2v ($1.83, 130.5 units) and Kling O3 Pro i2v ($0.67, 4.8 units)
sustained the gag through the full arc (yank → fail → raise → stare).

**Pipeline rule: the image-edit stage must render the shot's START STATE
(including impossible/gag states) into the keyframe; the video model only
performs the action arc.** Analysis schema per shot: start_state (drawn into
keyframe) + action arc + locked end state + invariants + negative_prompt.

API quirk: Kling O3 i2v takes `image_url`; Kling v3 i2v takes `start_image_url`.
Open: retest Seedance 1.5 ($0.16) from the fixed frame — if it holds, cheap
tier remains default even for gag shots.

## Addendum 4 (2026-07-03): FINAL Path B stack — keyframe-state rule is model-independent
Seedance 1.5 retest from the fixed stuck-state keyframe ($0.157, 0.1305 Mtok):
HOLDS the gag through the full arc (even invented a table-brace pull beat).
Owner's motion-quality pick: **Kling O3 Pro** ("the last kling version got it right").

**Locked stack:** GPT Image 2 paints state+swap into keyframe (~$0.20) →
animate: Seedance 1.5 default (~$0.16) / Kling O3 Pro upgrade ($0.67, `image_url`
param) / Seedance 2.0 flagship ($1.83). Scene ≈ $0.35 default, $0.90 Kling.
7-scene clone ≈ $2.50-6. LTX: b-roll only. Retail 100-200 credits.

## Addendum 5 (2026-07-03): FULL 30s REMAKE SHIPPED + audio stage
Complete pipeline executed by hand on Pringles "Stuck In :30": all 15 scenes,
cut-for-cut on original edit rhythm, main character swapped (guy → Black woman
persona ref), all products → MITOLYN, aging arc INCLUDED (85th birthday +
coffin scenes worked). Nano Banana 2 for ALL person-swap edits (owner call:
GPT Image 2 "not getting it" for person swaps; nb2 nailed 13/15 first pass,
3 regens with background-lock language). Kling O3 Pro animated all 15
(3-7s each, all succeeded first try, ~5 min wall-clock parallel).
Assembly: ffmpeg trim-to-original-cut-duration + concat, 1080p25.

**Audio stage (new):** Lyria 3 Pro music bed (life-story brief, ~35s
instrumental) + fal-ai/mmaudio-v2 video-to-audio foley (watches the assembled
video, generates scene-matched diegetic ambience; negative_prompt 'music').
Mix: music 0.85 + foley 0.4, 2s fade-out, aac mux.

**Total cost ≈ $8** for a finished, scored 30s 15-scene remake.
Artifacts: videos/tests/REMAKE-pringles-mitolyn-30s{,-AUDIO}.mp4.
Product notes: per-scene edit-engine choice (nb2 vs GPT-2 fail differently),
checkpoint-at-swap-board is the money UX, color-match LUT pass + persona ref
enforcement are the two polish gaps.

## BUILD PLAN (2026-07-03, owner-approved product design): "Clone Studio"

### Product flow (per owner)
1. Ingest ad → scene breakdown board: each card shows **[original snapshot] +
   [AI-generated prompt: action, dialog, camera, details for THAT scene]**.
2. Per scene, the user can: edit the prompt text, type swap instructions
   ("replace person X with Y"), and upload reference images (their person,
   their product, person-holding-product). 
3. **Images first**: generate/regenerate the swapped keyframe per scene until
   it looks right (cheap iteration, ~$0.04-0.15/try, version history kept —
   reuse the previousVersions pattern from the editor).
4. **Then animate**: Kling O3 Pro per approved scene, **generate_audio: TRUE**
   (owner requirement — per-scene diegetic audio; pro audio-on ≈ $0.14/s).
5. Assemble on original cut timing; optional Lyria music bed; hand off to the
   react-video-editor as a composition (reuses timeline, captions, export).

### Rollout strategy (keep current tool, test new flow, then switch)
- Existing Clone Video Ad stays untouched at its route.
- New flow ships as **"Clone Studio (Beta)"** — separate tab/route, gated to
  `profiles.role = 'admin'` first (owner tests with real ads in production),
  then a beta flag for all users, then becomes the default and the old wizard
  retires. No migration risk; both flows share credits/storage/webhooks.

### Implementation map
- **DB**: `ad_clone_projects` (id, user_id, source_url, source_video_url,
  status, scenes jsonb, totals). scenes[]: {n, start, end, keyframe_url,
  analysis {action_arc, dialog, camera, on_screen_text, swap_targets},
  user_instruction, user_ref_urls[], edited_image_url, image_versions[],
  anim {request_id, video_url, status}, credits_spent}.
- **ffmpeg in main app container** (Dockerfile: apk/apt ffmpeg) for scene
  detection (`select=gt(scene,0.2)`) + keyframe extraction. (Alt: run on the
  remotion container which already has ffmpeg.)
- **Analysis**: Gemini 2.5 Flash on the video with a structured per-scene
  schema aligned to detected cut timestamps; outputs the editable prompt
  (action ARC with locked end-state + invariants — the keyframe-state rule).
- **Model clients**: new `fal-kling-video.ts` (o3 pro i2v, `image_url` param,
  negative_prompt, audio on) + reuse fal-nano-banana-2 edit (default engine)
  with per-scene engine toggle to `openai/gpt-image-2/edit` (new client) —
  the two engines fail differently (nb2 better person swaps, gpt2 better
  multi-object scale).
- **Webhook**: extend fal-ai route for kling completions (match by request_id
  in project scenes) + poll fallback like Video Maker.
- **Credits**: image gen 4/try; scene animation ~15/scene (3s audio-on Kling
  ≈ $0.42 → 3.4x margin); assembly free. Typical 10-scene clone ≈ 190-250
  credits retail vs ~$6-8 COGS.
- **Reuses**: refundFailedGeneration, billable-units logging, storage patterns,
  editor handoff via existing composition format + store-export.

### Build order (~1 week)
1. DB migration + ingest/segmentation service + structured analysis (2d)
2. Scene board UI: cards, prompt editing, ref uploads, image gen + versions (2d)
3. Kling orchestrator + webhook/poll + per-scene audio (1d)
4. Assembly + editor handoff + Lyria bed option (1d)
5. Beta gate, credits wiring, polish (1d)

## BUILDER'S CHEAT SHEET (verified facts a fresh session must not rediscover)

### Ingest (server has NO yt-dlp)
- Social URLs (TikTok/IG/FB): reuse `src/actions/tools/social-video-downloader.ts`
  (`downloadSocialVideo`) + `detectPlatform` from `@/lib/social-video-utils` —
  already used by video-analyzer (see analyzeSocialMediaVideo).
- YouTube: no server downloader today — MVP: direct file upload + social URLs;
  YouTube ingest is a later add (worker or service).
- ffmpeg is NOT in the main app container. Either add to app Dockerfile or run
  segmentation on the remotion container (has ffmpeg). Commands proven:
  cuts: `ffmpeg -i in.mp4 -vf "select='gt(scene,0.2)',showinfo" -f null -`
  keyframe: `-ss <mid> -frames:v 1 -q:v 2`; merge scenes <0.4s; pad clips to ≥2s.

### FAL queue URL trap (cost us a prod incident once already)
Submit URL ≠ status URL. Status/result use the BASE app id — a variant suffix
404s/405s. Bases: `fal-ai/kling-video`, `fal-ai/bytedance`, `bytedance/seedance-2.0`,
`fal-ai/ltx-2.3`, `fal-ai/mmaudio-v2`. Pattern:
`https://queue.fal.run/<base>/requests/<id>[/status]`. Capture
`x-fal-billable-units` response header on result fetch for cost logging.

### Verified minimal payloads
- Kling O3 Pro i2v (`fal-ai/kling-video/o3/pro/image-to-video`): { prompt,
  image_url (NOT start_image_url — that's v3), duration: "3".."15" (string),
  aspect_ratio "16:9"|"9:16"|"1:1", generate_audio: true, shot_type "customize",
  negative_prompt }. ~0.8 units/s; audio-on ≈ $0.14/s.
- NB2 edit (`fal-ai/nano-banana-2/edit`, sync via fal.run): { prompt,
  image_urls: [keyframe, ...refs], num_images: 1 } → images[0].url.
- GPT Image 2 edit (`openai/gpt-image-2/edit`, sync): { prompt, image_urls,
  quality: "high", output_format: "jpeg" } (+ mask_url exists).
- MMAudio v2 foley: { video_url, prompt, negative_prompt: "music...", duration }.
- Lyria music bed: see `src/actions/models/gemini-lyria.ts` (existing client).

### Editor handoff (assembly target)
Scene clips → a script_to_video_history-style record with
`remotion_composition` (see column shape in that table / the S2V orchestrator's
Step 8) → open editor at `${NEXT_PUBLIC_VIDEO_EDITOR_URL}/?videoId=X&userId=Y&apiUrl=Z`
(see `editor-redirect.tsx`); export writes back via /api/script-video/store-export.
Alt for v1: server-side ffmpeg concat (proven: trim each clip to original cut
duration, concat, single mp4) + audio mix (music 0.85 + foley 0.4, 2s fade).

### Existing code to reuse (file paths)
`src/actions/models/fal-nano-banana-2.ts` (edit client) ·
`src/lib/fal-image-guard.ts` (>5MB compression — apply to keyframes/refs) ·
`src/lib/credits/refund.ts` (idempotent refunds; reference by batch_id) ·
`src/actions/database/cinematographer-database.ts` deductCredits pattern ·
fal webhook: `src/app/api/webhooks/fal-ai/route.ts` (extend for kling request_ids) ·
poll-fallback pattern: `pollCinematographerFalGeneration` in ai-cinematographer.ts ·
version-history UX: ai-image-generator.tsx previousVersions ·
Persona refs: pass the SAME 2-3 person reference images into every scene edit
(identity drift was the one visible flaw in the hand-run remake).
