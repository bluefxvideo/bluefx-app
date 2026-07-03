import { promises as fs } from 'fs';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
  CloneAnalysisSummary,
  SceneAnalysis,
} from '@/types/clone-studio';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '');

export interface SceneAnalysisResult {
  summary: CloneAnalysisSummary;
  /** Keyed by scene number `n`. */
  scenes: Map<number, SceneAnalysis>;
}

/**
 * Why this prompt is shaped the way it is (verified on a real ad remake):
 * - Keyframe-state rule: i2v models refuse to CREATE physically absurd states
 *   mid-clip — they correct toward plausibility. The gag state must already be
 *   painted into the start frame, so `start_state` must be a complete visual
 *   description of the frame, including any impossible/gag condition.
 * - Action-arc rule: prompts like "struggles to pull his hand out" get animated
 *   as the hand coming OUT. Every scene needs start → attempts → LOCKED end
 *   state plus explicit invariants the motion prompt repeats verbatim.
 * - Character IDs: identity drift across scenes was the one visible flaw in the
 *   hand-run remake — stable IDs + detailed profiles let the edit stage pass the
 *   same reference images into every scene.
 */
const ANALYSIS_SYSTEM_PROMPT = `You are a commercial director's assistant dissecting a video ad shot-by-shot so each shot can be faithfully re-created with AI image and video models.

You will receive the full video plus a list of scenes that were detected with exact start/end timestamps. Analyze EACH listed scene (use the timestamps to know which part of the video each scene covers).

## CHARACTER PROFILES (do this first)
Identify every person who appears in more than one scene. Give each a stable ID ("MAIN CHARACTER", "CHARACTER A", ...) and a detailed profile: age, gender, ethnicity, hair (color/length/style), facial features, build, wardrobe per outfit, distinguishing features. Refer to people ONLY by these IDs in scene analyses.

## PER-SCENE FIELDS
For every scene output:

1. "action_arc" — the motion blueprint:
   - "start_state": a COMPLETE visual description of the scene's FIRST moment — subjects, pose, expression, props, setting, lighting. If the scene contains a physically impossible or comedic state (hand stuck inside a bottle, person shrunk, object floating), describe that state as ALREADY TRUE here. This text is used to paint the starting image, so it must describe a paintable still frame.
   - "action": what happens across the scene as beats (attempt 1 → attempt 2 → reaction). Describe movement only, no camera talk.
   - "end_state": the LOCKED final state of the scene. Be explicit about what has NOT changed ("the hand is STILL inside the bottle").
   - "invariants": hard rules that must hold for the entire scene, phrased as absolutes ("the bottle NEVER comes off", "she never leaves the couch"). Empty array if none.

2. "dialog": every word spoken or narrated during this scene, verbatim. Empty string if silent.

3. "camera": framing and movement in filmmaker terms ("medium close-up, handheld, slow push-in").

4. "on_screen_text": any overlay text/captions shown, verbatim. Empty string if none. (Overlays are re-typed in an editor later — never describe them as part of the image.)

5. "swap_targets": the entities in THIS scene a user might replace — character IDs and product names visible in frame. Example: ["MAIN CHARACTER", "Pringles can"].

## GLOBAL FIELDS
- "summary": one paragraph — what the ad is, its structure and tone.
- "products": every distinct product/brand shown.
- "visual_style": grade, lighting, lens/format feel, era — enough to keep regenerated frames consistent.
- "music_brief": a one-sentence brief for re-scoring (genre, mood, energy curve, instrumentation).

Output valid JSON only, matching:
{
  "summary": "...",
  "characters": [{ "id": "MAIN CHARACTER", "description": "..." }],
  "products": ["..."],
  "visual_style": "...",
  "music_brief": "...",
  "scenes": [
    {
      "n": 1,
      "action_arc": { "start_state": "...", "action": "...", "end_state": "...", "invariants": ["..."] },
      "dialog": "...",
      "camera": "...",
      "on_screen_text": "...",
      "swap_targets": ["..."]
    }
  ]
}
Every scene in the provided list MUST appear exactly once in "scenes", with the same "n".`;

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

