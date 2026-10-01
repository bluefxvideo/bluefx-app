import sharp from 'sharp';

/**
 * Which addresses the server may fetch on behalf of a Clone Studio project.
 *
 * The addresses of frames, photos, pictures and clips come from the project row, and a
 * signed-in user can write their own row through the database API. The server, the picture
 * and video engines and the render server all fetch these addresses, so only files in our
 * own storage, or on the video engine's delivery host (where a clip stays when storing it
 * failed), are ever fetched.
 */
export function ownFile(url: string): string {
  try {
    const { protocol, hostname } = new URL(url);
    const ours = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').hostname;
    if (protocol === 'https:' && (hostname === ours || hostname === 'fal.media' || hostname.endsWith('.fal.media'))) return url;
  } catch {
    // not an address at all
  }
  throw new Error('A scene points to a file that is not part of this project');
}

/** True for an address ownFile accepts. */
export function isOwnFile(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    ownFile(url);
    return true;
  } catch {
    return false;
  }
}

const PRIVATE_NAME = /(^|\.)(localhost|local|internal|lan|home|test|invalid)$/i;

/** An IPv4 address of this machine, a private network, a link-local range or a reserved block. */
function privateAddress(host: string): boolean {
  const parts = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!parts) return false;
  const [a, b] = [Number(parts[1]), Number(parts[2])];
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

/**
 * A link a client typed, as an address the server may read: a public web page. An address
 * that names this machine or a private network is refused, whatever the client's reason.
 */
export function publicLink(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error('That link does not look right');
  }
  const host = url.hostname;
  const publicHost = host.includes('.') && !host.includes(':') && !host.startsWith('[') && !PRIVATE_NAME.test(host) && !privateAddress(host);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || !publicHost) {
    throw new Error('That link cannot be read. Paste the address of a public web page.');
  }
  return url.href;
}

/** A picture small enough to send to a language model by the dozen, as base64 JPEG. Only our own files are read. */
export async function smallPicture(url: string, side = 768): Promise<string> {
  const res = await fetch(ownFile(url), { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`A picture could not be loaded (${res.status})`);
  const picture = await sharp(Buffer.from(await res.arrayBuffer())).rotate().resize(side, side, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  return picture.toString('base64');
}
