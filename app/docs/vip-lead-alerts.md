# VIP lead alerts

Owner, 2026-11-06: "the real change is VIP treatment". Every now and then a whale comes in: a business with the means and the need for the premium services (websites at $300 to $3,000/mo). Szilard wants to spot them instantly and take over personally. Everyone else keeps getting the automatic funnel unchanged.

## What to build (app session)
1. **Score every new free-video lead.** Right after the pipeline reads the lead's website to make their video, run one LLM call on the site text plus the lead's fields, and get back:
   - `vip_score` (0 to 10)
   - `vip` (true when the score is 7 or more and both must-haves pass)
   - `vip_industry`
   - `vip_reasons` (one short line)

   Store these on the lead.
2. **Mark VIPs in MailerLite.** Set the field `vip` = yes and add the lead to a new group "VIP leads".
3. **Send a VIP alert email** to contact@bluefx.net and support@bluefx.net:
   - Subject: `VIP lead: {Business} ({industry}, {city or "since YYYY"})`
   - Body:
     - their website
     - their video page (internal view)
     - why they're VIP
     - name, email and phone if found
     - the lead source / ref tag
     - a link to their website demo page once it exists
4. **Prefix the existing alerts.** If the lead is VIP, every existing alert about them also starts with `VIP lead: `:
   - watched their website video
   - clicked Let's talk
   - $49 or $297 purchase
   - replies, if the app sees them

   For example: `VIP lead: Patrick clicked Let's talk`.
5. **Put VIP leads first in the daily website demo run,** at the best quality.
6. **Change nothing for the lead.** Same emails, same offers, and no automatic replies to them.
7. **Fail safe.** If scoring fails, send no alert and log the error. The funnel must never break because of this.
8. **Backfill.** Mark the existing VIP leads listed in app/docs/vip-leads.md the same way: the MailerLite field and the group.

## Scoring rules
**Must have (otherwise never VIP):**
- The business's own domain. Not a Gmail-type address used as the site, and not a Wix/Weebly/Squarespace subdomain, Linktree, Facebook page, Thinkific, Kajabi, Etsy or similar.
- A real operating business. Not a coach, author, course seller, nonprofit, church, personal brand, MLM/affiliate site or hobby.

**Strong signals:**
- **One customer is worth a lot:** B2B, manufacturing or equipment, big-ticket trades (pools, roofing, foundations, windows and doors, HVAC, solar, remodeling, construction), clinics (laser, dental, med spa, medical), law, financial or insurance firms with real offices, dealers, commercial services.
- **Established:** a "since" year, several locations, a team page, many services or products, a real address and phone.
- **Already spends on marketing:** active ads, many reviews, a professional site.
- **An outdated website** is a plus, because there's room to help.

**Hot behavior (adds points; a VIP with any of these is urgent):**
- bought the $49 or the $297
- clicked "Let's talk"
- replied
- watched the website video
- 3 or more email clicks

## Gmail
Both inboxes get a filter, `Subject: "VIP lead"`, set to:
- apply the label "VIP lead" (red; already created in support@)
- star it
- always mark it important
- never send it to spam

Phone notifications are set to high priority only, or to the "VIP lead" label on Android.

## VIP playbook (Szilard, by hand)
1. Check the video they got.
2. Remove the stamp and give them the clean video free.
3. Upgrade it in whatever way they need.
4. Make their website demo first, at the best quality.
5. Write to them personally, and call back instantly when they respond.
6. Build trust first and sell second.
