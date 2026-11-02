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

## The script (v2: modeled on real winners, in Szilard's voice)

Built from three videos that worked:
- Your recipe video (17.5k views): open on something real, ask "what if", then do it live on screen and react as you go.
- Mark Kashef's PHP2Shell video (6.4k in 10 days): "if you have a website, you should know about this", plain English, a 2-minute check, "send this to someone".
- WPTuts' "Are WordPress Plugins Becoming a Liability?" (13.8k): a personal routine and an honest opinion, ending with "a normal business site doesn't need WordPress anymore, go static". That last point is your offer.

The middle is live: you check a real site on screen while you talk. Use one of YOUR OWN old WordPress sites (or a client's, with their OK). Never a stranger's site.

Lines in quotes are a guide. Say them your way.

### 1. Cold open (screen, then face), 0:00

On screen: the BBC headline about governments taking sites offline.

"So, a couple of weeks ago, governments in Finland, the Netherlands, France and Germany took some of their own websites offline, because of one bug. And that same bug is sitting on a lot of small business websites right now. If you have an older WordPress site, maybe yours too.

So let's check one. I'm going to take an old WordPress site of mine, and in about two minutes I'll show you if it's at risk and what to do about it."

### 2. Why you care (face), 0:25

"I've been doing WordPress sites for about sixteen years, and [YOUR STORY: the time malware hit a site in the middle of a campaign, how long it was down or what it cost]. So when I saw this news, the first thing I did was go and check my own sites."

### 3. The live check (screen), 0:45

"Okay, so this is the hosting dashboard. I'm going to go to PHP version. Let's see. [read the number out loud and react to it]

Anything that starts with 8.1 or lower, that's the problem. The fixed versions are 8.2.35, 8.3.36, 8.4.27 and 8.5.12, or newer.

Now, what is PHP? Very simple. Your website is WordPress, and WordPress runs on PHP. It's like the engine under the hood. The bug is in the engine, so all those security plugins you installed in WordPress don't even get a chance to stop it."

If you can't find the version, or to show the easy way:

"There's an easier way if you can't find this. OpenAI released a free checker, and I put a prompt in the description. You paste it into ChatGPT or Claude with your website and it tells you. Let's do that. [run it] If it says 'unknown', don't relax. Unknown means you ask your host."

Then the second hack, on the WordPress Plugins page:

"And while we're here, one more thing. The same week there was another hack, through a backup plugin called UpdraftPlus. Attackers used stolen keys to put hidden plugins on people's sites. So if you ever connected your site to UpdraftCentral, go read their notice and have someone scan the site, because those plugins don't even show up in this list."

### 4. The fix (screen), 3:00

"So what do you do if your site is on an old version? The easiest thing is you send your host this message. It's in the description, just copy it. A lot of hosts let you change it yourself right in this menu. Just make a backup first, because an old site can break on a new PHP version."

### 5. What I really think (face), 3:40

"Now, what worries me more is this. Updating PHP fixes this one bug. But there's going to be another one next month, and another one after that, because AI is now finding these old holes faster than anybody can patch them. And most small business websites have nobody looking after them. The freelancer built it five years ago and that was it.

For a normal business website, a few pages with your services, your phone number and a contact form, you don't really need WordPress anymore. So what we do for our clients is rebuild the site as simple, fast pages. There's no PHP on the server and no plugins, so this kind of bug has nothing to get into. When you want to change something, you send us a text or an email and we do it.

The other thing I like about it is that these clean pages are really easy for ChatGPT and Google to read. That matters a lot now, because people are starting to ask ChatGPT who they should call."

### 6. CTA (face), 4:40

"So, if you know somebody with an old WordPress site, send them this video. Honestly, it might save them a really bad week.

And if you want us to take a look at your site, the link is in the description. Or just comment your website below and I'll tell you what I would do with it. Thank you for watching and I'll see you in the next one. Bye-bye."

### Check before recording

- The four countries and the "security plugins can't stop it" point come from the Oct 22 fact sheet on your Mac (BBC, Reuters, Help Net Security). Make sure they're in it.
- PHP version numbers: check php.net on the day.
- Section 5 has to match how your website service really works.

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
