"use client";

import { Badge } from "@/components/ui/badge";
import { useState, type VideoHTMLAttributes } from "react";

export function CinematographerExample() {
  const [showControls, setShowControls] = useState(false);
  
  // Featured example: vertical UGC-style ad generated with Video Maker
  const featuredVideo = {
    title: "UGC-Style Ad",
    description: "AI presenter with natural emotion",
    prompt: "UGC-style ad: a woman in a bright kitchen talks to camera about a supplement, going from frustrated to excited",
    src: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/videos/placeholders/video-maker-example.mp4",
  };

  return (
    <div className="w-full">
      <div className="space-y-3">
        {/* Video Player - Matching Generated Style */}
        <div
          className="relative aspect-[9/16] max-w-[260px] mx-auto rounded-lg overflow-hidden border border-zinc-700/50 shadow-xl bg-black group"
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
        >
          <video
            src={featuredVideo.src}
            autoPlay
            loop
            muted
            playsInline
            controls={showControls}
            preload="metadata"
            // 'loading' is not in React's VideoHTMLAttributes; pass through unchanged
            {...({ loading: "lazy" } as unknown as VideoHTMLAttributes<HTMLVideoElement>)}
            className="w-full h-full object-cover"
            onLoadStart={() => console.log('Loading cinematographer example video')}
          />
          {/* Badge in Top Right - Matching Generated Position */}
          <div className="absolute top-3 right-3">
            <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 shadow-lg">
              <span className="text-xs font-bold">Example</span>
            </Badge>
          </div>
        </div>
        
        {/* Sample Prompt Text */}
        <p className="text-xs text-zinc-400 text-center">
          Sample: "{featuredVideo.prompt}"
        </p>
      </div>
    </div>
  );
}