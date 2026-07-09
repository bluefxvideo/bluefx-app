# AI Media Machine — Revenue & Pricing Strategy (2026-07-09)

## Part 1: Internal reality (from our DB + FastSpring net-revenue report)

**Revenue (FastSpring, last 12 months, net):** ai-media-machine monthly $8,001; yearly $4,137;
credit packs $1,189 (already selling with zero promotion!); starter/pro variants $369.
**AMM total ≈ $13,700/yr ≈ $1,141/mo net.** Grew ~11x YoY ($1.2k prior period). ClickBank adds an
unknown amount on top (not in this report). Website service is a separate ~$3.1k/yr line.

**Subscriber base (DB snapshot):** 116 'active' rows (≈94 monthly-pattern + 22 yearly by period span),
28 trials, 277 cancelled (66% of 421 all-time). DB 'active' overstates FastSpring billing (stale
period_ends; includes ClickBank). ~40 new trials/mo, declining from 53 (Jan). Cohort stickiness:
~17% of signups aged 35-120d are still active.

**Engagement (the crisis):** only 17 of 116 actives used ANY tool in 60 days; 5 of 22 yearly.
Pay-and-don't-use is the churn pipeline. Activation > pricing as the #1 retention lever.

**What's actually used (60d, owner excluded, 12,123 credits, 73 users):**
video-generation 7,082cr (42u) · talking-avatar 1,560cr (11u) · scene-images 1,248cr (34u) ·
storyboard 558cr (7u) · editor-animate 354cr (3u) · video-analyzer 252cr (30u!) · everything else trace.
It's a VIDEO-AD product in practice; the 14-tool suite is packaging.

**Whales:** top active burners 300-1,200cr/60d (theshamron@, greenmatthar@, bert@cre8ing.be,
t_richards@). Credit packs already monetize this — scale it.

**AI COGS:** ~6k credits/mo across all customers ≈ $200-300/mo (~6-8% of revenue). Margin is not
the constraint; volume and ARPU are.

---

# AI Media Machine — Pricing Strategy Brief
*Competitor data verified live 2026-07-09. Flags: ⚠ = corrected or lower-confidence numbers.*

---

## 1. Pricing Landscape

| Competitor | Segment | Entry | Mid | High | Trial strategy | Metering |
|---|---|---|---|---|---|---|
| **Creatify** | UGC ad tools | Free ($0, 10cr, watermark) / Starter **$39** (100cr) | Pro **$99–$299** (300–1,000cr) | Pro **$499–$999** (2,000–5,000cr); Ent. custom | Free tier forever, no card, no timed/$1 trial | Credits, roll over once (2 mo) |
| **Arcads** | UGC ad tools | Starter **~$110** ⚠ (8,000cr ≈ 10 actor-min) | Creator **~$220** ⚠ (16,000cr) | Pro custom, ~$500+ ⚠ | **No trial at all**; pricing hidden behind signup; refund-if-unused only | Credits; hard block at limit, no top-ups below Pro |
| **MakeUGC** | UGC ad tools | Start up **$59** (500cr) / $29 annual | Growth **$79** (1,000cr) | Pro **$149–$249** (2,000–5,000cr); Ent. custom | **$1 trial, 72h** (24h on annual ⚠), card charged, auto-renews; "Unlimited" disabled during trial | Credits, no rollover; ⚠ strikethrough "discounts" are fake (strike = own monthly price) |
| **Icon** | UGC (human) | **$999/mo** (6 human ads) | — | Managed, custom | 3-day $0 trial, card required, billed before ads exist | Deliverables (6 ads), no credits |
| **AdCreative.ai** | Ad creative | Starter **$39** (10 downloads) | Pro **$249** (50) | Ultimate **$999** ⚠ (page also shows $599) | 7-day free trial, card required, auto-converts | Credits = downloads; generation free |
| **Foreplay** | Ad research (no generation) | Basic **$59** | Workflow **$175** | Agency **$459** | 7-day trial; ⚠ contradicts itself on card requirement | Seats + brand slots, not credits |
| **Atria** | Ad creative | Core **$159** ($129 ann.) | Plus **$599** | Business **$1,199** | Free signup, no card, 1,000 credits | Credits + seat/spend caps |
| **InVideo AI** | AI video suite | Plus **$20** (75cr) | Max **$100** (390cr) / Generative **$200** (800cr) | Elite **$1,000** (4,250cr) | Free tier, weekly credit reset, no card | Credits at raw API pass-through + prepaid top-ups |
| **Fliki** | AI video suite | Standard **$28** ⚠ (~180cr/mo) | Premium **$88** ⚠ (~600cr/mo) | Enterprise custom | Free-forever tier, watermarked, no card | Credits per action, even exports cost credits |
| **Pictory** | AI video suite | Starter **$29** | Pro **$59** | Team **$199** | 14-day free trial, **no card** | Dual: export minutes + AI credits |
| **Zebracat** | AI video suite | Cat Mode **$39** (15 videos, 350cr) ⚠ site self-contradicts | Super Cat **$99** | Unlimited Cat **$199** (still 3,600cr cap) | Freemium, no card; refund void on download | Videos/mo + gen-AI credits |

