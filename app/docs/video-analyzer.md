# Video Analyzer – Operations & Technical Notes

## Overview

The Video Analyzer tool lets users analyze videos via:
- **File upload** (up to 100 MB, up to 3 min)
- **YouTube URL** – analyzed natively by Gemini
- **Social URLs** – TikTok, Instagram, Facebook (downloaded via Apify, then sent to Gemini)

Credits: 3/min for uploads (min 3), 6 flat for YouTube/social.

Key files:
- `src/actions/tools/video-analyzer.ts` – main server actions (analyzeVideo, analyzeYouTubeVideo, analyzeSocialMediaVideo)
- `src/actions/tools/social-video-downloader.ts` – Apify-based video downloader
- `src/lib/social-video-utils.ts` – platform detection
- `src/components/video-analyzer/video-analyzer-page.tsx` – UI

---

## Apify Actors Used

| Platform | Actor | Cost |
|---|---|---|
| Facebook (regular) | `PBJEdJdctLHQaqdfe` (igview-owner/facebook-media-downloader) | ~$0.005/video |
| Facebook (Ads Library) | `apify/facebook-ads-scraper` | pay-per-use |
| Instagram | `EYxjTNaAMlqUePwza` (igview-owner/instagram-video-downloader) | ~$0.005/video |
| TikTok | `Uyv5cLfgesW6cROPV` (wilcode/fast-tiktok-downloader-without-watermark) | ~$0.005/request |

---

## Facebook Ads Library URLs

**Problem (Feb 2026):** The standard facebook-media-downloader actor (`PBJEdJdctLHQaqdfe`) was updated with strict URL validation. It now only accepts:
```
https://www.facebook.com/watch?v=<digits>
https://www.facebook.com/reel/<digits>
https://www.facebook.com/photo.php?fbid=<digits>
```

Ads Library URLs (`https://www.facebook.com/ads/library/?id=XXXXX`) are **rejected at input validation**.

**Solution:** `extractFacebookAdsLibraryVideo()` in `social-video-downloader.ts` handles these URLs with a two-step approach:

1. **HTML scrape** – tries to extract video URL directly from page HTML (fast, free). Usually blocked by Facebook's bot challenge (returns 481-byte JS challenge page), so this rarely succeeds.

2. **`apify/facebook-ads-scraper`** – the official Apify actor accepts Ads Library URLs and uses the Facebook Graph API internally. Returns video URLs in **`snapshot.cards[].videoHdUrl`** (camelCase). Note: `snapshot.videos` is empty for this ad type — the video is in `cards`.

**Output structure from `apify/facebook-ads-scraper`:**
```json
{
  "snapshot": {
    "pageName": "Brand Name",
    "cards": [
      {
        "videoHdUrl": "https://video-*.xx.fbcdn.net/...",
        "videoSdUrl": "https://video-*.xx.fbcdn.net/...",
        "videoPreviewImageUrl": "https://scontent-*.xx.fbcdn.net/..."
      }
    ],
    "videos": []
  }
}
```

**Important:** This ad had multiple cards (carousel), each with a different video variant. We use `cards[0]` (first card = first video in the carousel).

---

## TikTok Creative Center URLs

Handled separately in `downloadSocialVideo()` — fetches the page HTML and extracts CDN video URLs matching `v16m*.tiktokcdn.com` pattern. Does not use Apify.

---

## Gemini Model

Uses `gemini-2.5-flash` for all analysis types. Social/YouTube videos are sent as inline base64 data (not file URIs), since Gemini only supports arbitrary URIs for YouTube natively.
