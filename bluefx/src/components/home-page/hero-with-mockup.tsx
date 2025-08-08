'use client';

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Mockup } from "./mockup"

interface HeroWithMockupProps {
  title: React.ReactNode
  description: React.ReactNode
  primaryCta?: {
    text: string
    href: string
  }
  secondaryCta?: {
    text: string
    href: string
  }
  youtubeVideoId?: string
  className?: string
}

export function HeroWithMockup({
  title,
  description,
  primaryCta = {
    text: "Get Started",
    href: "/get-started",
  },
  secondaryCta = {
    text: "GitHub",
    href: "https://github.com/your-repo",
  },
  youtubeVideoId,
  className,
}: HeroWithMockupProps) {
  return (
    <section
      className={cn(
        "relative bg-black text-white",
        "py-4 px-4 md:py-8 lg:py-12",
        "overflow-hidden",
        className,
      )}
      style={{
        backgroundImage: 'radial-gradient(circle, hsl(var(--muted-foreground) / 0.15) 1px, transparent 1px)',
        backgroundSize: '24px 24px'
      }}
    >
      <div className="relative mx-auto max-w-[1080px] flex flex-col gap-8 lg:gap-12">
        <div className="relative z-10 flex flex-col items-center gap-4 pt-2 md:pt-4 text-center lg:gap-6">
          {/* Limited Time Badge */}
          <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-900/20 border border-green-700/50 rounded-full">
            <span className="text-green-400">🚀</span>
            <span className="text-green-400 text-sm font-bold">Limited Time: Founding Member Pricing</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.0] text-gray-100 max-w-4xl">
            {title}
          </h1>

          {/* Description */}
          <p className="text-2xl text-gray-400 max-w-3xl mx-auto mb-12">
            {description}
          </p>


          {/* Video Mockup */}
          {youtubeVideoId && (
            <div className="relative w-full pt-6 px-4 sm:px-6 lg:px-8">
              <div className="relative max-w-4xl mx-auto">
                
                <Mockup
                  className={cn(
                    "animate-[appear_0.5s_ease-out_forwards] opacity-0 [animation-delay:700ms]",
                    "shadow-[0px_7px_29px_0px_rgba(0,0,0,0.15),0px_25px_52px_0px_rgba(0,0,0,0.12),0px_56px_70px_0px_rgba(0,0,0,0.07),0px_100px_82px_0px_rgba(0,0,0,0.02)]",
                    "border-primary/10 dark:border-primary/5",
                    "rounded-3xl overflow-hidden",
                    "backdrop-blur-sm bg-background/5",
                  )}
                >
                  <div className="aspect-video w-full">
                    <iframe
                      src={`https://www.youtube.com/embed/${youtubeVideoId}`}
                      title="BlueFX AI Demo Video"
                      className="w-full h-full rounded-3xl"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </Mockup>
              </div>
            </div>
          )}

          {/* CTAs underneath video */}
          <div
            className="relative z-10 flex flex-col items-center gap-4 mt-6
            animate-[appear_0.5s_ease-out_forwards] opacity-0 [animation-delay:1000ms]"
          >
            <Button
              asChild
              size="lg"
              className={cn(
                "bg-blue-600 hover:bg-blue-700 text-white px-10 py-5 text-lg font-semibold rounded-lg",
                "shadow-lg hover:shadow-xl transition-all",
              )}
            >
              <a href={primaryCta.href}>{primaryCta.text} →</a>
            </Button>

            <p className="text-sm text-gray-400">
              Then $37/month • Cancel anytime • No hidden fees
            </p>

            <Button
              asChild
              size="lg"
              variant="outline"
              className={cn(
                "px-10 py-5 text-lg font-medium rounded-lg border border-gray-600 hover:border-gray-400 text-white hover:bg-gray-800/50 transition-all bg-transparent",
              )}
            >
              <a href={secondaryCta.href} className="flex items-center gap-2">
                {secondaryCta.text}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
            </Button>
          </div>

          {/* Money Back Guarantee Box */}
          <div className="mt-12 bg-secondary/30 border border-border rounded-2xl p-6 max-w-2xl mx-auto
                          shadow-[0px_3px_8px_-1px_rgba(0,0,0,0.1),0px_7px_15px_0px_rgba(0,0,0,0.1)]
                          animate-[appear_0.5s_ease-out_forwards] opacity-0 [animation-delay:1200ms]">
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-2xl">💯</span>
              <h3 className="text-lg font-semibold text-foreground">30-Day Money-Back Guarantee</h3>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed text-center">
              Try everything risk-free • Cancel anytime • Keep what you create
            </p>
          </div>
        </div>
      </div>

    </section>
  )
}