import type { FreeVideoLive } from "@/types/free-video";

/**
 * DEV AND FAKE RUNS ONLY (the preview page and runFakeJob): the live status page's record of a REAL free run (joespizzanyc.com, 2026-10-06, local test,
 * $0.84, gate PASS), as the runner wrote it, step by step. The files were copied to storage
 * (examples/free-video/live-demo) so the preview shows the real pieces. Seconds after the start: photos 2,
 * script 106, voice-over 128, music 129, moving clips 171, render 172 to about 205.
 */
export const LIVE_DEMO_DOMAIN = "joespizzanyc.com";
export const LIVE_DEMO_VIDEO =
  "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/video.mp4";

const RECORDED: Record<
  "photos" | "script" | "voice" | "music" | "clips",
  FreeVideoLive
> = {
  photos: {
    photos: [
      "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a4.jpg",
      "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a6.jpg",
    ],
  },
  script: {
    photos: [
      "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a4.jpg",
      "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a6.jpg",
    ],
    look: "clean",
    scenes: [
      {
        say: "Craving an authentic New York street slice?",
        show: ["\ud83c\udf55 NEW YORK CITY", "AUTHENTIC STREET SLICE?"],
        imageId: "a4",
        image:
          "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a4.jpg",
      },
      {
        say: "Head to Joe's Pizza in Greenwich Village, where we serve the classic slice that native New Yorkers and visitors both love.",
        show: [
          "THE CLASSIC SLICE",
          "Native New Yorkers",
          "Visitors and tourists",
        ],
      },
      {
        say: "We are a true Greenwich Village institution, offering that exact same classic New York taste for over forty-seven years.",
        show: ["A VILLAGE INSTITUTION", "OVER 47 YEARS"],
        imageId: "a4",
        image:
          "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a4.jpg",
      },
      {
        say: "Established in nineteen seventy-five by Joe Pozzuoli, who came here originally from Naples, Italy, the birthplace of pizza.",
        show: ["SINCE 1975", "Founder Joe Pozzuoli", "From Naples, Italy"],
        imageId: "a6",
        image:
          "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a6.jpg",
      },
      {
        say: "At seventy-five years of age, Joe still proudly owns and operates the restaurant today.",
        show: ["STILL OPERATING", "OWNER OPERATED"],
        imageId: "a6",
        image:
          "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a6.jpg",
      },
      {
        say: "Order your classic slice right now at the website on screen.",
        show: ["ORDER NOW", "visit:", "joespizzanyc.com"],
      },
    ],
  },
  voice: {
    photos: [
      "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a4.jpg",
      "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a6.jpg",
    ],
    look: "clean",
    scenes: [
      {
        say: "Craving an authentic New York street slice?",
        show: ["\ud83c\udf55 NEW YORK CITY", "AUTHENTIC STREET SLICE?"],
        imageId: "a4",
        image:
          "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a4.jpg",
      },
      {
        say: "Head to Joe's Pizza in Greenwich Village, where we serve the classic slice that native New Yorkers and visitors both love.",
        show: [
          "THE CLASSIC SLICE",
          "Native New Yorkers",
          "Visitors and tourists",
        ],
      },
      {
        say: "We are a true Greenwich Village institution, offering that exact same classic New York taste for over forty-seven years.",
        show: ["A VILLAGE INSTITUTION", "OVER 47 YEARS"],
        imageId: "a4",
        image:
          "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a4.jpg",
      },
      {
        say: "Established in nineteen seventy-five by Joe Pozzuoli, who came here originally from Naples, Italy, the birthplace of pizza.",
        show: ["SINCE 1975", "Founder Joe Pozzuoli", "From Naples, Italy"],
        imageId: "a6",
        image:
          "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a6.jpg",
      },
      {
        say: "At seventy-five years of age, Joe still proudly owns and operates the restaurant today.",
        show: ["STILL OPERATING", "OWNER OPERATED"],
        imageId: "a6",
        image:
          "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a6.jpg",
      },
      {
        say: "Order your classic slice right now at the website on screen.",
        show: ["ORDER NOW", "visit:", "joespizzanyc.com"],
      },
    ],
    voiceUrl:
      "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/voice.wav",
  },
  music: {
    photos: [
      "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a4.jpg",
      "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a6.jpg",
    ],
    look: "clean",
    scenes: [
      {
        say: "Craving an authentic New York street slice?",
        show: ["\ud83c\udf55 NEW YORK CITY", "AUTHENTIC STREET SLICE?"],
        imageId: "a4",
        image:
          "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a4.jpg",
      },
      {
        say: "Head to Joe's Pizza in Greenwich Village, where we serve the classic slice that native New Yorkers and visitors both love.",
        show: [
          "THE CLASSIC SLICE",
          "Native New Yorkers",
          "Visitors and tourists",
        ],
      },
      {
        say: "We are a true Greenwich Village institution, offering that exact same classic New York taste for over forty-seven years.",
        show: ["A VILLAGE INSTITUTION", "OVER 47 YEARS"],
        imageId: "a4",
        image:
          "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a4.jpg",
      },
      {
        say: "Established in nineteen seventy-five by Joe Pozzuoli, who came here originally from Naples, Italy, the birthplace of pizza.",
        show: ["SINCE 1975", "Founder Joe Pozzuoli", "From Naples, Italy"],
        imageId: "a6",
        image:
          "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a6.jpg",
      },
      {
        say: "At seventy-five years of age, Joe still proudly owns and operates the restaurant today.",
        show: ["STILL OPERATING", "OWNER OPERATED"],
        imageId: "a6",
        image:
          "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a6.jpg",
      },
      {
        say: "Order your classic slice right now at the website on screen.",
        show: ["ORDER NOW", "visit:", "joespizzanyc.com"],
      },
    ],
    voiceUrl:
      "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/voice.wav",
    musicUrl:
      "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/music.mp3",
  },
  clips: {
    photos: [
      "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a4.jpg",
      "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a6.jpg",
    ],
    look: "clean",
    scenes: [
      {
        say: "Craving an authentic New York street slice?",
        show: ["\ud83c\udf55 NEW YORK CITY", "AUTHENTIC STREET SLICE?"],
        imageId: "a4",
        image:
          "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a4.jpg",
      },
      {
        say: "Head to Joe's Pizza in Greenwich Village, where we serve the classic slice that native New Yorkers and visitors both love.",
        show: [
          "THE CLASSIC SLICE",
          "Native New Yorkers",
          "Visitors and tourists",
        ],
      },
      {
        say: "We are a true Greenwich Village institution, offering that exact same classic New York taste for over forty-seven years.",
        show: ["A VILLAGE INSTITUTION", "OVER 47 YEARS"],
        imageId: "a4",
        image:
          "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a4.jpg",
      },
      {
        say: "Established in nineteen seventy-five by Joe Pozzuoli, who came here originally from Naples, Italy, the birthplace of pizza.",
        show: ["SINCE 1975", "Founder Joe Pozzuoli", "From Naples, Italy"],
        imageId: "a6",
        image:
          "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a6.jpg",
      },
      {
        say: "At seventy-five years of age, Joe still proudly owns and operates the restaurant today.",
        show: ["STILL OPERATING", "OWNER OPERATED"],
        imageId: "a6",
        image:
          "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a6.jpg",
      },
      {
        say: "Order your classic slice right now at the website on screen.",
        show: ["ORDER NOW", "visit:", "joespizzanyc.com"],
      },
    ],
    clips: {
      a4: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a4-motion.mp4",
      a6: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/a6-motion.mp4",
    },
    voiceUrl:
      "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/voice.wav",
    musicUrl:
      "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo/music.mp3",
  },
};

const DEMO_BASE = "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/script-videos/smart-video/examples/free-video/live-demo";
/** The presenter came later than this run: their photo and clip are from the ascentequipment.com free video ad (2026-10-06), copied next to the run's files. */
const PRESENTER_PHOTO = { presenterPhoto: `${DEMO_BASE}/presenter.jpg` };
const PRESENTER_CLIP = { ...PRESENTER_PHOTO, presenterClip: `${DEMO_BASE}/presenter.mp4` };

/** The run step by step, in the order a free video ad makes its pieces now: photos, the presenter cast, the script, the voice-over, the presenter's clip. */
export const LIVE_DEMO: Record<"photos" | "cast" | "script" | "voice" | "music" | "clips", FreeVideoLive> = {
  photos: RECORDED.photos,
  cast: { ...RECORDED.photos, ...PRESENTER_PHOTO },
  script: { ...RECORDED.script, ...PRESENTER_PHOTO },
  voice: { ...RECORDED.voice, ...PRESENTER_PHOTO },
  music: { ...RECORDED.music, ...PRESENTER_CLIP },
  clips: { ...RECORDED.clips, ...PRESENTER_CLIP },
};
