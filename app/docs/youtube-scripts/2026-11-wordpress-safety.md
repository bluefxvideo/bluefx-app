# Is Your WordPress Site Safe? (script)

Written 2026-11-02. Evergreen version of the Oct 22 PHP2Shell script that is on the Mac (Dropbox, News Videos folder). The October news is the opening example, so the video still works in a few months.

Goal: a useful 2-minute check for any WordPress owner, then the website service.

Marks: **[A]** good camera, **[B]** face box on the right with a graphic, **[S]** screen recording.

## Titles (pick one)

1. Is Your WordPress Site Safe? How to Check in 2 Minutes
2. How to Check if Your Website Is Hacked (WordPress, 2 Minutes)
3. Your Old WordPress Site Might Be at Risk. Here's How to Check

Main search phrase: "how to check if my website is hacked". In the description and tags: "wordpress website hacked how to fix", "php2shell", "wordpress security", "is my website safe".

## Before you record

- Fill in your own malware story (the yellow part in section 2). One real detail is enough: how long the site was down, or what it cost.
- Pick the link for the end: the website service page, or "comment your website". The script below has both.
- Have a hosting dashboard ready to show where the PHP version is (cPanel "Select PHP Version" or "MultiPHP Manager", or your host's own panel). Use your own site or a test site, never a stranger's.
- Check the fixed PHP version numbers once more on php.net on the day you record.

## The script

### 1. Hook [A], 0:00 to 0:25

"If someone built your website a few years ago and nobody has really logged into it since, give me two minutes. In October two big security problems hit WordPress sites within a few days of each other, and a lot of owners still don't know if they were affected. I'll show you how to check your own site, and what to do if it's on an old version."

### 2. Why I care [A], 0:25 to 0:45

"I've been building sites on WordPress for about sixteen years, and **[YOUR STORY: the time malware hit a site in the middle of a campaign. How long it was down, or what it cost you or the client.]** So I take this stuff pretty seriously."

### 3. What happened [B], 0:45 to 1:50

Graphic: one stack that stays on screen and changes as you talk. Website on top, then WordPress, then PHP, then the server. Light up the layer you're talking about.

"Most WordPress sites run on something called PHP. You can think of it as the engine under the hood.

On October 20th a hole was announced in PHP itself. It's called PHP2Shell, and it can let someone take over the server your site runs on without a password. It had been sitting there for more than ten years, and researchers found it with the help of AI.

A couple of days before that, attackers got hold of connection keys from the company behind UpdraftPlus, a popular WordPress backup plugin. They used those keys to slip hidden plugins onto sites that were connected to their UpdraftCentral service.

In both cases the owner didn't have to click anything or do anything wrong."

### 4. Who should worry [B], 1:50 to 2:30

Graphic: Shopify, Wix and Squarespace logos with a green tick. An old WordPress site with cobwebs.

"If your site is on Shopify, Wix or Squarespace, the platform patches this kind of thing for you, so you can relax a bit.

The sites I'd worry about are small business WordPress sites that a freelancer or an agency set up years ago, where nobody updates the plugins or the server anymore. That's a lot of the sites people send me."

### 5. Check your site [S], 2:30 to 4:30

You don't need a full script here. Show these steps and say them in your own words.

1. Log in to your hosting account and find the PHP version. In cPanel it's under "Select PHP Version" or "MultiPHP Manager". Circle it on screen.
2. Read the number out loud: "If it starts with 8.1 or lower, it needs an upgrade. The fixed versions are 8.2.35, 8.3.36, 8.4.27 and 8.5.12, or anything newer on the same line." Show these numbers as a graphic too.
3. If you can't find it, show the prompt from the description pasted into ChatGPT, Claude or Gemini (it uses OpenAI's free checker). Say: "If it comes back 'unknown', that doesn't mean you're safe. It means you need to ask your host."
4. Open the Plugins page in WordPress. Say: "If you ever connected your site to UpdraftCentral, read their security notice and ask your host or developer to scan the site. Some of those hidden plugins don't show up in this list."
5. Show the copy-and-paste message from the description. "Just send them this. Any decent host will answer within a day."