⚠ Arcads dollar figures are third-party paywall captures (help-center credit numbers are first-party). Fliki USD corroborated via G2, not read directly.

---

## 2. Where $37 / 600 Credits Sits

**You are priced at the bottom of the ad-tools segment while delivering top-of-segment capability.**

What $37–39 buys elsewhere:
- **Creatify $39**: 100 credits (~1/6 your allowance), **no Ad Clone** — that's gated to Pro at $99+.
- **AdCreative $39**: 10 downloads. Images, mostly.
- **Zebracat $39**: 15 videos, 350 credits, 2-min cap, no cloning.
- **InVideo $20 / Fliki $28 / Pictory $29**: generic video suites, no ad-cloning, thinner credit allowances (75 / ~180 / 100).

You are cheaper than every UGC-ad-tool competitor's *functional* entry point (Creatify Ad Clone effectively $99, MakeUGC $59, Arcads ~$110, Icon $999) and only undercut by generic suites that don't do what Clone Studio does. **Verdict: underpriced on capability, roughly right as a funnel entry price.** The problem isn't $37 — it's that Clone Studio is being given away inside it.

---

## 3. The Cloning Angle — Your Differentiator's Market Price

Who sells automated competitor-ad recreation, and at what floor:

| Tool | Cloning capability | Cheapest tier that includes it |
|---|---|---|
| Creatify | Ad Clone (extracts structure, rewrites script, regenerates with avatars) | **$99/mo** (Pro monthly; $49/mo annual at 300cr) |
| MakeUGC | Video Agent (upload reference ad → rebuilt with your product) | **$149/mo** Pro (monthly; $79 annual) |
| Icon | Adspy → competitor-inspired *human* production | **$999/mo** |
| Atria | Clones **image** ads only | $159/mo |
| Foreplay | Research/brief only, no generation | $59/mo |
| Arcads, InVideo, Fliki, Pictory, Zebracat | **No competitor-ad cloning** | — |

Nobody verified in this set does **scene-by-scene reconstruction of a full competitor video ad with your product via reference-image video gen**. Creatify's Ad Clone (structure + script + avatar swap) is the nearest analogue and it costs **$99–$199/mo at your credit level** (600cr Pro = $199 monthly / $99 annual). MakeUGC's is $149. **The market has priced this feature at ~$99–$149/mo minimum. You sell it for $37.** That's a 2.7–4x gap on your headline feature.

---

## 4. Trial Economics

**What dominates:** free-forever tiers with watermarks/tiny credits (Creatify, InVideo, Fliki, Zebracat, Atria) and card-required free trials that auto-bill (AdCreative 7d, Icon 3d, Foreplay 7d). Only **MakeUGC runs a $1 trial — and it's brutal: 72 hours, card charged, auto-renews, premium "Unlimited" features disabled during trial, one-trial-per-person policy with penalty charges.** Arcads has no trial and still charges $110.

**Is $1 still competitive?** Yes — it's arguably the best structure for warm-list affiliate traffic (free tiers attract tire-kickers; $1 + card = qualified). But your current version is the most generous $1 trial in the market: 100 credits with full Clone Studio access lets someone clone a full ad and leave. MakeUGC gives $1 buyers 72 hours and *withholds* the premium feature.

**Keep the $1 hook, tighten the tap:**
1. **Cut trial credits 100 → 40–50.** Enough for a taste of every tool; not enough to extract a finished campaign.
2. **Time-box it: 3–7 days** with card-on-file auto-conversion (the market norm; MakeUGC proves 72h works on $1 traffic).
3. **Clone Studio on trial = 1 clone project, watermarked, standard engine only** (no Kling O3 Pro class). The full pipeline is visible, the deliverable isn't usable. This is exactly Creatify's watermark-upgrade lever and MakeUGC's "Unlimited activates after trial" lever.
4. One trial per card/email; you're on FastSpring/ClickBank funnels where trial abuse is real — MakeUGC's policy shows the category has this problem.

