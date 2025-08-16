import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { MyVideo } from './MyVideo.js';
import { ScriptToVideo } from './ScriptToVideo.js';
import { VideoEditor } from './VideoEditor.js';

/**
 * Remotion Root - Register all compositions here
 */
export const RemotionRoot = () => {
  return (
    <>
      {/* Basic video composition */}
      <Composition
        id="MyVideo"
        component={MyVideo}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          titleText: "Welcome to Remotion",
          titleColor: "black",
        }}
      />

      {/* Script-to-Video composition */}
      <Composition
        id="ScriptToVideo"
        component={ScriptToVideo}
        durationInFrames={300}
        fps={30}
        width={720}
        height={1280}
        defaultProps={{
          headline: 'Default Video Title',
          segments: [
            {
              text: 'This is a default segment',
              startTime: 0,
              endTime: 3,
              duration: 3,
              wordTimings: [],
            },
          ],
          imageUrls: { 0: 'https://via.placeholder.com/720x1280/3B82F6/ffffff?text=Default+Image' },
          audioUrl: '',
          totalDuration: 3,
          aspectRatio: '9:16',
          dimensions: { width: 720, height: 1280 },
        }}
      />

      {/* Video Editor composition - handles editor data */}
      <Composition
        id="VideoEditor"
        component={VideoEditor}
        durationInFrames={900} // Default 30 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          audioLayers: [],
          imageLayers: [],
          videoLayers: [],
          textLayers: [],
          captionLayers: [],
          composition: {
            id: 'video-composition',
            width: 1920,
            height: 1080,
            fps: 30,
            durationInFrames: 900
          }
        }}
        // Dynamic composition properties based on input
        calculateMetadata={({ props }) => {
          return {
            durationInFrames: props.composition?.durationInFrames || 900,
            fps: props.composition?.fps || 30,
            width: props.composition?.width || 1920,
            height: props.composition?.height || 1080,
          };
        }}
      />
    </>
  );
};

// Register the root with Remotion
registerRoot(RemotionRoot);

export default RemotionRoot;