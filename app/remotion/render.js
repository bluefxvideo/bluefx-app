import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function renderVideo() {
  console.log('Starting render...');
  
  // The composition you want to render
  const compositionId = 'MyVideo';
  
  // You only have to create a bundle once, and you may reuse it
  // for multiple renders that you can parametrize using input props.
  console.log('Creating bundle...');
  const bundleLocation = await bundle({
    entryPoint: path.resolve(__dirname, './src/index.js'),
    // If you have a webpack override in remotion.config.ts, pass it here as well.
    webpackOverride: (config) => config,
  });
  
  console.log('Bundle created at:', bundleLocation);
  
  // Parametrize the video by passing props to your component.
  const inputProps = {
    titleText: 'Hello from Server-Side Rendering!',
    titleColor: 'white',
  };
  
  // Get the composition you want to render. Pass `inputProps` if you
  // want to customize the duration or other metadata.
  console.log('Selecting composition...');
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps,
  });
  
  console.log('Composition selected:', composition);
  
  // Render the video. Pass the same `inputProps` again
  // if your video is parametrized with data.
  console.log('Starting video render...');
  const outputLocation = `output/${compositionId}.mp4`;
  
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation,
    inputProps,
    logLevel: 'info',
    onProgress: (progress) => {
      console.log(`Render progress: ${Math.round(progress * 100)}%`);
    },
  });
  
  console.log('Render done!');
  console.log('Video saved to:', outputLocation);
}

// Run the render
renderVideo().catch(console.error); 