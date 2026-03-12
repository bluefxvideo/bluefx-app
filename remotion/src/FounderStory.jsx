import React from 'react';
import {
  AbsoluteFill,
  Video,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  staticFile,
  spring,
} from 'remotion';

// ============================================
// DARK MIST FOUNDER STORY
// Single edited video + graphics + captions
// ============================================

const FPS = 30;
const SOURCE_VIDEO_DURATION = 328.1; // original edited story duration in seconds

// Video cut: remove "constitutional AI" segment
const CUT_START = 172.66; // after "agentic AI" ends
const CUT_END = 174.0;    // where "process" begins
const CUT_DURATION = CUT_END - CUT_START; // 1.34s removed
const VIDEO_DURATION = SOURCE_VIDEO_DURATION - CUT_DURATION; // ~326.76s

// Helper: convert source video time to output timeline time
const srcToOut = (t) => t <= CUT_START ? t : t - CUT_DURATION;

// Helper: convert output timeline time to source video time
const outToSrc = (t) => t <= CUT_START ? t : t + CUT_DURATION;

// Brand colors - conservative / executive palette
const COLORS = {
  bg: '#0a0a0a',
  bgGradient1: '#0a0a0a',
  bgGradient2: '#1a1a1a',
  accent: '#D4A853',       // warm gold
  accentAlt: '#C1272D',    // Dark Mist red (from logo)
  white: '#FFFFFF',
  gray: '#b0b0b0',
  captionBg: 'rgba(0, 0, 0, 0.75)',
};

// Word-level captions data (loaded from JSON in public/)
// We inline the import path for Remotion's static file system
import captionsData from './captions.json';

// ============================================
// TIMELINE - timestamps in OUTPUT timeline (after cut)
// ============================================

// Section markers (adjusted for cut)
const SECTIONS = [
  { start: 0,     label: null },                                          // Cold open hook
  { start: 37.5,  label: 'THE BEGINNING',  sublabel: "A Father's Concern" },  // ~frame 1125
  { start: 52.5,  label: 'THE PROBLEM',    sublabel: 'A Broken Industry' },   // "...industry was broken"
  { start: 117.3, label: 'THE SOLUTION',   sublabel: 'Building Dark Mist' },  // "Four years ago..."
  { start: srcToOut(267.9), label: 'THE MISSION', sublabel: 'For the Next Generation' }, // adjusted
];

const LOWER_THIRD = { start: 30, duration: 6, name: 'LaMont Thomas', title: 'Founder & CEO, Dark Mist' };

// Stat overlays with timing (adjusted for cut where needed)
const STATS = [
  { start: 110, text: '"It\'s the way it\'s always been."', style: 'quote' },
  { start: 150, text: '40,000-50,000', subtext: 'Insurance Pros Aging Out', style: 'stat' },
  { start: srcToOut(212), text: 'Wearable AI', subtext: 'Smart Glasses + Voice + Biometrics', style: 'stat' },
  { start: srcToOut(296), text: '$4.5 Billion', subtext: 'Annual Premium Written', style: 'stat' },
];

const OUTRO_START = VIDEO_DURATION; // outro starts after video ends
const OUTRO_DURATION = 5;

export const FOUNDER_STORY_TOTAL_FRAMES = Math.ceil((VIDEO_DURATION + OUTRO_DURATION) * FPS);

// Helper
const sf = (s) => Math.round(s * FPS);

// ============================================
// CAPTION COMPONENT - word-by-word highlighting
// ============================================

