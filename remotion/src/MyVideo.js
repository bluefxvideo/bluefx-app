import React from 'react';
import { 
  interpolate, 
  useCurrentFrame, 
  useVideoConfig,
  getInputProps 
} from 'remotion';

export const MyVideo = () => {
  const frame = useCurrentFrame();
  const videoConfig = useVideoConfig();
  const inputProps = getInputProps();

  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const scale = interpolate(frame, [0, 30], [0.8, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        flex: 1,
        textAlign: 'center',
        fontSize: '7em',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        color: inputProps.titleColor || 'white',
        transform: `scale(${scale})`,
        opacity,
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
      }}
    >
      {inputProps.titleText || 'Hello World'}
    </div>
  );
}; 