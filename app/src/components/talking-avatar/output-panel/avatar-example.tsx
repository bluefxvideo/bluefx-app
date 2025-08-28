"use client";

import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export function AvatarExample() {
  const [showControls, setShowControls] = useState(false);
  
  // Show the talking avatar video placeholder as an example
  const featuredVideo = {
    title: "AI Talking Avatar",
    description: "Professional avatar generation",
    prompt: "AI-powered digital avatar with natural speech synthesis and realistic lip-sync animation",
    src: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/videos/placeholders/talking-avatar.mp4",
  };

  return (
    <div className="w-full">
      <div className="space-y-3">
        {/* Video Player - Matching Generated Style */}
        <div 
          className="relative aspect-video rounded-lg overflow-hidden border border-zinc-700/50 shadow-xl bg-black group"
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
            loading="lazy"
            className="w-full h-full object-cover"
            onLoadStart={() => console.log('Loading avatar example video')}
          />
          {/* Badge in Top Right - Matching Generated Position */}
          <div className="absolute top-3 right-3">
            <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 shadow-lg">
              <span className="text-xs font-bold">Example</span>
            </Badge>
          </div>
        </div>
        
        {/* Sample Prompt Text */}
        <p className="text-xs text-zinc-500 text-center">
          Sample: "{featuredVideo.prompt}"
        </p>
      </div>
    </div>
  );
}