const Captions = () => {
  const frame = useCurrentFrame();
  // Map output timeline back to source video time for caption matching
  const currentTime = outToSrc(frame / FPS);

  const WORDS_PER_GROUP = 6;

  // Pre-process: merge words that start with punctuation (like ",000") into the preceding word
  const mergedWords = React.useMemo(() => {
    const result = [];
    for (let i = 0; i < captionsData.length; i++) {
      const w = captionsData[i];
      if (w.word.match(/^[,.\-;:!?']/) && result.length > 0) {
        // Merge with previous word
        const prev = result[result.length - 1];
        result[result.length - 1] = {
          word: prev.word + w.word,
          start: prev.start,
          end: w.end,
        };
      } else {
        result.push({ ...w });
      }
    }
    return result;
  }, []);

  const words = mergedWords;

  // Smart grouping: ~6 words per group, but don't break mid-sentence if near boundary
  const groups = [];
  for (let i = 0; i < words.length; i += WORDS_PER_GROUP) {
    const group = words.slice(i, i + WORDS_PER_GROUP);
    groups.push(group);
  }

  // Find active group
  let activeGroup = null;
  let activeGroupIndex = -1;
  for (let i = 0; i < groups.length; i++) {
    const groupStart = groups[i][0].start;
    const groupEnd = groups[i][groups[i].length - 1].end;
    // Show group from its start to 0.3s after its last word
    if (currentTime >= groupStart - 0.1 && currentTime <= groupEnd + 0.3) {
      activeGroup = groups[i];
      activeGroupIndex = i;
      break;
    }
  }

  if (!activeGroup) return null;

  // Fade animation
  const groupStart = activeGroup[0].start;
  const groupEnd = activeGroup[activeGroup.length - 1].end;
  const fadeIn = interpolate(currentTime, [groupStart - 0.1, groupStart + 0.05], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fadeOut = interpolate(currentTime, [groupEnd, groupEnd + 0.3], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute',
        bottom: 80,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity,
      }}>
        <div style={{
          backgroundColor: COLORS.captionBg,
          backdropFilter: 'blur(8px)',
          borderRadius: 16,
          padding: '22px 44px',
          maxWidth: '90%',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '8px 14px',
        }}>
          {activeGroup.map((word, i) => {
            const isActive = currentTime >= word.start;
            const isCurrentWord = currentTime >= word.start && currentTime <= word.end + 0.15;

            return (
              <span
                key={`${activeGroupIndex}-${i}`}
                style={{
                  fontSize: 56,
                  fontWeight: isCurrentWord ? 800 : 600,
                  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                  color: isCurrentWord ? COLORS.accent : isActive ? COLORS.white : 'rgba(255,255,255,0.4)',
                  transition: 'color 0.1s',
                  textShadow: isCurrentWord ? `0 0 20px ${COLORS.accent}40` : 'none',
                }}
              >
                {word.word}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// SECTION TITLE OVERLAY
// ============================================

const SectionTitle = ({ label, sublabel }) => {
  const frame = useCurrentFrame();
  const dur = 3 * FPS;

  const opacity = interpolate(frame, [0, 12, dur - 15, dur], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
  const labelX = interpolate(frame, [0, 16], [50, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const sublabelX = interpolate(frame, [6, 22], [50, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const lineH = interpolate(frame, [3, 20], [0, 100], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{
        position: 'absolute', top: 70, right: 80,
        display: 'flex', alignItems: 'flex-start', gap: 22,
        flexDirection: 'row-reverse',
      }}>
        <div style={{
          width: 6, height: lineH, backgroundColor: COLORS.accent,
          borderRadius: 3, marginTop: 6,
        }} />
        <div style={{ textAlign: 'right' }}>
          <div style={{
            transform: `translateX(${labelX}px)`,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            padding: '8px 16px 8px 24px',
            borderRadius: 6,
            fontSize: 72, fontWeight: 800,
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            color: COLORS.white, letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textShadow: '0 3px 24px rgba(0,0,0,0.9)',
          }}>
            {label}
          </div>
          <div style={{
            transform: `translateX(${sublabelX}px)`,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(8px)',
            padding: '6px 16px 6px 20px',
            borderRadius: 6,
            display: 'inline-block',
            fontSize: 38, fontWeight: 500,
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            color: COLORS.accent, letterSpacing: '0.05em',
            marginTop: 10,
            textShadow: '0 2px 10px rgba(0,0,0,0.6)',
          }}>
            {sublabel}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// LOWER THIRD
// ============================================

const LowerThirdBar = ({ name, title }) => {
  const frame = useCurrentFrame();
  const totalFrames = LOWER_THIRD.duration * FPS;

  const slideIn = interpolate(frame, [0, 15], [-280, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const slideOut = interpolate(frame, [totalFrames - 15, totalFrames], [0, -280], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) });
  const tx = frame < totalFrames - 15 ? slideIn : slideOut;
  const barScale = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', bottom: 260, left: 80,
        transform: `translateX(${tx}px)`,
      }}>
        <div style={{
          display: 'flex', alignItems: 'stretch',
          transform: `scaleX(${barScale})`, transformOrigin: 'left',
        }}>
          <div style={{ width: 8, backgroundColor: COLORS.accent }} />
          <div style={{
            backgroundColor: 'rgba(10, 10, 18, 0.88)',
            backdropFilter: 'blur(12px)',
            padding: '24px 48px 24px 28px',
          }}>
            <div style={{
              fontSize: 58, fontWeight: 700,
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              color: COLORS.white, letterSpacing: '0.02em',
            }}>
              {name}
            </div>
            <div style={{
              fontSize: 36, fontWeight: 400,
              fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
              color: COLORS.accent, marginTop: 8, letterSpacing: '0.04em',
            }}>
              {title}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// STAT / QUOTE OVERLAY
// ============================================

const StatOverlay = ({ text, subtext, style: overlayStyle }) => {
  const frame = useCurrentFrame();
  const dur = 4 * FPS;

  const fadeIn = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [dur - 12, dur], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity = Math.min(fadeIn, fadeOut);
  const slideY = interpolate(frame, [0, 15], [20, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  const isQuote = overlayStyle === 'quote';

  return (
    <AbsoluteFill style={{ opacity }}>
      <div style={{
        position: 'absolute',
        top: isQuote ? '15%' : 80,
        right: 80,
        transform: `translateY(${slideY}px)`,
        textAlign: 'right',
        maxWidth: 700,
      }}>
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(10px)',
          borderRadius: 12,
          padding: isQuote ? '28px 36px' : '24px 36px',
          borderRight: `4px solid ${COLORS.accent}`,
        }}>
          {isQuote ? (
            <div style={{
              fontSize: 60, fontWeight: 600, fontStyle: 'italic',
              fontFamily: 'Georgia, serif',
              color: COLORS.white,
              textShadow: '0 2px 12px rgba(0,0,0,0.5)',
              lineHeight: 1.3,
            }}>
              {text}
            </div>
          ) : (
            <>
              <div style={{
                fontSize: 90, fontWeight: 800,
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                color: COLORS.accent,
                textShadow: '0 2px 12px rgba(0,0,0,0.5)',
                lineHeight: 1.1,
              }}>
                {text}
              </div>
              {subtext && (
                <div style={{
                  fontSize: 36, fontWeight: 500,
                  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                  color: COLORS.white,
                  textShadow: '0 2px 8px rgba(0,0,0,0.4)',
                  marginTop: 10, letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}>
                  {subtext}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// OUTRO CARD
// ============================================

const OutroCard = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: 'clamp' });
  const logoScale = spring({ frame, fps, from: 0.85, to: 1, config: { damping: 12, stiffness: 60 } });
  const taglineOpacity = interpolate(frame, [18, 36], [0, 1], { extrapolateRight: 'clamp' });
  const taglineY = interpolate(frame, [18, 36], [18, 0], { extrapolateRight: 'clamp' });
  const urlOpacity = interpolate(frame, [36, 54], [0, 1], { extrapolateRight: 'clamp' });
  const lineWidth = interpolate(frame, [8, 45], [0, 400], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });

  return (
    <AbsoluteFill style={{
      background: `radial-gradient(ellipse at center, ${COLORS.bgGradient2} 0%, ${COLORS.bgGradient1} 70%)`,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      opacity: fadeIn,
    }}>
      <div style={{
        position: 'absolute', width: '100%', height: '100%',
        background: `radial-gradient(circle at 50% 50%, rgba(0, 201, 183, 0.1) 0%, transparent 60%)`,
      }} />
      <div style={{
        transform: `scale(${logoScale})`,
        fontSize: 100, fontWeight: 800,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        color: COLORS.white, letterSpacing: '-0.03em', textTransform: 'uppercase',
      }}>
        <span style={{ color: COLORS.accent }}>Dark</span> Mist
      </div>
      <div style={{
        width: lineWidth, height: 3,
        background: `linear-gradient(90deg, transparent, ${COLORS.accent}, transparent)`,
        marginTop: 28, marginBottom: 28,
      }} />
      <div style={{
        opacity: taglineOpacity,
        transform: `translateY(${taglineY}px)`,
        fontSize: 36, fontWeight: 500,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        color: COLORS.gray, letterSpacing: '0.08em',
        textAlign: 'center', maxWidth: 800, lineHeight: 1.5,
      }}>
        See Risk Clearly. Assess Risk Fairly. Underwrite the Future.
      </div>
      <div style={{
        opacity: urlOpacity, marginTop: 44,
        fontSize: 32, fontWeight: 600,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        color: COLORS.accent, letterSpacing: '0.1em',
      }}>
        darkmist.ai
      </div>
    </AbsoluteFill>
  );
};

// ============================================
// OVERLAYS
// ============================================

const Vignette = () => (
  <AbsoluteFill style={{
    background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.35) 100%)',
    pointerEvents: 'none',
  }} />
);

const TopGradient = () => (
  <AbsoluteFill style={{
    background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 20%)',
    pointerEvents: 'none',
  }} />
);

// ============================================
// MAIN COMPOSITION
// ============================================

export const FounderStory = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>

      {/* ======= BASE VIDEO PART 1: 0 to cut point ======= */}
      <Sequence from={0} durationInFrames={sf(CUT_START)}>
        <AbsoluteFill>
          <Video
            src={staticFile('darkmist/edited-story.webm')}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <Vignette />
          <TopGradient />
        </AbsoluteFill>
      </Sequence>

      {/* ======= BASE VIDEO PART 2: after cut, resumes from CUT_END in source ======= */}
      <Sequence from={sf(CUT_START)} durationInFrames={sf(SOURCE_VIDEO_DURATION - CUT_END)}>
        <AbsoluteFill>
          <Video
            src={staticFile('darkmist/edited-story.webm')}
            startFrom={sf(CUT_END)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <Vignette />
          <TopGradient />
        </AbsoluteFill>
      </Sequence>

      {/* ======= SECTION TITLES ======= */}
      {SECTIONS.filter(s => s.label).map((section, i) => (
        <Sequence key={`section-${i}`} from={sf(section.start)} durationInFrames={sf(3)}>
          <SectionTitle label={section.label} sublabel={section.sublabel} />
        </Sequence>
      ))}

      {/* ======= LOWER THIRD ======= */}
      <Sequence from={sf(LOWER_THIRD.start)} durationInFrames={sf(LOWER_THIRD.duration)}>
        <LowerThirdBar name={LOWER_THIRD.name} title={LOWER_THIRD.title} />
      </Sequence>

      {/* ======= STAT / QUOTE OVERLAYS ======= */}
      {STATS.map((stat, i) => (
        <Sequence key={`stat-${i}`} from={sf(stat.start)} durationInFrames={sf(4)}>
          <StatOverlay text={stat.text} subtext={stat.subtext} style={stat.style} />
        </Sequence>
      ))}

      {/* ======= CAPTIONS ======= */}
      <Sequence from={0} durationInFrames={sf(VIDEO_DURATION)}>
        <Captions />
      </Sequence>

      {/* ======= OUTRO ======= */}
      <Sequence from={sf(OUTRO_START)} durationInFrames={sf(OUTRO_DURATION)}>
        <OutroCard />
      </Sequence>
    </AbsoluteFill>
  );
};

export default FounderStory;
