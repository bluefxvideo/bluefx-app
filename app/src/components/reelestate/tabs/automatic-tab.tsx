'use client';

import { useRef, useState } from 'react';
import { Loader2, RectangleHorizontal, RectangleVertical, Upload, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { TabContentWrapper, TabBody, TabFooter } from '@/components/tools/tab-content-wrapper';
import { StandardStep } from '@/components/tools/standard-step';
import { cn } from '@/lib/utils';
import { cleanLink } from '@/lib/smart-video/link';
import { LISTING_LENGTHS, LISTING_MIN_PHOTOS, listingPhotoCount } from '@/lib/smart-video/listing';
import { LISTING_CLIP_CREDITS } from '@/lib/smart-video/pricing';
import type { VideoFormat } from '@/lib/smart-video/types';
import type { useSmartVideo } from '@/components/smart-video/hooks/use-smart-video';
import { FileThumb, SoundSwitches } from '@/components/smart-video/shared';
import { AutomaticVideoTips } from '../reelestate-examples';

const FORMATS: { value: VideoFormat; label: string; hint: string; Icon: typeof RectangleVertical }[] = [
  { value: 'vertical', label: 'Vertical', hint: 'Reels, TikTok, Shorts', Icon: RectangleVertical },
  { value: 'horizontal', label: 'Horizontal', hint: 'YouTube, websites', Icon: RectangleHorizontal },
];

// "30 seconds shows 7 photos, 45 seconds 11, 60 seconds 16."
const PHOTOS_PER_LENGTH = LISTING_LENGTHS.map((seconds, i) => `${seconds} seconds${i === 0 ? ' shows' : ''} ${listingPhotoCount(seconds, 99)}${i === 0 ? ' photos' : ''}`).join(', ');

/**
 * ReelEstate's automatic listing video: a link or photos and the facts in, a
 * finished video out. One screen and one button; the step-by-step maker stays
 * in the next tab for people who want to place every photo by hand.
 */
export function AutomaticTab({ video }: { video: ReturnType<typeof useSmartVideo> }) {
  const picker = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const busy = video.isBusy;
  const total = video.credits + video.clipCredits;

  return (
    <TabContentWrapper>
      <TabBody>
        <div className="mb-4">
          <AutomaticVideoTips />
        </div>

        <StandardStep stepNumber={1} title="The listing" description="Paste the listing link, or add your own photos">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="listing-link">Listing link</Label>
              <Input
                id="listing-link"
                value={video.link}
                onChange={(e) => video.setLink(e.target.value)}
                onBlur={(e) => video.setLink(cleanLink(e.target.value))}
                placeholder="https://www.zillow.com/homedetails/..."
                disabled={busy}
              />
              <p className="text-xs text-muted-foreground">
                Zillow or Realtor.com. The photos, the address, the price and the figures come from the page.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Or your photos</Label>
              <button
                type="button"
                onClick={() => picker.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  video.addFiles(Array.from(e.dataTransfer.files));
                }}
                disabled={busy}
                className={cn(
                  'w-full rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground hover:bg-muted/50 disabled:opacity-50',
                  dragging && 'border-primary bg-primary/10 text-foreground',
                )}
              >
                <Upload className="mx-auto mb-1.5 h-5 w-5" />
                Drop photos here or click to choose. {LISTING_MIN_PHOTOS} to 15 photos, one per room.
              </button>
              <input
                ref={picker}
                type="file"
                multiple
                accept="image/*,.heic"
                className="hidden"
                onChange={(e) => {
                  video.addFiles(Array.from(e.target.files || []));
                  e.target.value = '';
                }}
              />
              {video.files.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {video.files.map((file, i) => (
                    <FileThumb key={`${file.name}-${file.size}-${i}`} file={file} disabled={busy} onRemove={() => video.removeFile(i)} />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="listing-facts">Facts and contact</Label>
              <Textarea
                id="listing-facts"
                value={video.brief}
                onChange={(e) => video.setBrief(e.target.value)}
                placeholder={
                  'Address, price, bedrooms, bathrooms, square feet. What makes the home special. Open house day and time. Your name and phone number.\n\nWith a link, write only what the listing page does not show: your name, your phone number, the open house.'
                }
                className="min-h-[130px]"
                disabled={busy}
              />
            </div>
          </div>
        </StandardStep>

        <StandardStep stepNumber={2} title="The video" description="Length, shape and motion">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Length</Label>
              <div className="grid grid-cols-3 gap-2">
                {LISTING_LENGTHS.map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    onClick={() => video.setListingSeconds(seconds)}
                    disabled={busy}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50',
                      video.listingSeconds === seconds ? 'border-primary bg-primary/10' : 'hover:bg-muted/50',
                    )}
                  >
                    {seconds} seconds
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {PHOTOS_PER_LENGTH}.
                {!video.link.trim() && video.files.length > video.listingPhotos && ` You added ${video.files.length}: this length shows the best ${video.listingPhotos}.`}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Shape</Label>
              <div className="grid grid-cols-2 gap-2">
                {FORMATS.map(({ value, label, hint, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => video.setFormat(value)}
                    disabled={busy}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm disabled:opacity-50',
                      video.format === value ? 'border-primary bg-primary/10' : 'hover:bg-muted/50',
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span>
                      <span className="block font-medium">{label}</span>
                      <span className="block text-xs text-muted-foreground">{hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
              <div className="space-y-1">
                <Label htmlFor="listing-animate">Animate the photos</Label>
                <p className="text-xs text-muted-foreground">
                  {video.animate
                    ? `Every photo becomes a moving clip: the camera pushes slowly into the room. ${LISTING_CLIP_CREDITS} credits per photo.`
                    : 'Off: still photos with a slow zoom. No extra credits.'}
                </p>
              </div>
              <Switch id="listing-animate" checked={video.animate} onCheckedChange={video.setAnimate} disabled={busy} />
            </div>
          </div>
        </StandardStep>

        <StandardStep stepNumber={3} title="Sound" description="Voice-over and music, each on or off">
          <SoundSwitches
            id="listing-sound"
            voiceOver={video.voiceOver}
            music={video.music}
            onVoiceOver={video.setVoiceOver}
            onMusic={video.setMusic}
            disabled={busy}
          />
        </StandardStep>
      </TabBody>

      <TabFooter>
        <Button onClick={video.start} disabled={busy} className="h-12 w-full font-medium" size="lg">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
          Make the listing video · {total} credits
        </Button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {video.animate
            ? `${video.credits} credits for the video and ${LISTING_CLIP_CREDITS} for each of ${video.listingPhotos} animated photos. ${
                video.link.trim() ? 'A listing with fewer photos costs less, and a' : 'A'
              } photo that cannot be animated is not charged.`
            : `${video.credits} credits. Ready in about 5 minutes.`}
        </p>
      </TabFooter>
    </TabContentWrapper>
  );
}
