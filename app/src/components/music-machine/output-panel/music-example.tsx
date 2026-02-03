"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Play, Pause, Music, Download } from "lucide-react";

// ── Example Data ──────────────────────────────────────────────────

interface ExampleTrack {
  id: string;
  title: string;
  genre: string;
  mood: string;
  prompt: string;
  audioUrl: string;
}

const EXAMPLE_TRACKS: ExampleTrack[] = [
  // ── Featured tracks ─────────────────────────────────────────────
  {
    id: "example-blues",
    title: "Electric Blues",
    genre: "Blues",
    mood: "Soulful",
    prompt: "Soulful electric blues with gritty guitar bends, walking bass, and raw expressive feeling",
    audioUrl: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/examples/16_blues.mp3",
  },
  {
    id: "example-gospel",
    title: "Gospel Choir",
    genre: "Gospel",
    mood: "Uplifting",
    prompt: "Uplifting gospel choir with powerful harmonies, clapping rhythm, and joyful energy",
    audioUrl: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/examples/18_gospel.mp3",
  },
  // ── From user library ────────────────────────────────────────────
  {
    id: "example-metal-vocals",
    title: "Heavy Metal Vocals",
    genre: "Heavy Metal",
    mood: "Epic",
    prompt: "Deep heavy metal. Instrumental only, no vocals",
    audioUrl: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/music-machine_music_3482a18b-9d9f-49a9-be51-1f159bfd20a6_2026-02-03T203830878Z.mp3",
  },
  {
    id: "example-metal-instrumental",
    title: "Deep Heavy Metal",
    genre: "Heavy Metal",
    mood: "Intense",
    prompt: "Heavy metal song with Manowar style lyrics about warrior kings reborn",
    audioUrl: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/music-machine_music_07199ee7-265c-4ced-9082-288ac07e6c02_2026-02-02T171238997Z.mp3",
  },
  // ── Generated examples ───────────────────────────────────────────
  {
    id: "example-lofi",
    title: "Lo-Fi Chill Beat",
    genre: "Lo-Fi",
    mood: "Relaxed",
    prompt: "Relaxing lo-fi hip hop beat with warm piano chords, vinyl crackle, and mellow drums",
    audioUrl: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/examples/01_lofi.mp3",
  },
  {
    id: "example-jazz",
    title: "Smooth Jazz",
    genre: "Jazz",
    mood: "Sophisticated",
    prompt: "Smooth jazz instrumental with sultry saxophone melody, piano comping, and brushed drums",
    audioUrl: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/examples/03_jazz.mp3",
  },
  {
    id: "example-piano",
    title: "Classical Piano",
    genre: "Classical",
    mood: "Expressive",
    prompt: "Beautiful classical piano solo inspired by Chopin with delicate arpeggios and emotional depth",
    audioUrl: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/examples/04_piano.mp3",
  },
  {
    id: "example-pop",
    title: "Pop Female Vocals",
    genre: "Pop",
    mood: "Upbeat",
    prompt: "Catchy pop song with female vocals, bright synths, and infectious chorus",
    audioUrl: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/examples/05_pop.mp3",
  },
  {
    id: "example-ambient",
    title: "Ambient Atmospheric",
    genre: "Ambient",
    mood: "Dreamy",
    prompt: "Atmospheric ambient track with ethereal pads, subtle textures, and spacious reverb",
    audioUrl: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/examples/06_ambient.mp3",
  },
  {
    id: "example-trap",
    title: "Trap Beat",
    genre: "Hip Hop",
    mood: "Dark",
    prompt: "Hard-hitting trap beat with deep 808 bass, crisp hi-hats, and dark atmospheric synths",
    audioUrl: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/examples/07_trap.mp3",
  },
  {
    id: "example-country",
    title: "Country Folk",
    genre: "Country",
    mood: "Heartfelt",
    prompt: "Upbeat country folk with acoustic guitar, fiddle melody, and warm male vocals",
    audioUrl: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/examples/08_country.mp3",
  },
  {
    id: "example-reggae",
    title: "Reggae Sunshine",
    genre: "Reggae",
    mood: "Positive",
    prompt: "Laid-back reggae with offbeat guitar skank, deep bass, and positive sunny vibes",
    audioUrl: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/examples/09_reggae.mp3",
  },
  {
    id: "example-rnb",
    title: "R&B Soul",
    genre: "R&B",
    mood: "Smooth",
    prompt: "Smooth R&B soul with silky male vocals, lush harmonies, and neo-soul production",
    audioUrl: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/examples/10_rnb.mp3",
  },
  {
    id: "example-rock",
    title: "Rock Anthem",
    genre: "Rock",
    mood: "Powerful",
    prompt: "Powerful rock anthem with driving electric guitars, thundering drums, and soaring vocals",
    audioUrl: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/examples/11_rock.mp3",
  },
  {
    id: "example-funk",
    title: "Funk Groove",
    genre: "Funk",
    mood: "Groovy",
    prompt: "Funky groove with slap bass, wah-wah guitar, tight drums, and brass stabs",
    audioUrl: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/examples/12_funk.mp3",
  },
  {
    id: "example-synthwave",
    title: "Synthwave Retro",
    genre: "Synthwave",
    mood: "Nostalgic",
    prompt: "Retro synthwave with pulsing arpeggios, warm analog synth leads, and 80s neon atmosphere",
    audioUrl: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/examples/13_synth.mp3",
  },
  {
    id: "example-bossa",
    title: "Latin Bossa Nova",
    genre: "Bossa Nova",
    mood: "Relaxed",
    prompt: "Smooth bossa nova with nylon guitar fingerpicking, soft percussion, and gentle flute",
    audioUrl: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/examples/14_bossa.mp3",
  },
  {
    id: "example-trailer",
    title: "Epic Trailer Music",
    genre: "Cinematic",
    mood: "Triumphant",
    prompt: "Epic cinematic trailer music with massive percussion, soaring brass, and sweeping strings",
    audioUrl: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/examples/15_trailer.mp3",
  },
  {
    id: "example-disco",
    title: "Disco Groove",
    genre: "Disco",
    mood: "Funky",
    prompt: "Groovy disco with funky bass line, four-on-the-floor beat, string stabs, and sparkling synths",
    audioUrl: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/examples/17_disco.mp3",
  },
  {
    id: "example-dubstep",
    title: "Dubstep Drop",
    genre: "Dubstep",
    mood: "Intense",
    prompt: "Heavy dubstep with massive wobble bass drops, glitchy synths, and intense build-ups",
    audioUrl: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/audio/public/examples/19_dubstep.mp3",
  },
];

