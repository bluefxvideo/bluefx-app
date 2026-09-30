/**
 * Download a public file (an example photo or clip) into a File, so it can go
 * into a form exactly like a file the user picked. Throws when the download fails.
 */
export async function urlToFile(url: string, name: string, fallbackType: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  const blob = await res.blob();
  return new File([blob], name, { type: blob.type || fallbackType });
}
