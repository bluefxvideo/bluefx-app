'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  Sparkles,
  RefreshCw,
  FileText,
  Linkedin,
  ArrowLeft,
} from 'lucide-react';
import { useYouTubeRepurposeStore, type SocialPlatform } from './store/youtube-repurpose-store';

const PLATFORM_CONFIG: Record<SocialPlatform, {
  name: string;
  icon: React.ReactNode;
  maxLength: number;
  color: string;
}> = {
  linkedin: {
    name: 'LinkedIn',
    icon: <Linkedin className="h-4 w-4" />,
    maxLength: 3000,
    color: 'text-blue-700',
  },
};

export function Step2Review() {
  const isGenerating = useYouTubeRepurposeStore((s) => s.isGenerating);
  const generationStatus = useYouTubeRepurposeStore((s) => s.generationStatus);
  const blogPost = useYouTubeRepurposeStore((s) => s.blogPost);
  const socialContent = useYouTubeRepurposeStore((s) => s.socialContent);
  const isRegenerating = useYouTubeRepurposeStore((s) => s.isRegenerating);
  const error = useYouTubeRepurposeStore((s) => s.error);

  const generateAllContent = useYouTubeRepurposeStore((s) => s.generateAllContent);
  const updateBlogPostField = useYouTubeRepurposeStore((s) => s.updateBlogPostField);
  const updateSocialCaptionText = useYouTubeRepurposeStore((s) => s.updateSocialCaptionText);
  const updateSocialHashtags = useYouTubeRepurposeStore((s) => s.updateSocialHashtags);
  const regeneratePlatform = useYouTubeRepurposeStore((s) => s.regeneratePlatform);
  const regenerateBlogPost = useYouTubeRepurposeStore((s) => s.regenerateBlogPost);
  const prevStep = useYouTubeRepurposeStore((s) => s.prevStep);
  const nextStep = useYouTubeRepurposeStore((s) => s.nextStep);
  const canProceedToStep3 = useYouTubeRepurposeStore((s) => s.canProceedToStep3);

  // If no content generated yet, show the generate button
  if (!blogPost && !isGenerating) {
    return (
      <div className="space-y-6">
        <Card className="p-8 text-center">
          <Sparkles className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Generate Content</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            AI will create an SEO-optimized blog post and platform-specific social media captions from your video transcript.
          </p>
          <Button size="lg" onClick={generateAllContent}>
            <Sparkles className="mr-2 h-4 w-4" />
            Generate Blog Post & Social Captions
          </Button>
          {error && (
            <p className="mt-4 text-sm text-red-500">{error}</p>
          )}
        </Card>

        <div className="flex justify-start">
          <Button variant="outline" onClick={prevStep}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isGenerating) {
    return (
      <Card className="p-8 text-center">
        <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
        <h3 className="text-lg font-semibold mb-2">Generating Content</h3>
        <p className="text-muted-foreground">{generationStatus || 'Working...'}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Blog Post Section */}
      {blogPost && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <Label className="text-lg font-semibold">Blog Post</Label>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={regenerateBlogPost}
              disabled={isRegenerating === 'blog'}
            >
              {isRegenerating === 'blog' ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-3 w-3" />
              )}
              Regenerate
            </Button>
          </div>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <Label htmlFor="blog-title" className="text-sm text-muted-foreground">
                Title ({blogPost.title.length}/60)
              </Label>
              <Input
                id="blog-title"
                value={blogPost.title}
                onChange={(e) => updateBlogPostField('title', e.target.value)}
              />
            </div>

            {/* SEO Title */}
            <div>
              <Label htmlFor="seo-title" className="text-sm text-muted-foreground">
                SEO Title (Yoast) ({blogPost.seoTitle.length}/60)
              </Label>
              <Input
                id="seo-title"
                value={blogPost.seoTitle}
                onChange={(e) => updateBlogPostField('seoTitle', e.target.value)}
              />
            </div>

            {/* Focus Keyphrase */}
            <div>
              <Label htmlFor="focus-kw" className="text-sm text-muted-foreground">
                Focus Keyphrase
              </Label>
              <Input
                id="focus-kw"
                value={blogPost.focusKeyphrase}
                onChange={(e) => updateBlogPostField('focusKeyphrase', e.target.value)}
              />
            </div>

            {/* Meta Description */}
            <div>
              <Label htmlFor="meta-desc" className="text-sm text-muted-foreground">
                Meta Description ({blogPost.metaDescription.length}/155)
              </Label>
              <Textarea
                id="meta-desc"
                value={blogPost.metaDescription}
                onChange={(e) => updateBlogPostField('metaDescription', e.target.value)}
                rows={2}
              />
            </div>

            {/* Content Preview */}
            <div>
              <Label className="text-sm text-muted-foreground">
                Content ({Math.round(blogPost.content.replace(/<[^>]+>/g, '').split(/\s+/).length)} words)
              </Label>
              <div className="mt-1 rounded-lg border p-4 max-h-96 overflow-y-auto prose prose-sm dark:prose-invert">
                <div dangerouslySetInnerHTML={{ __html: blogPost.content }} />
              </div>
            </div>

            {/* Raw HTML editor toggle */}
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Edit raw HTML
              </summary>
              <Textarea
                value={blogPost.content}
                onChange={(e) => updateBlogPostField('content', e.target.value)}
                rows={12}
                className="mt-2 font-mono text-xs"
              />
            </details>
          </div>
        </Card>
      )}

      {/* Social Media Captions */}
      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(PLATFORM_CONFIG) as SocialPlatform[]).map((platform) => {
          const config = PLATFORM_CONFIG[platform];
          const content = socialContent[platform];
          const isRegeneratingThis = isRegenerating === platform;

          return (
            <Card key={platform} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className={`flex items-center gap-2 ${config.color}`}>
                  {config.icon}
                  <Label className="font-semibold">{config.name}</Label>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => regeneratePlatform(platform)}
                  disabled={isRegeneratingThis}
                  className="h-7 w-7 p-0"
                >
                  {isRegeneratingThis ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                </Button>
              </div>

              {content ? (
                <div className="space-y-3">
                  <div>
                    <Textarea
                      value={content.caption}
                      onChange={(e) => updateSocialCaptionText(platform, e.target.value)}
                      rows={5}
                      className="text-sm"
                    />
                    <p className={`text-xs mt-1 ${
                      content.caption.length > config.maxLength ? 'text-red-500' : 'text-muted-foreground'
                    }`}>
                      {content.caption.length}/{config.maxLength}
                    </p>
                  </div>

                  {/* Hashtags */}
                  <div>
                    <Input
                      value={content.hashtags.map(h => `#${h}`).join(' ')}
                      onChange={(e) => {
                        const tags = e.target.value
                          .split(/\s+/)
                          .map(t => t.replace(/^#/, ''))
                          .filter(Boolean);
                        updateSocialHashtags(platform, tags);
                      }}
                      placeholder="#hashtags"
                      className="text-sm"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Not generated yet
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button size="lg" onClick={nextStep} disabled={!canProceedToStep3()}>
          Continue to Publish
        </Button>
      </div>
    </div>
  );
}
