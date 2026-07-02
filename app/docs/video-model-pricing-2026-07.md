# BlueFX Video Model Pricing & Tier Strategy Brief
*Prices verified live 2026-07-02. Credit retail value: $37 / 600 = $0.0617/credit. Current Pro charge: 24 credits ≈ $1.48 retail per 6s clip.*

---

## 1. Normalized Comparison Table (verified prices only)

| Model / variant | Host + slug | $/s 720p | $/s 1080p | 6s @720p | 6s @1080p | Ref-image support | Audio | Quality note |
|---|---|---|---|---|---|---|---|---|
| **LTX 2.3 Fast** *(current Fast)* | Replicate `lightricks/ltx-2.3-fast` (fal same price) | — (no 720p tier) | $0.06 | — | **$0.36** | First+last frame only | Included, free toggle | Speed/cost tier; below Seedance-class realism; cheapest native 1080p–4K |
| **Seedance 1.5 Pro, audio on** *(current Pro)* | Replicate `bytedance/seedance-1.5-pro` | $0.052 | $0.12 | **$0.312** | $0.72 | Start+end frame only, no ref array | Native, lip-sync | Near-top of i2v leaderboards, but one generation behind 2.0 |
| Seedance 1.5 Pro, audio off | Replicate (same) | $0.026 | $0.06 | $0.156 | $0.36 | Same | Off | Same model, half price at 720p/1080p |
| **Seedance 2.0** (text/image/ref-image in) | Replicate `bytedance/seedance-2.0` | $0.18 | $0.45 | **$1.08** | $2.70 | **Up to 9 ref images + 3 ref videos + 3 audio clips** | Included | **#1 on Artificial Analysis t2v (Elo 1220); 10/10 character consistency reports** |
| Seedance 2.0 (ref *video* provided) | Replicate (same, `video_in`) | $0.22 | $0.55 | $1.32 | $3.30 | Same | Included | Same model; surcharge when a reference video is passed |
| Seedance 2.0 standard | fal `bytedance/seedance-2.0/*` | $0.3034 | $0.682 | $1.82 | $4.09 | Same (dedicated ref-to-video endpoint) | Included | ⚠ fal bills ref-video *input* duration too; page self-conflicts $0.3034 vs $0.3024 (~0.3%) |
| Seedance 2.0 fast | fal | $0.2419 | **does not exist** (fast caps at 720p — CORRECTED) | $1.45 | — | Same | Included | Lower latency tier |
| Seedance 2.0 standard / fast | WaveSpeed | $0.24 / $0.20 | $0.60 / $0.50 | $1.44 / $1.20 | $3.60 / $3.00 | i2v caps refs at 4 images | Included | New host integration required |
| Seedance 2.0 (first-party) — **CORRECTED: pricing is public** | BytePlus ModelArk `dreamina-seedance-2-0-260128` | ~$0.151 (derived from $7.0/M tokens; BytePlus's own example $0.76/5s) | ~$0.374 | ~$0.91 | ~$2.24 | Same (official API) | Included | Cheapest 2.0 route, but enterprise account + brand-new integration; flex half-price tier NOT available for 2.0 |
| Veo 3.1 standard, audio on | fal `fal-ai/veo3.1` / Replicate `google/veo-3.1` | $0.40 | $0.40 (flat) | $2.40 | $2.40 | 1–3 refs (R2V) — **16:9 + 8s only on Replicate** | Native, best-in-class lip-sync | #4–6 arena; true 4K (fal only); mandatory SynthID watermark; 8s clip ceiling |
| Veo 3.1 Fast, audio on | fal / Replicate `google/veo-3.1-fast` | $0.15 | $0.15 (flat) | $0.90 | $0.90 | **No ref images** (README claims it; schema doesn't have it) | Native | Blind votes nearly indistinguishable from standard (#8–9 vs #4) |
| Veo 3.1 Lite, audio on | fal `fal-ai/veo3.1/lite` | $0.05 | $0.08 | $0.30 | $0.48 | No | Native | Budget tier with real audio + 1080p |
| Kling O3 ref-to-video, standard, audio on | fal `fal-ai/kling-video/o3/standard/reference-to-video` | $0.112 (tier ≈720p-class) | — (use pro) | $0.672 | — | **Yes — multi-image "elements" per character/object, @Element refs in prompt** | Optional (+$0.028/s) | Headline claim: stable character identity/objects/environments — the exact cloning requirement |
| Kling O3 ref-to-video, pro, audio on | fal `.../o3/pro/reference-to-video` | — | $0.14 (tier ≈1080p-class) | — | $0.84 | Same | Optional | 1080p-class tier; 4K tier also exists |
| Kling v3 pro i2v | fal `.../v3/pro/image-to-video` | — | $0.112 off / $0.168 on | — | $0.672–1.008 | Start frame + up to 5 elements | Optional, voice control $0.196/s | Start-frame + refs combo; up to 15s |
| Hailuo 2.3 standard 768p | fal | $0.0467 ($0.28/6s video) | — | **$0.28** | — | Single start frame only | **None** | Best motion realism per dollar; no refs, no audio |
| Hailuo 2.3 pro 1080p | fal | — | **UNVERIFIABLE** ($0.49/video, duration not stated on page) | — | $0.49/clip | Single frame | None | Treat per-second rate as unknown |
| Wan 2.6 i2v | fal `wan/v2.6/image-to-video` | $0.10 | $0.15 | $0.60 | $0.90 | Single first frame | Yes | Mid-pack value; no multi-ref |
| Sora 2 / Sora 2 Pro | Replicate | $0.10 / $0.30 | — / $0.50 (1024p) | $0.60 / $1.80 | — / $3.00 | Single frame, likeness restrictions | Always on | **Disqualified: OpenAI discontinues Sept 24, 2026** |
| Runway Gen-4 Turbo | Replicate `runwayml/gen4-turbo` | $0.05 | — | $0.30 | — | First frame only (multi-ref belongs to its *image* model) | No | Cheap 720p filler; weak ref path |
| Runway Gen-4.5 | Replicate `runwayml/gen-4.5` | $0.12 (single rate 720p/1080p) | $0.12 | $0.72 | $0.72 | Unclear (likely t2v-only; ref claim MEDIUM confidence) | Not split out | Strong physics/prompt adherence |

---

## 2. Seedance 2.0 Assessment

**Real and available — yes.** Launched ~Feb 2026 (BytePlus/Dreamina), on fal since April 2026, official Replicate model with 968K+ runs, plus WaveSpeed and first-party BytePlus ModelArk. Siblings: 2.0 Fast, 2.0 Mini, and a 2.1 already exists.

**What it costs (verified):** cheapest usable routes for you are **Replicate at $0.18/s 720p ($1.08/6s), $0.45/s 1080p ($2.70/6s)** — audio included, no on/off split — with a `video_in` surcharge ($0.22/s / $0.55/s) when you pass a reference *video*. fal is markedly pricier ($0.3034/s / $0.682/s). BytePlus first-party is cheapest (~$0.151/s 720p) but means a new enterprise integration.

**Is the reference ability what Clone Video Ad needs? Largely yes — this is its headline feature.** One generation accepts text + up to **9 reference images + 3 reference videos (2–15s combined) + 3 audio clips**, referenced inline as `[Image1]`, `[Video1]`. Documented first-class use cases are literally your flow: product swap ("Replace the perfume in [Video1] with the face cream from [Image1], keeping all original motion"), character/product consistency, motion-style transfer, outfit-change ads. #1 on the Artificial Analysis leaderboard with a 115+ Elo lead over Kling 3.0 and Veo 3.1; third-party reviews rate it 10/10 on character consistency. 4–15s clips (vs Veo's 8s), multi-shot editing with camera control inside one 15s generation.

**Honest unknowns / limits:**
- "Scene selection" as a product feature isn't a single API call — the model does multi-shot *within* one ≤15s generation; a multi-scene ad still needs app-side shot planning and assembly.
- On Replicate, reference images **cannot be combined with first/last-frame inputs** — one mode or the other.
- No independent verification yet of *your* use case quality (competitor-ad recreation from stills); physics in fast-action scenes reportedly still trails Kling 3.0. Budget a $20–30 eval pass before committing.
- fal's ref-to-video bills the input video's duration too — cost per clip on fal is higher than the per-output-second number implies. Replicate's flat `video_in` per-output-second rate is easier to meter into credits.

---

## 3. Cost Ladder (per 6s clip, audio on where the model has it)

| $ / 6s | Model @ config |
|---|---|
| $0.156 | Seedance 1.5 Pro 720p, audio OFF (Replicate) |
| $0.28 | Hailuo 2.3 standard 768p (no audio) |
| $0.30 | Veo 3.1 Lite 720p w/audio (fal) · Runway Gen-4 Turbo 720p (no audio) |
| **$0.312** | **← CURRENT PRO: Seedance 1.5 Pro 720p w/audio (Replicate)** |
| **$0.36** | **← CURRENT FAST: LTX 2.3 Fast 1080p w/audio (Replicate)** · Seedance 1.5 Pro 1080p audio-off |
| $0.48 | Veo 3.1 Lite 1080p w/audio (fal) |
| $0.672 | Kling O3 standard ref-to-video w/audio (fal) |
| $0.72 | Seedance 1.5 Pro 1080p w/audio (Replicate) · Runway Gen-4.5 |
| $0.84 | Kling O3 pro ref-to-video w/audio (fal, 1080p-class) |
| $0.90 | Veo 3.1 Fast w/audio, 720p or 1080p · Wan 2.6 1080p |
| ~$0.91 | Seedance 2.0 720p (BytePlus first-party, derived) |
| $1.08 | **Seedance 2.0 720p (Replicate, refs-in, audio incl.)** |
| $1.20–1.45 | Seedance 2.0 720p (WaveSpeed fast / fal fast) |
| $1.32 | Seedance 2.0 720p with reference video (Replicate `video_in`) |
| $2.40 | Veo 3.1 standard w/audio |
| $2.70 | Seedance 2.0 1080p (Replicate) |
| $3.30–4.09 | Seedance 2.0 1080p `video_in` (Replicate) / fal standard 1080p |

Takeaway: your current Pro costs you $0.31 and retails at $1.48 (4.7× markup). Seedance 2.0 at 720p on Replicate lands at $1.08 — roughly *at* today's Pro sticker price, so the upgrade is affordable but needs a higher credit price to keep 50% margin.

---

## 4. Credit Pricing (target: retail ≥ 1.5× raw provider cost; 1 credit = $0.0617)

Math: raw $ ÷ 0.0617 = credits-at-cost → ×1.5 → round up to a clean number.

| Model @ config (6s) | Raw $ | Credits at cost | ×1.5 | **Suggested credits** | Retail $ | Effective multiple |
|---|---|---|---|---|---|---|
| LTX 2.3 Fast 1080p | $0.36 | 5.8 | 8.8 | **10** | $0.62 | 1.7× |
| Veo 3.1 Lite 1080p w/audio | $0.48 | 7.8 | 11.7 | **12** | $0.74 | 1.5× |
| Kling O3 std ref-to-video w/audio | $0.672 | 10.9 | 16.3 | **18** | $1.11 | 1.7× |
| Veo 3.1 Fast w/audio (720p/1080p) | $0.90 | 14.6 | 21.9 | **24** | $1.48 | 1.6× |
| Seedance 2.0 720p (Replicate, image/text refs) | $1.08 | 17.5 | 26.3 | **30** | $1.85 | 1.7× |
| Seedance 2.0 720p + ref video (Replicate) | $1.32 | 21.4 | 32.1 | **35** | $2.16 | 1.6× |
| Seedance 2.0 1080p (Replicate) | $2.70 | 43.8 | 65.6 | **70** | $4.32 | 1.6× |
| (ref) Seedance 1.5 Pro 720p w/audio — current 24 cr | $0.312 | 5.1 | 7.6 | 8 min viable | $1.48 today | today 4.7× |

---

## 5. Recommended Lineup

**(a) Video Maker — budget tier ("super good price"): keep LTX 2.3 Fast, Replicate `lightricks/ltx-2.3-fast`.**
$0.36 per 6s clip at native 1080p with audio, zero migration. **10 credits** (or 8 if you want a marketing hook; 8 = $0.49 retail = 1.37×, slightly under the 50% target). Nothing verified beats it for native 1080p+audio at this price — Veo 3.1 Lite is close ($0.48 at 1080p w/audio) if you ever want a second budget flavor, and it's on fal which you already integrate.

**(b) Video Maker — premium tier ("super good quality at adjusted price"): Seedance 2.0 720p on Replicate `bytedance/seedance-2.0`.**
$1.08 per 6s clip, audio included → **30 credits** ($1.85 retail). It's the #1-ranked model outright, native audio with lip-sync, up to 15s clips, and it replaces Seedance 1.5 Pro on the *same host with a ByteDance-family schema* — lowest migration effort of any upgrade. Runner-up if you want to hold the 24-credit sticker: **Veo 3.1 Fast** ($0.90/6s w/audio at 720p *or* 1080p, on both Replicate and fal, blind-vote quality nearly equal to Veo standard) → 24 credits exactly meets 1.6× margin. Trade-off: Veo Fast has no reference images and an 8s cap; Seedance 2.0 is the leaderboard leader and shares an engine with the Clone tool.

**(c) Clone Video Ad engine: Seedance 2.0 reference mode on Replicate (primary), Kling O3 ref-to-video on fal (cheap option).**
- **Premium/default: Seedance 2.0, Replicate, 720p.** Text + up to 9 ref images: $1.08/6s → **30 credits**. If the user also feeds a competitor's reference *video* (motion/style transfer — the strongest cloning mode): $1.32/6s → **35 credits**. Prefer Replicate over fal here: flat per-output-second billing (fal also meters the input video's duration), and $0.18 vs $0.30/s.
- **"Good price" option: Kling O3 standard reference-to-video, fal.** $0.672/6s with audio → **18 credits** ($1.11). Genuine multi-image element refs with identity stability as its headline claim — the only verified real competitor to Seedance 2.0 for this job, at 60% of the cost.
- Skip: Veo 3.1 R2V (max 3 refs, 16:9-only + 8s-only on Replicate, no fast tier, watermark, $2.40/6s w/audio); Sora 2 (EOL Sept 2026); Hailuo/Wan/Runway (no multi-ref path).

Migration note: everything recommended runs on Replicate or fal, both already integrated. BytePlus first-party would cut Seedance 2.0 cost ~16% (~$0.91 vs $1.08 per 6s 720p) but requires a new enterprise integration — revisit only if Clone volume gets large.

---

## 6. Caveats — do not hard-code these numbers

- **fal Seedance 1.5 Pro 1080p: estimate only.** No published flat rate; token math gives $0.117–0.146/s with audio depending on whether fal bills 24 or 30fps (its own 720p quote implies 24fps). Use Replicate's verified $0.12/s instead.
- **Hailuo 2.3 Pro per-second: UNVERIFIABLE.** Only "$0.49 per video generation" is on the page; clip duration unstated, so ~$0.082/s is an assumption.
- **BytePlus Seedance 2.0 (~$0.151/s 720p, ~$0.374/s 1080p): derived** from public per-token list prices (docs updated 2026-07-01) and matches BytePlus's own worked examples — but not battle-tested via an actual invoice. The Reddit "$0.043/s" figure contradicts the official list and should be ignored. Flex/offline half-pricing is *not available* for Seedance 2.0.
- **fal Seedance 2.0 fast 1080p does not exist** (fast caps at 720p) — any "~$0.54/s" figure is invalid.
- **fal LTX 2.3 fast pages show a conflicting marketing table** ($0.04/$0.08/$0.16/s) next to the authoritative billing box ($0.06/$0.12/$0.24/s). Budget on $0.06/s. Non-fast fal LTX base rates ($0.08/s) were not re-verified.
- **fal ref-to-video (Seedance 2.0) bills input video duration** — tokens = h×w×(input+output dur)×24/1024 — so a 10s reference video inflates the bill beyond output seconds.
- **fal's own Seedance 2.0 pages disagree by ~0.3%** ($0.3034 vs $0.3024/s headline vs table) — immaterial but real.
- **Veo 3.1 R2V constraints:** Replicate schema locks refs to 16:9 + 8s (no vertical R2V); veo-3.1-fast has *no* ref-image parameter despite README claims; fal's max ref count (3) inferred from examples, not schema-confirmed (MEDIUM). fal's Lite i2v endpoint slug was inferred, not scraped (MEDIUM).
- **Runway Gen-4.5:** ref-image support likely conflated with Runway's gen4-image model (MEDIUM); 720p/1080p share one $0.12/s rate with no verified split.
- **Sora 2 / Sora 2 Pro: hard EOL Sept 24, 2026** — do not build on them regardless of price.
- **Kling voice-control surcharge** exists beyond audio-on rates ($0.154/s v3-standard, $0.196/s v3-pro) — meter it if you expose voice control.
- **Seedance 1.5 "audio-off = half price" is false at 480p** ($0.013 vs $0.0125) — only exact at 720p/1080p; irrelevant unless you add a 480p tier.
- Leaderboard Elo figures come from two differently-scaled sources (Artificial Analysis vs arena.ai snapshots); ranks are directionally consistent (Seedance 2.0 #1–2, Veo 3.1 #4–6) but don't quote the raw scores interchangeably.

---

## Addendum (2026-07-02, owner corrections)

**Policy: FAL-only going forward.** (Note: Video Maker + script-to-video voiceover currently run on Replicate — code: `src/actions/models/video-generation-v1.ts`, `video-generation-seedance.ts`, `services/minimax-voice-service.ts`. FAL-only requires migrating these.)

**LTX 2.3 Fast on FAL — page self-conflict, re-verified live:**
- Marketing table / page header: "From $0.04/s" → 6s @1080p = $0.24
- Billing box (authoritative wording): "$0.06/s for 1080p, $0.12/s 1440p, $0.24/s 2160p" → 6s = $0.36
- Budget on $0.06/s; settle via FAL dashboard Usage & Billing line items (editor animate-image already generates FAL LTX charges).

**FAL-only lineup:**
| Slot | Model (FAL) | Raw /6s | Credits (≥1.5×) | Retail |
|---|---|---|---|---|
| Video Maker budget | LTX 2.3 Fast 1080p+audio | $0.24–0.36 | 10 | $0.62 |
| Video Maker premium | Seedance 2.0 Fast 720p | $1.45 | 36 | $2.22 |
| (premium alt) | Veo 3.1 Fast 720/1080p+audio (no refs) | $0.90 | 24 | $1.48 |
| Clone default | Seedance 2.0 std, image refs, 720p | $1.82 | 45 | $2.78 |
| Clone budget | Kling O3 std ref-to-video | $0.672 | 18 | $1.11 |

**FAL-only trade-offs:** Seedance 2.0 ~70% pricier than Replicate ($0.3034 vs $0.18/s 720p); FAL ref-to-video bills INPUT video duration (10s ref + 6s out ≈ $4.85 → auto-trim refs to ≤5s or image-refs-only); Seedance 2.0 Fast caps at 720p (std 1080p = $4.09/6s ≈ 100 credits, skip).

## Addendum 2 (2026-07-02): Seedance 2.0 Replicate pricing re-verified (owner challenged it)

Fresh scrape of replicate.com/bytedance/seedance-2.0 (official ByteDance org model, is_official:true, 968K runs — same full model FAL hosts). Complete table verbatim:

| Resolution | non_video_in $/s | video_in $/s |
|---|---|---|
| 480p | $0.08 | $0.10 |
| 720p | $0.18 | $0.22 |
| 1080p | $0.45 | $0.55 |
| 4K | $1.00 | $1.25 |

Confirmed ~40% cheaper than FAL at 720p ($0.18 vs $0.3034) and ~4× cheaper for ref-video cloning (Replicate bills output seconds only; FAL bills input+output duration).

**Decision guidance:** FAL-only consolidation everywhere EXCEPT Seedance 2.0 → run on Replicate (already-live integration via Video Maker). 480p tier ($0.08/s = $0.48/6s) is a candidate "draft mode" for Clone iterations before a 720/1080p final render.

## Addendum 3 (2026-07-02): Live A/B test — LTX Fast vs Seedance 2.0 (FAL) vs Seedance 2.0 (Replicate)

Same ref image (UGC woman + MITOLYN bottle, 720x1280), same prompt w/ spoken line, 6s, 9:16, audio on.

- **LTX 2.3 Fast (FAL, 1080p)**: done in <10s, ~$0.24–0.36. Motion/identity good; **product label morphed** when bottle set down; minor background drift. Verdict: budget tier, not for product ads.
- **Seedance 2.0 (FAL, 720p)**: ~3min, ~$1.82. Identity excellent, **label crisp entire clip incl. set-down**, background consistent. Verdict: premium/cloning engine.
- **Seedance 2.0 (Replicate, 720p)**: **BLOCKED — E005 "flagged as sensitive" on 3 attempts** (full prompt / neutral dialogue / innocent "smiles and waves"), each failing in ~3s. Same model+image passed on FAL → Replicate deployment runs strict human-likeness moderation on i2v. **Unusable for UGC/human content → the "cheaper on Replicate" option is dead for our use case. FAL-only policy stands with no exceptions.**

Test clips: videos/tests/test-1-ltx-fast-1080p.mp4, test-2-seedance2-fal-720p.mp4 (Supabase storage).

**Final proposed lineup (all FAL):** LTX Fast budget 10 credits; Seedance 2.0 720p premium+clone 45 credits; Kling O3 ref-to-video optional mid tier 18 credits (untested). Ref-video motion transfer on FAL: auto-trim input refs to ≤5s (input duration is billed).

## Addendum 4 (2026-07-02): Replicate Seedance 2.0 moderation — definitive

Fourth probe: same woman in fully-covering sweater + innocent "smiles and waves" prompt → E005 in 4s. Cumulative: 4 attempts, 2 images (tank top / sweater), 3 prompts (product+claims / neutral dialogue / no product no dialogue) — ALL blocked. Verdict: **blanket photorealistic-human likeness filter on Replicate's ByteDance account** (E005 = ByteDance upstream moderation; no schema param to relax; README silent). Only path would be a Replicate enterprise moderation agreement — not worth it vs FAL hosting the identical model without these blocks.

**FINAL LINEUP (all FAL): LTX 2.3 Fast default 10 credits ($0.24–0.36/6s @1080p, <10s gen — owner judged output "remarkably good", only defect = product label morphs on set-down) · Seedance 2.0 premium + Clone engine 45 credits ($1.82/6s @720p, label-crisp, up to 9 ref images).**

Implementation notes: wrap generations with refundFailedGeneration() (FAL can content-filter too, just far less aggressively); LTX $0.04-vs-$0.06/s still unsettled — check FAL dashboard Usage & Billing (today's test created real line items).

## Addendum 5 (2026-07-02): reference-to-video billing verified (audio refs FREE, ref-video cheaper than feared)

fal bytedance/seedance-2.0/reference-to-video billing text verbatim: tokens = (h × w × (input VIDEO duration + output duration) × 24)/1024 at $0.014/1K tokens (480p-1080p). **Audio references are NOT in the formula — zero marginal cost** (up to 3 clips, combined ≤15s, needs ≥1 image/video ref). **When video inputs are present the price is multiplied by 0.6** → 10s ref video + 6s output @720p ≈ $2.90 (not ~$4.85 as estimated in Addendum 2 without the multiplier). Ref-video still duration-dependent → Clone tool should auto-trim refs.

Shipped in Video Maker Ultra: reference images (≤9) + reference audio (≤3) via reference-to-video endpoint. Ref videos deferred to Clone tool.
