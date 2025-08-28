"use client";

import { Badge } from "@/components/ui/badge";
import Image from "next/image";

export function LogoExample() {
  // Show the sun metal logo placeholder as an example
  const featuredLogo = {
    title: "Modern Brand Logo",
    description: "Clean, professional design",
    prompt: "Professional company logo with modern design, clean typography, memorable brand identity",
    src: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/images/placeholders/sun-metal-logo.png",
  };

  return (
    <div className="flex justify-center">
      <div className="space-y-3 max-w-2xl w-full">
        {/* Clean Image Placeholder - Matching Generated Style */}
        <div className="relative aspect-video rounded-lg overflow-hidden border border-zinc-700/50 shadow-xl">
          <Image
            src={featuredLogo.src}
            alt={featuredLogo.title}
            width={800}
            height={450}
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
          Sample: "{featuredLogo.prompt}"
        </p>
      </div>
    </div>
  );
}