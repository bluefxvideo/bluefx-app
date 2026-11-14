# ClickBank affiliate funnel: follow-up emails (draft)

Draft for the owner's approval, 2026-11-14. Adapted from the live "$49 funnel" automations in MailerLite, read on 2026-11-14 with read-only calls. Nothing was created, edited, switched on or sent in MailerLite. The funnel itself is described in `app/docs/cb-affiliate-funnel.md`.

6 automations, 14 emails (built from 18 original emails: 3 website emails left out, 1 deadline email dropped).

## Contents

1. [Decisions for the owner](#decisions-for-the-owner)
2. [Overview](#overview)
3. [Same in every email](#same-in-every-email)
4. [Automation 1: CB Funnel: Follow-up](#automation-1-cb-funnel-follow-up)
5. [Automation 2: CB Funnel: Your clean video](#automation-2-cb-funnel-your-clean-video)
6. [Automation 3: CB Funnel: AI Media Machine same day](#automation-3-cb-funnel-ai-media-machine-same-day)
7. [Automation 4: CB Funnel: $49 buyers, AI Media Machine (days 2-6)](#automation-4-cb-funnel-49-buyers-ai-media-machine-days-2-6)
8. [Automation 5: CB Funnel: Non-buyers](#automation-5-cb-funnel-non-buyers)
9. [Automation 6: CB Funnel: No video](#automation-6-cb-funnel-no-video)
10. [Left out: the website emails (optional)](#left-out-the-website-emails-optional)
11. [Build notes](#build-notes)

## Decisions for the owner

1. **Resolved: the non-buyer emails link the AI Media Machine sales page (Automation 5).** A CB lead who hasn't paid sees only the $49 offer on {$free_video_url}, so every AI Media Machine link in emails 5.1 to 5.3 is now https://app.bluefx.net/go/fvready?t={$free_video_token}. Checked in the app (src/app/go/[placement]/route.ts): that link logs the click on the lead and opens the AI Media Machine sales page, https://ai.bluefx.net/lifetime/?vtid=fvready_<first 8 characters of the lead's id>, with the lead's ClickBank hop saved when they asked for the free video ad (hopId and vq). So ClickBank credits the lead's affiliate, and the app pairs a purchase with the lead even when the buyer pays with another email (the buyer then joins CB Funnel - Bought AIMM). The app sets {$free_video_token} for every CB lead when they join CB Funnel - Ready. Two limits: a lead who came without an affiliate gets the sales page without a hop, and a lead whose browser never got ClickBank's hop at opt-in (for example an ad blocker stopped ClickBank's script) gives the affiliate no credit through this link. (The $49 funnel's versions linked ai.bluefx.net/lifetime with affiliate=bluefx01, which the CB funnel can't use.) Email 5.2's tutorial line is still open: decision 11.
2. **"{$name}, your $49 price ends today" is dropped from the follow-up.** Its whole body was the deadline: "Quick reminder: your $49 price for the video ad for {$free_video_site} ends today. After that it's $99." Without the deadline nothing new is left, and an email that adds nothing new is the bump you don't want. Its delays are merged, so every other email keeps its day (day 0, day 0, day 1, day 2, day 5). A day-3 email there would need new copy.
3. **Website emails left out (optional).** Follow-up step 4 "{$name}, 3 mistakes I see on most websites", non-buyers day 15 "{$name}, I ran {$free_video_site} through my new AI tool" and day 18 "{$name}..." ("Are you still trying to get more customers from your website?"). They sell the website service, which ClickBank doesn't process, and the two links go to bluefx.net pages outside the affiliate's funnel. Details: [Left out](#left-out-the-website-emails-optional). Add them only if you want the website offer in front of affiliate leads.
4. **YouTube links removed.** The "4 lines of text" emails linked youtu.be/PSfn9Au02JY, a page outside the affiliate's funnel (a BlueFX link under the video would credit bluefx01). Buyers now get "Watch The Tutorial on your page: {$free_video_url}": after the $49, their page shows the AI Media Machine page with the same tutorial ("Watch me use the AI Media Machine on my own screen", chapter "A video ad from a few lines"). The tutorial sits below the clean video, so buyers have to scroll; {$free_video_url}#walkthrough might jump straight to it (not tested). The non-buyer version (email 5.2) can't show it yet: decision 11.
5. **No video email: the retry link can't carry the affiliate (Automation 6).** That lead has no page, and MailerLite has no field with the affiliate's nickname, so the link is the plain https://app.bluefx.net/your-video-ad. On the same browser, ClickBank's cookie from the affiliate's HopLink usually still credits the affiliate, but your report files the new lead under "No affiliate"; on another device the affiliate loses the lead. Fix (app change): when the lead joins CB Funnel - No video, also save the nickname in a new field (for example free_video_affiliate) and link https://app.bluefx.net/your-video-ad?affiliate={$free_video_affiliate}. When someone replies with a link: make that video ad by hand through `/your-video-ad?affiliate=<nick>` (the admin leads list shows the nick). The email-reply route (/api/free-video/inbound) would file it in the AI Media Machine funnel.
6. **Changed only because of your style notes (say no and the original words come back):** same-day email: "software" to "app", and "It's" / "it" to "the AI Media Machine"; the two cost emails (Automation 4 day 6, Automation 5 day 12): added "There are no monthly fees."; follow-up email 1: the P.S. I had to rewrite says "your video ad" instead of "it".
7. **Approved sentences kept word for word**, although a later note would word them differently: "Where can I make it better?" (help me out on this?) and "Quick question:" (same-day email). Say if you want those changed too.
8. **People who already own the AI Media Machine.** As asked, Automations 3, 4 and 5 skip "AI Medi Machine" and CB Funnel - Bought AIMM, and not CB Clients (ClickBank may put CB $49 buyers there, and then nobody would get these emails). The $49 originals also skipped FS Clients: add it if it holds only FastSpring buyers of the AI Media Machine. Another net: stop when the field free_video_customer is "yes" (the app sets it for leads who already own the AI Media Machine, and their page hides the AI Media Machine offer anyway).
9. **Guarantee: 30 or 60 days?** The AI Media Machine emails keep "30-day money-back guarantee" (what the AI Media Machine page says). The CB $49 page says "60-day money-back guarantee through ClickBank", which matches ClickBank's own 60-day refund window.
10. **Optional ClickBank line in the clean video email (not added):** "Your order is processed by ClickBank. It shows on your statement as CLKBANK*AIVideoAd." Same words as the paid strip on the page; it can save a "what is this charge?" refund.
11. **Email 5.2's tutorial line (open).** "Watch The Tutorial on your page: {$free_video_url}" is unchanged, but a non-buyer's page shows only the $49 offer: the tutorial is on that page only after the $49, and I could not confirm that the sales page has it. The P.S. link of 5.2 already goes to the sales page (decision 1). Pick one: (a) drop the tutorial line, (b) change it to "See The AI Media Machine Here: https://app.bluefx.net/go/fvready?t={$free_video_token}", (c) link the YouTube tutorial again (it leaves the affiliate's funnel, see decision 4).

## Overview

| # | New automation | Built from (id) | Trigger: joins group | Exclusions / condition | Emails |
|---|---|---|---|---|---|
| 1 | CB Funnel: Follow-up | Free Video Ad $49: Follow-up (202501033877833245) | CB Funnel - Ready (204061357236029079) | Exclude CB Funnel - Paid $49 (204061358258390128), CB Funnel - Unlocked (204061359500952970), CB Funnel - Bought AIMM (204061360723592767) | 5: day 0, day 0 + 15 min, day 1, day 2, day 5 |
| 2 | CB Funnel: Your clean video | Free Video - Unlocked (200681123969238195) | CB Funnel - Unlocked (204061359500952970) | None | 1: right away |
| 3 | CB Funnel: AI Media Machine same day | Free Video Ad $49: AI Media Machine same day (202555423253858270) | CB Funnel - Unlocked (204061359500952970) | After 3 hours, condition: in AI Medi Machine (160003370590930918) or CB Funnel - Bought AIMM (204061360723592767) = stop | 1: 3 hours |
| 4 | CB Funnel: $49 buyers, AI Media Machine (days 2-6) | $49 buyers: AI Media Machine (days 2-6) (202871410553521351) | CB Funnel - Unlocked (204061359500952970) | Exclude AI Medi Machine (160003370590930918), CB Funnel - Bought AIMM (204061360723592767) | 3: day 2, 4, 6 |
| 5 | CB Funnel: Non-buyers | Free video non-buyers ($49 funnel): AI MM + website (days 8-18) (202878606641202743), AI Media Machine emails only | CB Funnel - Ready (204061357236029079) | Exclude CB Funnel - Paid $49 (204061358258390128), CB Funnel - Bought AIMM (204061360723592767), AI Medi Machine (160003370590930918) | 3: day 8, 10, 12 |
| 6 | CB Funnel: No video | Free Video - No video rescue (auto) (202866400601048301) | CB Funnel - No video (204061361743857319) | Exclude CB Funnel - Leads (204061356175918577) | 1: 15 minutes |

- CB Funnel - Leads (204061356175918577) starts nothing. It is only the exclusion of Automation 6, the same way the original rescue excludes "Free Video - Leads".
- CB Funnel - Paid $49 (204061358258390128) starts nothing. It stops Automations 1 and 5 the moment someone pays. CB Funnel - Unlocked also stops Automation 1, as a second net (a buyer the app unlocked without the Paid group, for example by hand).

## Same in every email

- **Links:** only {$free_video_url} and {$free_video_clean_url}, plus https://app.bluefx.net/go/fvready?t={$free_video_token} for the AI Media Machine in the non-buyer emails (decision 1). Gone: every ai.bluefx.net/lifetime/?affiliate=bluefx01 link, the YouTube links and the bluefx.net website pages. One exception, as asked: the No video email links https://app.bluefx.net/your-video-ad, because that lead has no page.
- **Price:** always $49. Gone: "$49 instead of $99", "Regular price $99", "for 3 days", "ends today", "After that it's $99".
- **FastSpring:** none of the originals names it, so nothing to remove.
- **"gift" and em dashes:** none in the originals, none here.
- **Merge tags** ({$name}, {$free_video_site}, {$free_video_url}, {$free_video_clean_url}) and {$unsubscribe}: kept where the originals have them.
- **Preheader:** none of the originals has one; none added.
- **Sender:** Szilard Gyorfi, support@bluefx.net, reply-to support@bluefx.net (also on the clean video email, which was "Bluefx Video Templates").
- **HTML:** use each original email's HTML as it is and swap only the sentences listed under "Changed".

---

## Automation 1: CB Funnel: Follow-up

- **Built from:** Free Video Ad $49: Follow-up (202501033877833245), 7 emails
- **Trigger:** joins **CB Funnel - Ready** (204061357236029079)
- **Exclude:** **CB Funnel - Paid $49** (204061358258390128), **CB Funnel - Unlocked** (204061359500952970) and **CB Funnel - Bought AIMM** (204061360723592767). Joining any one of them stops the sequence ("exit when no longer matches", below). (The original excluded Free Video - Unlocked and Free Video - Bought.)
- **Settings as the original:** not repeatable, "exit when no longer matches" on.
- **Emails:** 5 (original step 4, the website email, is left out; original step 6, the price deadline, is dropped).
- Email 1 is the only "your video ad is ready" email a CB lead gets.

### 1.1 Your video ad is ready (right away)

- **Delay:** none, sent when the person joins CB Funnel - Ready
- **Subject:** `{$name}, your video ad for {$free_video_site} is ready`
- **Preheader:** none
- **Sender:** Szilard Gyorfi, support@bluefx.net

```text
Hey {$name},

Your video ad for {$free_video_site} is ready. Watch your video ad here:
{$free_video_url}

What do you think? If anything should be different, like your wording, the person on camera or your phone number, tell us right on your page and we change it.

Szilard

P.S. Like your video ad? You can have your video ad without the watermark for $49, right on that page.

--
You received this email because you asked for a free video ad at bluefx.net.
Unsubscribe: {$unsubscribe}
```

**Changed:** removed "P.S. Like it? For the next 3 days you can have it without the watermark for $49 instead of $99, right on that page." and put in "P.S. Like your video ad? You can have your video ad without the watermark for $49, right on that page."

### 1.2 help me out on this? (15 minutes later)

- **Delay:** 15 minutes after 1.1
- **Subject:** `help me out on this?`
- **Preheader:** none
- **Sender:** Szilard Gyorfi, support@bluefx.net

```text
Hey {$name},

You just tested out my new free video ad maker and made a video ad for your website: {$free_video_url}

What do you think? Where can I make it better?

Szilard

--
You received this email because you asked for a free video ad at bluefx.net.
Unsubscribe: {$unsubscribe}
```

**Changed:** nothing, word for word (in the HTML, "video ad" is the link to {$free_video_url}, as in the original).

### 1.3 {$name} (day 1)

- **Delay:** 1 day after 1.2
- **Subject:** `{$name}`
- **Preheader:** none
- **Sender:** Szilard Gyorfi, support@bluefx.net

```text
Hi {$name},

If you could change one thing in your video ad, what would it be?
{$free_video_url}

Szilard

--
You received this email because you asked for a free video ad at bluefx.net.
Unsubscribe: {$unsubscribe}
```

**Changed:** nothing, word for word (in the HTML, "video ad" is the link, as in the original).

> Original step 4, "{$name}, 3 mistakes I see on most websites" (6 hours after 1.3): left out. See [Left out](#left-out-the-website-emails-optional).

### 1.4 Your video ad is still waiting (day 2)

- **Delay:** 1 day after 1.3 (the original's 6 hours + 18 hours around the left-out website email, so the send time stays the same)
- **Subject:** `{$name}, your video ad is still waiting`
- **Preheader:** none
- **Sender:** Szilard Gyorfi, support@bluefx.net

```text
Hey {$name},

Your video ad for {$free_video_site} is still waiting for you, without the watermark and with any changes you want.

The price is $49.

Get your video ad here: {$free_video_url}

Szilard

--
You received this email because you asked for a free video ad at bluefx.net.
Unsubscribe: {$unsubscribe}
```

**Changed:** removed "Regular price $99. Since you made a free video ad with us, it's $49 for 3 days from when you first open your page." and put in "The price is $49."

> Original step 6, "{$name}, your $49 price ends today" (day 3): dropped. Its body was "Quick reminder: your $49 price for the video ad for {$free_video_site} ends today. After that it's $99." plus the link. See decision 2.

### 1.5 {$name} (day 5)

- **Delay:** 3 days after 1.4 (the original's 1 day + 2 days around the dropped price email, so it still goes on day 5)
- **Subject:** `{$name}`
- **Preheader:** none
- **Sender:** Szilard Gyorfi, support@bluefx.net

```text
Hi {$name},

Are you still looking to make video ads for your business?

Szilard

--
You received this email because you asked for a free video ad at bluefx.net.
Unsubscribe: {$unsubscribe}
```

**Changed:** nothing, word for word.

---

## Automation 2: CB Funnel: Your clean video

- **Built from:** Free Video - Unlocked (200681123969238195), 1 email
- **Trigger:** joins **CB Funnel - Unlocked** (204061359500952970)
- **Exclude:** none (as the original)
- This is the only email that gives a CB buyer the clean video ad's download link.

### 2.1 Your clean video ad is ready (right away)

- **Delay:** none, sent when the person joins CB Funnel - Unlocked
- **Subject:** `{$name}, your clean video ad for {$free_video_site} is ready`
- **Preheader:** none
- **Sender:** Szilard Gyorfi, support@bluefx.net (the original sends as "Bluefx Video Templates")

```text
Hi {$name},

Thanks for your order. The AI Media Machine made the clean version of your video ad for {$free_video_site}, without the watermark and end card.

Download my clean video ad: {$free_video_clean_url}

The clean video ad is on your video ad page too: {$free_video_url}

On an iPhone? Open your video ad page and tap Save to Photos. The video ad then shows up in Photos, ready for Instagram, Facebook and TikTok.

Szilard

You get this email because you asked for a free video ad at bluefx.net. Unsubscribe: {$unsubscribe}
```

**Changed:** the sender name only. The copy is word for word (the optional ClickBank statement line is decision 10).

---

## Automation 3: CB Funnel: AI Media Machine same day

- **Built from:** Free Video Ad $49: AI Media Machine same day (202555423253858270), 1 email
- **Trigger:** joins **CB Funnel - Unlocked** (204061359500952970)
- **Steps:** wait 3 hours, then a condition, matching "any": is in group **AI Medi Machine** (160003370590930918) or is in group **CB Funnel - Bought AIMM** (204061360723592767). Yes = end, no email. No = send 3.1.
- **Original condition:** is in group "CB Clients" (73194664328431586). Not used here, because ClickBank may put CB $49 buyers in CB Clients, and then nobody would get the email.

### 3.1 your next 100 video ads (3 hours after the clean video ad is ready)

- **Delay:** 3 hours after joining, then the condition above
- **Subject:** `{$name}, your next 100 video ads` (the original's internal name still says "your next 10 video ads")
- **Preheader:** none
- **Sender:** Szilard Gyorfi, support@bluefx.net

```text
Hi {$name},

Thanks again for getting your video ad for {$free_video_site}.

Quick question: what if your next 100 video ads cost just $2.97 each?

That's what the AI Media Machine does. The AI Media Machine is the same app my team used to make your video ad. One payment, no monthly fee.

Here's everything the AI Media Machine does:
{$free_video_url}

Szilard

--
You received this email because you bought a video ad at bluefx.net.
Unsubscribe: {$unsubscribe}
```

**Changed:** new plain text written from the HTML (the original's plain text is MailerLite's placeholder "You have received a newsletter from {$account}..."); "It's the same software my team used to make your video ad." became "The AI Media Machine is the same app my team used to make your video ad."; "Here's everything it does:" became "Here's everything the AI Media Machine does:" (both from your style notes, decision 6).

---

## Automation 4: CB Funnel: $49 buyers, AI Media Machine (days 2-6)

- **Built from:** $49 buyers: AI Media Machine (days 2-6) (202871410553521351), 3 emails
- **Trigger:** joins **CB Funnel - Unlocked** (204061359500952970)
- **Exclude:** **AI Medi Machine** (160003370590930918) and **CB Funnel - Bought AIMM** (204061360723592767). Joining either one stops the sequence. (The original also excluded CB Clients, FS Clients and "Past $49 buyers": see decision 8.)
- After the $49, the buyer's own page ({$free_video_url}) shows the clean video ad and, under it, the AI Media Machine page with the affiliate's hop on every button.

### 4.1 your second video ad (day 2)

- **Delay:** 2 days after joining
- **Subject:** `{$name}, your second video ad`
- **Preheader:** none
- **Sender:** Szilard Gyorfi, support@bluefx.net

```text
Hey {$name|default('there')},

One video ad gets your business seen for a few days. Then your customers scroll past.

So the businesses that get customers from Facebook and Instagram post a new video ad every few days.

With the AI Media Machine, you make your next 100 video ads like yours, whenever you need them. You type what you want, and about 3 minutes later your next video ad is ready.

See What The AI Media Machine Makes: {$free_video_url}

Szilard

P.S. Your video ad for {$free_video_site} is yours to keep, whatever you decide.

Unsubscribe: {$unsubscribe}
```

**Changed:** nothing, word for word.

### 4.2 a video ad from 4 lines of text (day 4)

- **Delay:** 2 days after 4.1
- **Subject:** `{$name}, a video ad from 4 lines of text`
- **Preheader:** none
- **Sender:** Szilard Gyorfi, support@bluefx.net

```text
Hey {$name|default('there')},

We made your video ad from {$free_video_site}.

Did you know the AI Media Machine can also make a video ad from a few lines of text and a few images you upload?

In this tutorial I type 4 lines about a bakery, and the AI Media Machine turns those 4 lines into a TV news video ad with a news anchor.

Watch The Tutorial on your page: {$free_video_url}

So every offer, every season and every new product can get its own video ad.

Szilard

P.S. Lifetime access to the AI Media Machine is 94.62% off right now: {$free_video_url}

Unsubscribe: {$unsubscribe}
```

**Changed:** removed "Watch The Tutorial: https://youtu.be/PSfn9Au02JY" and put in "Watch The Tutorial on your page: {$free_video_url}" (the buyer's page plays the same tutorial in the AI Media Machine section; decision 4).

### 4.3 what 100 video ads cost you (day 6)

- **Delay:** 2 days after 4.2
- **Subject:** `{$name}, what 100 video ads cost you`
- **Preheader:** none
- **Sender:** Szilard Gyorfi, support@bluefx.net

```text
Hey {$name|default('there')},

A freelancer charges about $200 for one video ad like yours for {$free_video_site}.

100 video ads from a freelancer would cost about $20,000.

With the AI Media Machine, you pay $297 once and make your next 100 video ads, plus 11 more AI tools. That's $2.97 a video ad.

There are no monthly fees.

Lifetime access is still 94.62% off, with a 30-day money-back guarantee.

Get The AI Media Machine Here: {$free_video_url}

Szilard

Unsubscribe: {$unsubscribe}
```

**Changed:** nothing removed; added "There are no monthly fees." (your "no monthly fees" note, decision 6).

---

## Automation 5: CB Funnel: Non-buyers

A non-buyer's {$free_video_url} opens the $49 offer, which doesn't show the AI Media Machine, so every AI Media Machine link here is https://app.bluefx.net/go/fvready?t={$free_video_token}: the AI Media Machine sales page with the lead's affiliate hop (decision 1). Settle decision 11 (email 5.2's tutorial line) before switching it on.

- **Built from:** Free video non-buyers ($49 funnel): AI MM + website (days 8-18) (202878606641202743): only its 3 AI Media Machine emails (days 8, 10, 12)
- **Trigger:** joins **CB Funnel - Ready** (204061357236029079)
- **Exclude:** **CB Funnel - Paid $49** (204061358258390128), **CB Funnel - Bought AIMM** (204061360723592767) and **AI Medi Machine** (160003370590930918). Joining any of them stops the sequence. (The original also excluded Free Video - Unlocked, Free Video - Bought, website clients, CB Clients and FS Clients.)
- The follow-up (Automation 1) ends on day 5, so these start 3 days after it.

### 5.1 what if you made your next video ad yourself? (day 8)

- **Delay:** 8 days after joining
- **Subject:** `{$name}, what if you made your next video ad yourself?`
- **Preheader:** none
- **Sender:** Szilard Gyorfi, support@bluefx.net

```text
Hey {$name|default('there')},

Your free video ad for {$free_video_site} showed you what a video ad for your business can look like.

Did you know you can make video ads like yours yourself, with the same AI that made your free video ad?

That AI is called the AI Media Machine. You paste your website or type a few lines, and about 3 minutes later your video ad is ready. With the AI Media Machine, you make your next 100 video ads, whenever you need them.

See The AI Media Machine Here: https://app.bluefx.net/go/fvready?t={$free_video_token}

Szilard

P.S. Lifetime access is 94.62% off right now.

Unsubscribe: {$unsubscribe}
```

**Changed:** the link "https://ai.bluefx.net/lifetime/?affiliate=bluefx01&tid=fv49nb1" became https://app.bluefx.net/go/fvready?t={$free_video_token} (HTML link text stays "See The AI Media Machine Here >>").

### 5.2 a video ad from 4 lines of text (day 10)

- **Delay:** 2 days after 5.1
- **Subject:** `{$name}, a video ad from 4 lines of text`
- **Preheader:** none
- **Sender:** Szilard Gyorfi, support@bluefx.net

```text
Hey {$name|default('there')},

Did you know the AI Media Machine can also make a video ad from a few lines of text and a few images you upload?

In this tutorial I type 4 lines about a bakery, and the AI Media Machine turns those 4 lines into a TV news video ad with a news anchor.

Watch The Tutorial on your page: {$free_video_url}

So every offer, every season and every new product can get its own video ad.

Szilard

P.S. Lifetime access to the AI Media Machine is 94.62% off right now: https://app.bluefx.net/go/fvready?t={$free_video_token}

Unsubscribe: {$unsubscribe}
```

**Changed:** removed "Watch The Tutorial: https://youtu.be/PSfn9Au02JY" and put in "Watch The Tutorial on your page: {$free_video_url}"; the P.S. link "https://ai.bluefx.net/lifetime/?affiliate=bluefx01&tid=fv49nb2" became https://app.bluefx.net/go/fvready?t={$free_video_token} (HTML link text stays "Get The AI Media Machine Here >>"). The tutorial line is not true for a non-buyer yet: decision 11.

### 5.3 what 100 video ads cost you (day 12)

- **Delay:** 2 days after 5.2
- **Subject:** `{$name}, what 100 video ads cost you`
- **Preheader:** none
- **Sender:** Szilard Gyorfi, support@bluefx.net

```text
Hey {$name|default('there')},

A freelancer charges about $200 for one video ad like yours for {$free_video_site}.

100 video ads from a freelancer would cost about $20,000.

With the AI Media Machine, you pay $297 once and make your next 100 video ads, plus 11 more AI tools. That's $2.97 a video ad.

There are no monthly fees.

Lifetime access is still 94.62% off, with a 30-day money-back guarantee.

Get The AI Media Machine Here: https://app.bluefx.net/go/fvready?t={$free_video_token}

Szilard

Unsubscribe: {$unsubscribe}
```

**Changed:** the link "https://ai.bluefx.net/lifetime/?affiliate=bluefx01&tid=fv49nb3" became https://app.bluefx.net/go/fvready?t={$free_video_token} (HTML link text stays "Get The AI Media Machine Here >>"); added "There are no monthly fees." (decision 6).

> Original days 15 and 18 (the website report and "Are you still trying to get more customers from your website?"): left out. See [Left out](#left-out-the-website-emails-optional).

---

## Automation 6: CB Funnel: No video

- **Built from:** Free Video - No video rescue (auto) (202866400601048301), 1 email
- **Trigger:** joins **CB Funnel - No video** (204061361743857319)
- **Exclude:** **CB Funnel - Leads** (204061356175918577), like the original excludes "Free Video - Leads": someone who tries again with a page that works within the 15 minutes doesn't get this email.
- That lead has no page, and MailerLite only gets {$free_video_site} for it, so {$free_video_url} can't be used here.

### 6.1 your video ad didn't come through (15 minutes)

- **Delay:** 15 minutes after joining
- **Subject:** `{$name|default('Hi')}, your video ad didn't come through`
- **Preheader:** none
- **Sender:** Szilard Gyorfi, support@bluefx.net

```text
Hi {$name|default('there')},

You asked for a free video ad, but the AI Media Machine couldn't open the link you sent, so your video ad never got made. Sorry about that.

You can try again with another page of your website here:
https://app.bluefx.net/your-video-ad

Szilard

P.S. Or reply with a link to your website, and we'll make your free video ad.

You received this email because you asked for a free video ad at bluefx.net.
Unsubscribe: {$unsubscribe}
```

**Changed:** removed "You don't need a website for a video ad, though.", "In this tutorial I type 4 lines about a bakery, and the AI Media Machine turns those 4 lines into a TV news video ad with a news anchor. Watch from 11:27: https://youtu.be/PSfn9Au02JY?t=687", "Want to make a video ad like that for your business? The AI Media Machine is 94% off right now: https://ai.bluefx.net/lifetime/?affiliate=bluefx01&tid=emrescueauto" and the P.S. "Got a website after all? Reply with the link, and we'll make your free video ad."; put in the try-again line with https://app.bluefx.net/your-video-ad and the P.S. "Or reply with a link to your website, and we'll make your free video ad."

**Limitation:** MailerLite has no field with the affiliate's nickname, so the link can't be `https://app.bluefx.net/your-video-ad?affiliate=<nick>`. A retry from this link is filed under "No affiliate" in your report, and on another device the affiliate loses the lead. Fix and reply handling: decision 5.

---

## Left out: the website emails (optional)

| From | Original timing | Subject | Link | Why left out |
|---|---|---|---|---|
| Follow-up, step 4 | 6 hours after "{$name}" (day 1) | {$name}, 3 mistakes I see on most websites | https://bluefx.net/website-mistakes/?v={$free_video_token}&src=fv-email | Sells the free homepage redesign and the website service, which ClickBank doesn't process; the link leaves the affiliate's funnel |
| Non-buyers, day 15 | 3 days after day 12 | {$name}, I ran {$free_video_site} through my new AI tool | https://bluefx.net/your-website-check/?v={$free_video_token} | Website report page for the website service; the link leaves the affiliate's funnel |
| Non-buyers, day 18 | 3 days after day 15 | {$name}... | no link ("Are you still trying to get more customers from your website?") | Reply ask for the website service |

None of the 3 mentions the $49 price, so if you want them, they can go in word for word at the same place in the sequence (the follow-up would then get its original 6-hour and 18-hour delays back around step 4). The two links would still leave the affiliate's funnel.

## Build notes

- Build each automation as a new one, switched off. The 6 originals stay untouched.
- Switch on Automation 1 (the only "your video ad is ready" email) and Automation 2 (the only clean video email) before any affiliate traffic. Automation 5 waits for decision 11.
- Sender: new steps come in as "Bluefx Video Templates". The API can't change the sender name, so set "Szilard Gyorfi" in the dashboard editor on every email.
- HTML: copy each original email's HTML and change only the sentences under "Changed", so the layout and the gap above the unsubscribe line stay as they are. In the plain text, keep the blank lines above "--" where the original has them.
- Plain text: MailerLite caps it at 1,000 characters. Every body here is under that.
- Delays are counted from the step before, as listed under each email.
- The CB groups are empty today, so MailerLite's "include existing subscribers?" question on switching on changes nothing.
- After building: a dry run per automation, then a test send to the owner's inbox.