// ── Helpers ───────────────────────────────────────────────────────

const formatTime = (seconds: number) => {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// ── Component ─────────────────────────────────────────────────────

export function MusicExample() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Continuously update current time during playback
  const startTimeTracking = useCallback(() => {
    const update = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
      animFrameRef.current = requestAnimationFrame(update);
    };
    animFrameRef.current = requestAnimationFrame(update);
  }, []);

  const stopTimeTracking = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopTimeTracking();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [stopTimeTracking]);

  const handlePlay = useCallback(
    (track: ExampleTrack) => {
      // Toggle pause/play on same track
      if (playingId === track.id && audioRef.current) {
        if (audioRef.current.paused) {
          audioRef.current.play();
          startTimeTracking();
        } else {
          audioRef.current.pause();
          stopTimeTracking();
        }
        return;
      }

      // Stop current track
      stopTimeTracking();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // Start new track
      const audio = new Audio(track.audioUrl);
      audio.addEventListener("loadedmetadata", () => {
        setDuration(audio.duration);
      });
      audio.addEventListener("ended", () => {
        setPlayingId(null);
        setCurrentTime(0);
        stopTimeTracking();
        audioRef.current = null;
      });
      audio.addEventListener("error", () => {
        setPlayingId(null);
        setCurrentTime(0);
        stopTimeTracking();
        audioRef.current = null;
      });
      audio.play();
      audioRef.current = audio;
      setPlayingId(track.id);
      setCurrentTime(0);
      setDuration(0);
      startTimeTracking();
    },
    [playingId, startTimeTracking, stopTimeTracking]
  );

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, track: ExampleTrack) => {
      if (playingId !== track.id || !audioRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audioRef.current.currentTime = ratio * audioRef.current.duration;
      setCurrentTime(audioRef.current.currentTime);
    },
    [playingId]
  );

  const progress =
    playingId && audioRef.current && duration > 0
      ? (currentTime / duration) * 100
      : 0;

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">
            Sample Tracks
          </span>
        </div>
        <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 shadow-lg">
          <span className="text-xs font-bold">Examples</span>
        </Badge>
      </div>

      {/* Track cards */}
      <div className="space-y-2">
        {EXAMPLE_TRACKS.map((track) => {
          const isActive = playingId === track.id;
          const isPaused = isActive && audioRef.current?.paused;

          return (
            <Card
              key={track.id}
              className={`p-3 border-border/50 transition-colors ${
                isActive
                  ? "bg-primary/5 border-primary/30"
                  : "bg-secondary/50"
              }`}
            >
              <div className="space-y-2">
                {/* Top row: badges + title */}
                <div className="flex items-center gap-2">
                  {/* Play button */}
                  <button
                    onClick={() => handlePlay(track)}
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-105 ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground"
                    }`}
                  >
                    {isActive && !isPaused ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5 ml-0.5" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">
                        {track.title}
                      </span>
                      <Badge variant="outline" className="text-[10px] flex-shrink-0">
                        {track.genre}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {track.prompt}
                    </p>
                  </div>

                  {/* Time display */}
                  <span className="text-[11px] text-muted-foreground font-mono flex-shrink-0">
                    {isActive && duration > 0
                      ? `${formatTime(currentTime)} / ${formatTime(duration)}`
                      : ""}
                  </span>

                  {/* Download */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const link = document.createElement("a");
                      link.href = track.audioUrl;
                      link.download = `${track.title}.mp3`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                    title={`Download ${track.title}`}
                  >
                    <Download className="w-3 h-3" />
                  </button>
                </div>

                {/* Seekable progress bar */}
                <div
                  className={`relative h-1.5 rounded-full group ${
                    isActive ? "cursor-pointer" : ""
                  } ${isActive ? "bg-muted/60" : "bg-muted/30"}`}
                  onClick={(e) => handleSeek(e, track)}
                >
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full ${
                      isActive ? "bg-primary" : ""
                    }`}
                    style={{ width: `${isActive ? progress : 0}%` }}
                  />
                  {/* Scrub handle - always visible when active */}
                  {isActive && progress > 0 && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full shadow-md border-2 border-primary-foreground"
                      style={{ left: `${progress}%`, transform: "translate(-50%, -50%)" }}
                    />
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
