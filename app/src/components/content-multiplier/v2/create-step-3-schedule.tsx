'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  Send,
  Calendar,
  Clock,
  Sparkles,
  Loader2,
  Check,
  AlertCircle,
  Globe,
  Lock,
  Eye,
} from 'lucide-react';
import {
  useContentMultiplierV2Store,
  useSelectedPlatforms,
  useScheduleOption,
  PLATFORM_CONFIGS,
  BEST_POSTING_TIMES,
  type SocialPlatform,
  type ScheduleOption,
  type YouTubePrivacyStatus,
} from '../store/content-multiplier-v2-store';
import {
  TikTokIcon,
  InstagramIcon,
  YouTubeIcon,
  XIcon,
  LinkedInIcon,
  FacebookIcon,
} from '../components/brand-icons';

const PlatformIconMap: Record<SocialPlatform, React.FC<{ className?: string; size?: number }>> = {
  tiktok: TikTokIcon,
  instagram: InstagramIcon,
  youtube: YouTubeIcon,
  twitter: XIcon,
  linkedin: LinkedInIcon,
  facebook: FacebookIcon,
};

const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  tiktok: 'bg-black',
  instagram: 'bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400',
  youtube: 'bg-red-600',
  twitter: 'bg-black',
  linkedin: 'bg-blue-700',
  facebook: 'bg-blue-600',
};

