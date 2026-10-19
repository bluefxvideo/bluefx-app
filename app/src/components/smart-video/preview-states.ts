/** The states the dev preview of Make a Video Ad can show (app/dev-preview/make-video-ad). */
export const PREVIEW_STATES = [
  { id: 'start', label: 'First screen' },
  { id: 'website', label: 'Website typed, 2 photos' },
  { id: 'options', label: 'More options open' },
  { id: 'uploading', label: 'Sending photos' },
  { id: 'making', label: 'Being made' },
  { id: 'slow', label: 'Taking longer than usual' },
  { id: 'ready', label: 'Ready' },
  { id: 'presenter', label: 'Change asks for a presenter' },
  { id: 'change-making', label: 'Change being made' },
  { id: 'changed', label: 'Changed version (2 versions)' },
  { id: 'failed', label: 'Could not be made' },
  { id: 'change-failed', label: 'Change did not go through' },
  { id: 'free-making', label: 'Free ad still being made' },
  { id: 'free-arriving', label: 'Free ad: watermark coming off' },
] as const;
export type PreviewState = (typeof PREVIEW_STATES)[number]['id'];