### 6. The bigger problem [A], 4:30 to 5:20

"Fixing the PHP version takes about ten minutes. What worries me more is that these won't be the last ones, because AI is now finding old holes faster than anyone can patch them. And a lot of small business sites have nobody looking after them at all.

That's what my team does for our website clients. We rebuild the site as clean, fast pages with no PHP and no plugins on the server, so a hole like PHP2Shell has nothing to get into, and there's no plugin list to hide anything in. When you want something changed, you send us a text or an email. And because the pages are clean, ChatGPT and Google can read them easily, which matters more and more now that people ask AI who to call."

### 7. CTA [A], 5:20 to 5:45

"Two things before you go. If you know a business owner with an old WordPress site, send them this video. It might save them a really bad week.

And if you'd like us to look at yours, the link to our website service is in the description. Or comment your website below and I'll tell you what I'd fix first."

(If you won't have time to answer comments, drop the last sentence.)

## Description

> Is your WordPress site safe? In October 2026 two security problems hit WordPress sites a few days apart: PHP2Shell, a hole in PHP itself (CVE-2026-109618 and CVE-2026-109619), and hidden plugins pushed through stolen UpdraftCentral keys. Here's how to check your own site in about two minutes, and what to do if it's on an old version.
>
> Want us to rebuild and look after your website? [WEBSITE SERVICE LINK]
>
> CHECK YOUR PHP VERSION
> Fixed versions: 8.2.35, 8.3.36, 8.4.27, 8.5.12 or newer on the same line. If yours starts with 8.1 or lower, upgrade or ask your host.
>
> PROMPT FOR CHATGPT, CLAUDE OR GEMINI (it needs to be able to run code)
> Use OpenAI's free PHP2Shell checker at https://github.com/openai/php2shell-checker to check my website, https://yourwebsite.com. Run the website check against my site only and tell me in plain English what it found. If the result is unknown, explain what that means and write a short message I can send my hosting company.
>
> MESSAGE TO SEND YOUR HOST
> Hi, could you tell me which PHP version my site [yourwebsite.com] runs on, and confirm it's patched for PHP2Shell (CVE-2026-109618 and CVE-2026-109619)? If it's on 8.1 or lower, please let me know how we can upgrade. Thanks!
>
> 0:00 Is your site at risk?
> 0:45 What happened in October
> 1:50 Who should worry
> 2:30 Check your site in 2 minutes
> 4:30 The bigger problem
>
> Make a free video ad from your website: https://app.bluefx.net/free-video-ad?ref=yt-[VIDEOID]

## Broadcast email

**Subject:** is your website on the old version?

Hi {name},

In October two security problems hit WordPress sites a few days apart. One was a hole in PHP, the code most WordPress sites run on, and the other came through a popular backup plugin. A lot of owners never heard about either.

I made a short video showing how to check your own site in about two minutes. You log in to your hosting, find the PHP version, and if it starts with 8.1 or lower you ask your host to upgrade it. I put a message you can copy and send them in the description.

[Watch the video]

If your site was built years ago and nobody really looks after it anymore, just reply and tell me. That's what my team handles, and I'm happy to take a look.

Szilard

## Sources (check before recording)

- Mark Kashef's video and OpenAI checker link: https://www.youtube.com/watch?v=P16KluuQPtM
- Fact sheet from the Oct 22 Mac session (BBC, Reuters, Help Net Security), in the Dropbox News Videos folder
- UpdraftCentral key theft, Oct 18 to 19: TeamUpdraft's notice and Patchstack's write-up
- WordPress plugin hijacking coverage: https://www.techradar.com/pro/security/wordpress-websites-under-attack-expert-report-says-dozens-of-plugins-hijacked-to-target-thousands-of-sites
