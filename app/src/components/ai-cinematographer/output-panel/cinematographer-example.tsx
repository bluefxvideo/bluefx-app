"use client";

import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export function CinematographerExample() {
  const [showControls, setShowControls] = useState(false);
  
  // Show the AI cinematographer video placeholder as an example
  const featuredVideo = {
    title: "Cinematic AI Video",
    description: "Professional cinematic generation",
    prompt: "Cinematic shot with dynamic camera movement, professional lighting, dramatic atmosphere",
    src: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/videos/placeholders/ai-cinematographer.mp4",
  };

  return (
    <div className="flex justify-center">
      <div className="space-y-3 max-w-2xl w-full">
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
            className="w-full h-full object-cover"
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