---

## 5. Concrete Pricing Recommendations

**Core moves:**
- **Keep $37 as the entry tier** — it's your conversion engine and undercuts Creatify's $39 with 6x the credits. Don't touch the number that your funnel history is built on.
- **But cap Clone Studio at the entry tier**: e.g., 3 clone projects/mo on $37. Full ad clones are the expensive-compute, high-value action; meter them separately from generic credits.
- **Add "Clone Pro" at $97/mo**: 1,500 credits, unlimited clone projects, priority engines (Kling O3 Pro default), maybe 2 brand profiles. $97 deliberately sits under Creatify Pro $99 and under MakeUGC Pro $149 while offering *more* automation. For agencies: **$197/mo**, 3,500 credits, client workspaces — still half of Foreplay Agency + a generator on top.
- **Credit top-up packs**: 200cr/$15, 500cr/$29 (≈your entry $/credit, so no cannibalization). Creatify and Arcads *don't* sell top-ups below top tiers — their users hit walls; yours won't. Near-pure margin, zero conversion risk.
- **Yearly: cut the discount from ~50% to ~35–40%** (e.g., $37 → $24/mo billed $288/yr). The 50% club (MakeUGC, Zebracat, AdCreative) pairs it with fake-strikethrough theatrics; the credible players run 15–25% (Creatify Starter 15%, InVideo 15%, Fliki 25%, Atria 20%). Keep 50% only as a limited launch offer on Clone Pro annual to pull cash forward.

**Scenario ladders — revenue per 100 trials** (assumptions: warm-list $1 trial→paid conversion 25% at status quo, drops ~3–5pts per meaningful friction added; ~10–20% of converts choose the high tier when the differentiator is gated there; $100 trial-fee gross covers ~trial COGS; figures are first-month MRR, before churn):

| Scenario | Structure | Conversion assumption | MRR / 100 trials |
|---|---|---|---|
| **A. Status quo** | $37 all-in | 25% → 25 × $37 | **$925** |
| **B. Gate + Pro tier** (recommended) | $37 (3 clones/mo) + $97 Clone Pro | 21% total: 17 × $37 + 4 × $97 | **$1,017** + top-ups (~$50–75 if 15% of 21 buy one $15–29 pack) ≈ **$1,075–1,100** |
| **C. Aggressive** | $47 entry (5 clones) + $127 Pro | 18% total: 14 × $47 + 4 × $127 | **$1,166** — but tests your funnel's price elasticity; run only after B proves the gate doesn't crater conversion |

Scenario B beats A even if total conversion falls 4 points, because 4 Pro users replace 10 entry users in revenue. Your $1k/mo profit target is met from **one funnel push of ~100–150 trials under B**, assuming AI COGS ≤ 35% of MRR (heavy Kling-class usage is exactly why clone projects must be metered).

---

## 6. Quick Wins, Ranked by Effort-to-Revenue

1. **Sell credit top-up packs ($15/$29).** Days of work, immediate incremental revenue, zero funnel risk. Every credit-metered competitor either hides top-ups or blocks users entirely (Arcads).
2. **Meter Clone Studio (3 projects/mo on $37).** A limit counter, not a rebuild. Creates the upgrade reason and caps your worst-case compute cost per $37 user.
3. **Launch Clone Pro at $97/mo.** Mostly a Stripe/FastSpring product + limits config. The market has already validated $99–$149 for less automation.
4. **Trial tightening: 100→50 credits, 1 watermarked clone, 7-day cap.** Protects margin on every trial cohort forever; MakeUGC proves $1 traffic tolerates far harsher terms.
5. **Reduce yearly discount to ~35–40%** for new signups. Pure margin recovery; no code.
6. **Raise entry to $47 for new cohorts only (grandfather existing).** Highest revenue ceiling, highest risk — A/B it on a list segment after 1–4 are live, not before.

**One-line thesis:** $37 is the right *door price*, but Clone Studio is a $99–$149 market feature — stop bundling it uncapped, sell it as the ladder, and the same 100 trials fund your $1k/mo target with room to spare.
