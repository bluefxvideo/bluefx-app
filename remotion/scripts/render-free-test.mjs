// Local test: re-renders saved free video ad props with the SAMPLE stamp and stitches the shared end clip the way
// server.js does. Usage: node scripts/render-free-test.mjs <props.json> <out.mp4>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

const [propsFile, out] = process.argv.slice(2);
const { props, gender } = JSON.parse(fs.readFileSync(propsFile, 'utf8'));
const inputProps = { ...props, watermark: { stamp: true, label: 'SAMPLE', site: 'bluefx.net', endClip: gender === 'female' ? 'female' : 'male' } };
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const serveUrl = await bundle({ entryPoint: path.join(root, 'src/Root.jsx'), publicDir: path.join(root, 'public') });
const composition = await selectComposition({ serveUrl, id: 'SmartVideo', inputProps });
const started = Date.now();
const raw = out.replace(/\.mp4$/, '.raw.mp4');
if (!fs.existsSync(raw)) await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: raw, inputProps, scale: 2 / 3, jpegQuality: 80, concurrency: 4 });
console.log('rendered in', Math.round((Date.now() - started) / 1000), 's');
const clip = path.join(root, 'public/brand', `endclip-${inputProps.watermark.endClip}.mp4`);
const list = out.replace(/\.mp4$/, '.txt');
fs.writeFileSync(list, `file '${raw}'\nfile '${clip}'\n`);
const joined = out.replace(/\.mp4$/, '.joined.mp4');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', joined]);
fs.renameSync(joined, out); fs.rmSync(list);
console.log('stitched', out);