function emptySceneAnalysis(): SceneAnalysis {
  return {
    action_arc: { start_state: '', action: '', end_state: '', invariants: [] },
    dialog: '',
    camera: '',
    on_screen_text: '',
    swap_targets: [],
  };
}

function coerceSceneAnalysis(raw: Record<string, unknown>): SceneAnalysis {
  const arc = (raw.action_arc || {}) as Record<string, unknown>;
  return {
    action_arc: {
      start_state: String(arc.start_state || ''),
      action: String(arc.action || ''),
      end_state: String(arc.end_state || ''),
      invariants: Array.isArray(arc.invariants) ? arc.invariants.map(String) : [],
    },
    dialog: String(raw.dialog || ''),
    camera: String(raw.camera || ''),
    on_screen_text: String(raw.on_screen_text || ''),
    swap_targets: Array.isArray(raw.swap_targets) ? raw.swap_targets.map(String) : [],
  };
}

/**
 * Run the structured per-scene analysis on the (size-fitted) video file.
 * Scene ranges come from ffmpeg cut detection so the analysis is aligned to
 * the real edit rhythm rather than Gemini's own guess at shot boundaries.
 */
export async function analyzeScenes(
  videoFilePath: string,
  sceneRanges: Array<{ n: number; start: number; end: number }>
): Promise<SceneAnalysisResult> {
  const videoBuffer = await fs.readFile(videoFilePath);
  const videoBase64 = videoBuffer.toString('base64');

  const sceneList = sceneRanges
    .map((s) => `Scene ${s.n}: ${formatTimestamp(s.start)} – ${formatTimestamp(s.end)} (${(s.end - s.start).toFixed(1)}s)`)
    .join('\n');

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await model.generateContent([
    { inlineData: { mimeType: 'video/mp4', data: videoBase64 } },
    { text: `${ANALYSIS_SYSTEM_PROMPT}\n\n## DETECTED SCENES (analyze each)\n${sceneList}` },
  ]);

  const responseText = result.response.text();
  if (!responseText) {
    throw new Error('Scene analysis returned an empty response');
  }

  let parsed: Record<string, unknown>;
  try {
    let clean = responseText.trim();
    if (clean.startsWith('```json')) clean = clean.slice(7);
    if (clean.startsWith('```')) clean = clean.slice(3);
    if (clean.endsWith('```')) clean = clean.slice(0, -3);
    parsed = JSON.parse(clean.trim());
  } catch {
    console.error('Clone Studio analysis: unparseable response:', responseText.slice(0, 500));
    throw new Error('Scene analysis returned invalid JSON');
  }

  const summary: CloneAnalysisSummary = {
    summary: String(parsed.summary || ''),
    characters: Array.isArray(parsed.characters)
      ? (parsed.characters as Array<Record<string, unknown>>).map((c) => ({
          id: String(c.id || ''),
          description: String(c.description || ''),
        }))
      : [],
    products: Array.isArray(parsed.products) ? (parsed.products as unknown[]).map(String) : [],
    visual_style: String(parsed.visual_style || ''),
    music_brief: String(parsed.music_brief || ''),
  };

  const scenes = new Map<number, SceneAnalysis>();
  if (Array.isArray(parsed.scenes)) {
    for (const raw of parsed.scenes as Array<Record<string, unknown>>) {
      const n = Number(raw.n);
      if (Number.isInteger(n) && n > 0) {
        scenes.set(n, coerceSceneAnalysis(raw));
      }
    }
  }
  // Guarantee every detected scene has an analysis object even if the model
  // skipped one — the board can still render and the user can fill it in.
  for (const range of sceneRanges) {
    if (!scenes.has(range.n)) {
      console.warn(`Clone Studio analysis: model skipped scene ${range.n}, inserting empty analysis`);
      scenes.set(range.n, emptySceneAnalysis());
    }
  }

  return { summary, scenes };
}
