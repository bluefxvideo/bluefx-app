/**
 * Persistent library of AI-generated images for the editor's Photos panel.
 *
 * The AI Images grid derives from timeline track items, so a regenerated
 * image (which swaps a track item's src in place) would otherwise vanish
 * from view — this keeps every generation around as its own library entry,
 * per project, in localStorage. Capped and deduped by src.
 */

export interface LibraryImage {
  id: string;
  src: string;
  prompt?: string;
  createdAt: string;
}

export const AI_LIBRARY_UPDATED_EVENT = 'rve-ai-library-updated';
const MAX_ENTRIES = 50;

const storageKey = (): string => {
  try {
    const params = new URLSearchParams(window.location.search);
    const videoId = params.get('videoId') || params.get('listingId') || params.get('storyboardId');
    return `rve-ai-image-library:${videoId || 'global'}`;
  } catch {
    return 'rve-ai-image-library:global';
  }
};

export const getLibraryImages = (): LibraryImage[] => {
  try {
    const raw = localStorage.getItem(storageKey());
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const addLibraryImage = (img: { src: string; prompt?: string }): void => {
  if (!img.src) return;
  try {
    const list = getLibraryImages().filter((i) => i.src !== img.src);
    list.unshift({
      id: `lib-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      src: img.src,
      prompt: img.prompt,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem(storageKey(), JSON.stringify(list.slice(0, MAX_ENTRIES)));
    window.dispatchEvent(new CustomEvent(AI_LIBRARY_UPDATED_EVENT));
  } catch (error) {
    console.warn('Could not persist AI library image:', error);
  }
};