// Helper to format date for datetime-local input
function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Helper to format display time
function formatDisplayTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (isToday) return `Today ${timeStr}`;
  if (isTomorrow) return `Tomorrow ${timeStr}`;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function CreateStep3Schedule() {
  // Store state
  const selectedPlatforms = useSelectedPlatforms();
  const scheduleOption = useScheduleOption();
  const platformSchedules = useContentMultiplierV2Store((s) => s.platformSchedules);
  const isPosting = useContentMultiplierV2Store((s) => s.isPosting);
  const youtubePrivacy = useContentMultiplierV2Store((s) => s.youtubePrivacy);
  const postingProgress = useContentMultiplierV2Store((s) => s.postingProgress);
  const error = useContentMultiplierV2Store((s) => s.error);

  // Store actions
  const setScheduleOption = useContentMultiplierV2Store((s) => s.setScheduleOption);
  const setPlatformSchedule = useContentMultiplierV2Store((s) => s.setPlatformSchedule);
  const setAllPlatformSchedules = useContentMultiplierV2Store((s) => s.setAllPlatformSchedules);
  const setBestTimesForAll = useContentMultiplierV2Store((s) => s.setBestTimesForAll);
  const submitPosts = useContentMultiplierV2Store((s) => s.submitPosts);
  const prevStep = useContentMultiplierV2Store((s) => s.prevStep);
  const canSubmit = useContentMultiplierV2Store((s) => s.canSubmit);
  const setYouTubePrivacy = useContentMultiplierV2Store((s) => s.setYouTubePrivacy);

  // Check if YouTube is selected
  const hasYouTube = selectedPlatforms.includes('youtube');

  // Local state for single time picker
  const [singleScheduleTime, setSingleScheduleTime] = useState(() => {
    const defaultTime = new Date();
    defaultTime.setHours(defaultTime.getHours() + 1, 0, 0, 0);
    return formatDateTimeLocal(defaultTime);
  });

  // Handle schedule option change
  const handleOptionChange = (value: ScheduleOption) => {
    setScheduleOption(value);

    if (value === 'best_time') {
      setBestTimesForAll();
    } else if (value === 'scheduled') {
      setAllPlatformSchedules(new Date(singleScheduleTime).toISOString());
    }
  };

  // Handle single time change (applies to all platforms)
  const handleSingleTimeChange = (value: string) => {
    setSingleScheduleTime(value);
    setAllPlatformSchedules(new Date(value).toISOString());
  };

  // Handle individual platform time change
  const handlePlatformTimeChange = (platform: SocialPlatform, value: string) => {
    setPlatformSchedule(platform, {
      platform,
      scheduledTime: new Date(value).toISOString(),
      isBestTime: false,
    });
  };

  const canProceed = canSubmit();

  return (
    <div className="h-full flex flex-col gap-6">
      {/* Schedule Option Selection */}
      <div>
        <Label className="text-sm font-medium mb-4 block">
          When do you want to post?
        </Label>

        <RadioGroup
          value={scheduleOption}
          onValueChange={(value) => handleOptionChange(value as ScheduleOption)}
          className="space-y-3"
        >
          {/* Post Now */}
          <div className="flex items-center space-x-3">
            <RadioGroupItem value="now" id="now" />
            <Label
              htmlFor="now"
              className="flex items-center gap-2 cursor-pointer font-normal"
            >
              <Send className="w-4 h-4" />
              Post Now
              <span className="text-xs text-muted-foreground">
                (all platforms immediately)
              </span>
            </Label>
          </div>

          {/* Schedule */}
          <div className="flex items-center space-x-3">
            <RadioGroupItem value="scheduled" id="scheduled" />
            <Label
              htmlFor="scheduled"
              className="flex items-center gap-2 cursor-pointer font-normal"
            >
              <Calendar className="w-4 h-4" />
              Schedule
              <span className="text-xs text-muted-foreground">
                (pick times)
              </span>
            </Label>
          </div>

          {/* Best Times */}
          <div className="flex items-center space-x-3">
            <RadioGroupItem value="best_time" id="best_time" />
            <Label
              htmlFor="best_time"
              className="flex items-center gap-2 cursor-pointer font-normal"
            >
              <Sparkles className="w-4 h-4" />
              Best Times
              <span className="text-xs text-muted-foreground">
                (AI picks optimal times)
              </span>
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Schedule Times Table */}
      {scheduleOption !== 'now' && (
        <div className="flex-1 overflow-y-auto">
          {/* Single time picker for "scheduled" option */}
          {scheduleOption === 'scheduled' && (
            <div className="mb-4">
              <Label className="text-sm text-muted-foreground mb-2 block">
                Set time for all platforms:
              </Label>
              <Input
                type="datetime-local"
                value={singleScheduleTime}
                onChange={(e) => handleSingleTimeChange(e.target.value)}
                min={formatDateTimeLocal(new Date())}
              />
            </div>
          )}

          {/* Platform schedule list */}
          <Card className="divide-y">
            {selectedPlatforms.map((platform) => {
              const config = PLATFORM_CONFIGS[platform];
              const schedule = platformSchedules[platform];
              const Icon = PlatformIconMap[platform];

              return (
                <div
                  key={platform}
                  className="flex items-center justify-between p-4"
                >
                  {/* Platform info */}
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${PLATFORM_COLORS[platform]} flex items-center justify-center`}>
                      <Icon className="text-white" size={18} />
                    </div>
                    <span className="font-medium">{config.name}</span>
                  </div>

                  {/* Time display/input */}
                  <div className="flex items-center gap-2">
                    {scheduleOption === 'best_time' ? (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">
                          {schedule?.scheduledTime
                            ? formatDisplayTime(schedule.scheduledTime)
                            : 'Calculating...'
                          }
                        </span>
                        {schedule?.isBestTime && (
                          <Sparkles className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                    ) : (
                      <Input
                        type="datetime-local"
                        value={schedule?.scheduledTime
                          ? formatDateTimeLocal(new Date(schedule.scheduledTime))
                          : singleScheduleTime
                        }
                        onChange={(e) => handlePlatformTimeChange(platform, e.target.value)}
                        min={formatDateTimeLocal(new Date())}
                        className="w-auto text-sm"
                      />
                    )}
                    <Check className="w-4 h-4 text-green-500" />
                  </div>
                </div>
              );
            })}
          </Card>

          {/* Best times explanation */}
          {scheduleOption === 'best_time' && (
            <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Times are optimized based on typical engagement patterns for each platform
            </p>
          )}
        </div>
      )}

      {/* Summary for "Post Now" */}
      {scheduleOption === 'now' && (
        <div className="flex-1 space-y-4">
          {/* YouTube Privacy Setting */}
          {hasYouTube && (
            <Card className="p-4">
              <Label className="text-sm font-medium mb-3 block">
                YouTube Video Privacy
              </Label>
              <Select
                value={youtubePrivacy}
                onValueChange={(value) => setYouTubePrivacy(value as YouTubePrivacyStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      <span>Public</span>
                      <span className="text-xs text-muted-foreground">- Anyone can see</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="unlisted">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      <span>Unlisted</span>
                      <span className="text-xs text-muted-foreground">- Only with link</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="private">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      <span>Private</span>
                      <span className="text-xs text-muted-foreground">- Only you</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </Card>
          )}

          {/* Posting Progress */}
          {postingProgress.length > 0 ? (
            <Card className="p-4">
              <h4 className="font-medium mb-3">Posting Progress</h4>
              <div className="space-y-3">
                {postingProgress.map((progress) => {
                  const config = PLATFORM_CONFIGS[progress.platform];
                  const Icon = PlatformIconMap[progress.platform];

                  return (
                    <div key={progress.platform} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${PLATFORM_COLORS[progress.platform]} flex items-center justify-center`}>
                        <Icon className="text-white" size={14} />
                      </div>
                      <span className="text-sm flex-1">{config.name}</span>
                      <div className="flex items-center gap-2">
                        {progress.status === 'pending' && (
                          <span className="text-xs text-muted-foreground">Waiting...</span>
                        )}
                        {progress.status === 'posting' && (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                            <span className="text-xs text-blue-500">Uploading...</span>
                          </>
                        )}
                        {progress.status === 'done' && (
                          <>
                            <Check className="w-4 h-4 text-green-500" />
                            <span className="text-xs text-green-500">Posted!</span>
                          </>
                        )}
                        {progress.status === 'error' && (
                          <div className="flex flex-col items-end">
                            <div className="flex items-center gap-1">
                              <AlertCircle className="w-4 h-4 text-red-500" />
                              <span className="text-xs text-red-500">Failed</span>
                            </div>
                            {progress.message && (
                              <span className="text-xs text-red-400 max-w-48 truncate" title={progress.message}>
                                {progress.message}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {postingProgress.some(p => p.status === 'done' && p.message) && (
                <div className="mt-3 pt-3 border-t">
                  {postingProgress
                    .filter(p => p.status === 'done' && p.message)
                    .map(p => (
                      <a
                        key={p.platform}
                        href={p.message?.replace('Posted: ', '')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline block"
                      >
                        View on {PLATFORM_CONFIGS[p.platform].name}
                      </a>
                    ))}
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-4">
              <h4 className="font-medium mb-3">Ready to post to:</h4>
              <div className="space-y-2">
                {selectedPlatforms.map((platform) => {
                  const config = PLATFORM_CONFIGS[platform];
                  const Icon = PlatformIconMap[platform];

                  return (
                    <div key={platform} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${PLATFORM_COLORS[platform]} flex items-center justify-center`}>
                        <Icon className="text-white" size={14} />
                      </div>
                      <span className="text-sm">{config.name}</span>
                      <Check className="w-4 h-4 text-green-500 ml-auto" />
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Error display */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="pt-4 border-t space-y-3">
        {/* Navigation */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={prevStep} className="flex-1">
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={submitPosts}
            disabled={!canProceed || isPosting}
            className="flex-1"
          >
            {isPosting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {scheduleOption === 'now' ? 'Posting...' : 'Scheduling...'}
              </>
            ) : (
              <>
                {scheduleOption === 'now' ? (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Post Now
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4 mr-2" />
                    Schedule Posts
                  </>
                )}
              </>
            )}
          </Button>
        </div>

        {/* Save as draft */}
        <Button
          variant="ghost"
          className="w-full text-sm"
          onClick={() => useContentMultiplierV2Store.getState().saveDraft()}
        >
          Save as Draft
        </Button>
      </div>
    </div>
  );
}
