# fal.ai Integration Guide

## Overview

fal.ai is used for AI model inference with queue-based async processing. This guide covers how to properly integrate fal.ai models with webhooks.

## Environment Variables

```env
FAL_KEY=your_fal_api_key
NEXT_PUBLIC_SITE_URL=https://app.bluefx.net
```

## Queue API Architecture

fal.ai uses a queue system for async processing:

1. **Submit request** → Returns `request_id`
2. **fal.ai processes** → Takes 1-5 minutes
3. **Webhook callback** → fal.ai POSTs result to your webhook

## Critical: Webhook URL Must Be Query Parameter

**WRONG** - Webhook in request body (gets ignored):
```typescript
const response = await fetch('https://queue.fal.run/fal-ai/model', {
  body: JSON.stringify({
    prompt: '...',
    webhook_url: webhookUrl  // IGNORED!
  })
});
```

**CORRECT** - Webhook as query parameter:
```typescript
const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/fal-ai`;
const queueUrl = `https://queue.fal.run/fal-ai/model?fal_webhook=${encodeURIComponent(webhookUrl)}`;

const response = await fetch(queueUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Key ${process.env.FAL_KEY}`,
  },
  body: JSON.stringify({
    prompt: '...',
    // NO webhook_url here
  }),
});
```

## API URL Structure

### Submit to Queue
```
POST https://queue.fal.run/{model-id}?fal_webhook={url}
```

### Check Status (for polling/dev)
```
GET https://queue.fal.run/{model-id}/requests/{request_id}/status
```

### Get Result (for polling/dev)
```
GET https://queue.fal.run/{model-id}/requests/{request_id}
```

**Note:** Status and result endpoints require the full model path, not just `/requests/{id}`.

## Webhook Handler

Create at `/api/webhooks/fal-ai/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const payload = await request.json();

  // fal.ai webhook payload structure
  const { request_id, status, payload: resultPayload, error } = payload;

  if (status === 'OK' && resultPayload) {
    // Success - process the result
    console.log('Result:', resultPayload);
  } else if (status === 'ERROR' || error) {
    // Failure
    console.error('Failed:', error);
  }

  return NextResponse.json({ success: true });
}
```

## Webhook Headers for Verification

fal.ai sends these headers:
- `X-Fal-Webhook-Request-Id` - The request ID
- `X-Fal-Webhook-User-Id` - Your user ID
- `X-Fal-Webhook-Timestamp` - Unix timestamp
- `X-Fal-Webhook-Signature` - HMAC signature (optional verification)

## Polling (Development Only)

Webhooks can't reach localhost. Use polling for local dev:

```typescript
const isLocalDev = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

if (isLocalDev) {
  // Poll for status
  const status = await fetch(
    `https://queue.fal.run/fal-ai/model/requests/${requestId}/status`,
    { headers: { 'Authorization': `Key ${FAL_KEY}` } }
  );
}
```

## Real-Time UI Updates

After webhook processes:

```typescript
// In webhook handler - broadcast to user
await supabase.channel(`user_${userId}_updates`).send({
  type: 'broadcast',
  event: 'webhook_update',
  payload: {
    tool_type: 'your-tool',
    prediction_id: request_id,
    status: 'succeeded',
    results: { success: true, url: resultUrl }
  }
});

// In client hook - listen for updates
useEffect(() => {
  const subscription = supabase
    .channel(`user_${userId}_updates`)
    .on('broadcast', { event: 'webhook_update' }, (payload) => {
      handleWebhookUpdate(payload.payload);
    })
    .subscribe();

  return () => subscription.unsubscribe();
}, [userId]);
```

## Common Issues

### 1. Webhook URL undefined
**Error:** `Invalid webhook URL: undefined/api/webhooks/fal-ai`
**Fix:** Use `NEXT_PUBLIC_SITE_URL` (not `NEXT_PUBLIC_APP_URL`)

### 2. 405 Method Not Allowed on status check
**Error:** `fal.ai status error: 405`
**Fix:** Include full model path in URL:
```
WRONG: https://queue.fal.run/requests/{id}/status
RIGHT: https://queue.fal.run/fal-ai/model/requests/{id}/status
```

### 3. Webhook in body ignored
**Error:** Webhook never called
**Fix:** Pass as query parameter `?fal_webhook=...`

## Example: MiniMax Music v2

```typescript
// File: src/actions/models/fal-minimax-music.ts

export async function createFalMiniMaxPrediction(params: FalMiniMaxInput) {
  const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhooks/fal-ai`;
  const queueUrl = `https://queue.fal.run/fal-ai/minimax-music/v2?fal_webhook=${encodeURIComponent(webhookUrl)}`;

  const response = await fetch(queueUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${process.env.FAL_KEY}`,
    },
    body: JSON.stringify({
      prompt: params.prompt,
      lyrics_prompt: params.lyrics_prompt,
      audio_setting: { sample_rate: 44100, bitrate: 256000, format: 'mp3' },
    }),
  });

  return response.json(); // { request_id: '...' }
}
```

## References

- [fal.ai Webhooks Documentation](https://docs.fal.ai/model-apis/model-endpoints/webhooks)
- [fal.ai Queue API](https://docs.fal.ai/model-apis/model-endpoints/queue)
