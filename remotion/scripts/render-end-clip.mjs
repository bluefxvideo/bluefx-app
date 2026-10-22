// Renders the free video ad's shared end clip (SmartVideo.jsx SampleEndClip) once per voice, at the free size
// (scale 2/3 = 720x1280) and with server.js's own render settings (h264, jpeg quality 80), so server.js can stitch it
// to every free video ad without re-encoding. Run after changing the clip: node scripts/render-end-clip.mjs
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const serveUrl = await bundle({ entryPoint: path.join(root, 'src/Root.jsx'), publicDir: path.join(root, 'public') });
for (const voice of ['male', 'female']) {
  const inputProps = { voice };
  const composition = await selectComposition({ serveUrl, id: 'SampleEndClip', inputProps });
  const outputLocation = path.join(root, 'public/brand', `endclip-${voice}.mp4`);
  await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation, inputProps, scale: 2 / 3, jpegQuality: 80 });
  console.log('rendered', outputLocation);
}
