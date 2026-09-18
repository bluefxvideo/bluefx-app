# video-roughcut-worker

HTTP worker service that runs the rough-cut pipeline (Deepgram transcription + Claude cut decisions + FCP XML generation) on audio uploaded by the browser.

## Why a separate service

Audio processing (Deepgram + ffmpeg silencedetect + Claude) takes 1-3 minutes per job — too long for a Next.js serverless function. Running this in its own container gives us:

- Longer-running jobs without blocking the main app
- Independent scaling (CPU/memory tuned for transcription workloads)
- Ability to add ffmpeg system binaries without touching the Next.js image

## Architecture

The browser extracts audio from the user's video using ffmpeg.wasm and uploads only a 16 kHz mono MP3 (about 480 KB per minute) to the private `video-roughcut` bucket. This worker:

1. Receives a job via `POST /jobs` from the Next.js app, with a short-lived signed URL for the MP3
2. Downloads the MP3
3. Checks the transcription cache by SHA-256 hash; on a miss, runs Deepgram + silencedetect in parallel
4. Sends the transcript to Claude Fable 5.1 at low reasoning effort through fal's OpenRouter proxy (strict JSON schema, Claude Opus 5 as fallback) to pick removals and trims
5. Places frame-aligned cut points deterministically (`buildEditDecision` in `analyze.ts`)
6. Generates FCP 7 XML at the source's sequence rate with a path-free `pathurl` (forces Premiere's "locate media" dialog)
7. Uploads the XML and transcript to the private bucket and POSTs their storage paths to the Next.js webhook

## HTTP endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check for Docker |
| `POST` | `/jobs` | Start a job (body: `JobRequest`) |
| `GET` | `/jobs/:id` | In-memory status lookup |

All `/jobs*` routes require `X-Internal-Api-Key` header matching `INTERNAL_API_KEY` env var.

## Environment variables

| Var | Required | Description |
|-----|----------|-------------|
| `PORT` | no | Default 3003 |
| `DEEPGRAM_API_KEY` | yes | Deepgram Nova-3 transcription |
| `FAL_KEY` | yes | fal key; the cut decisions go through fal's OpenRouter proxy |
| `ROUGHCUT_MODEL` | no | Default `anthropic/claude-fable-5.1` |
| `ROUGHCUT_FALLBACK_MODEL` | no | Default `anthropic/claude-opus-5` |
| `ROUGHCUT_EFFORT` | no | Default `low` |
| `SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | For storage uploads + cache DB access |
| `INTERNAL_API_KEY` | prod | Shared secret with Next.js app |
| `FFMPEG_PATH` | no | Override ffmpeg binary path (default `ffmpeg`) |

## Pipeline constants

The critical constants from the original CLI's ARCHITECTURE.md are preserved:

- **30 fps sources are written as 29.97** (Premiere builds a 29.97 sequence for them); other rates are written as-is and still need a Premiere test
- **-30dB / 0.15s** silencedetect threshold
- **Silence-END** for IN points, never earlier than the last cut word; **50ms fixed** padding for OUT points
- **Claude Fable 5.1 at low effort**: fastest clean setting in a 12-setting bake-off (`scripts/model-bakeoff.ts`); Gemini at low effort, DeepSeek and Sonnet 5 cut real content
- The model quotes the words a trim starts or ends at; code resolves them to timestamps
- A trimmed segment always starts or ends its own range (the old merge silently dropped trims)
- Narrow safety nets for leading stutters ("so so", "their co their co") and two-word overlaps between lines

## Tests

```sh
npx tsx scripts/trim-cases.ts                                  # trim + stutter unit checks
FFMPEG_PATH=/opt/homebrew/bin/ffmpeg npx tsx scripts/regression.ts   # replays past approved edits (needs the Dropbox CLI project)
```

## Local dev

```sh
cd /Users/gyorfiszilard/bluefx-app/video-roughcut
cp .env.example .env  # fill in the keys
npm install
npm run dev
```

Then from another shell:

```sh
curl http://localhost:3003/health
```

## Running with docker-compose

From `bluefx-app/`:

```sh
docker-compose up video-roughcut-worker
```

The service is reachable at `http://video-roughcut-worker:3003` from other containers in the network.
