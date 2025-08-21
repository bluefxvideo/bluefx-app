"use client";

import { Badge } from "@/components/ui/badge";
import Image from "next/image";

export function ThumbnailExamplesCarousel() {
  // Show only the mountain/lifestyle image
  const featuredThumbnail = thumbnailData[2]; // The mountain image

  return (
    <div className="flex justify-center">
      <div className="space-y-3 max-w-2xl w-full">
        {/* Clean Image Placeholder - Matching Generated Style */}
        <div className="relative aspect-video rounded-lg overflow-hidden border border-zinc-700/50 shadow-xl">
          <Image
            src={featuredThumbnail.src}
            alt={featuredThumbnail.title}
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
          Sample: "{featuredThumbnail.prompt}"
        </p>
      </div>
    </div>
  );
}

const thumbnailData = [
  {
    category: "Gaming",
    title: "Epic Boss Battle Victory",
    description: "Dramatic action with bold typography",
    prompt: "Epic gaming moment with shocked expression, bright colors, dramatic lighting",
    src: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=450&fit=crop&crop=entropy&auto=format",
  },
  {
    category: "Tech Review", 
    title: "iPhone 15 Pro Max Review",
    description: "Clean product showcase",
    prompt: "Professional tech review thumbnail with latest iPhone, clean minimal design",
    src: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&h=450&fit=crop&crop=entropy&auto=format",
  },
  {
    category: "Lifestyle",
    title: "Morning Routine Guide",
    description: "Bright, energetic composition",
    prompt: "Lifestyle morning routine with lottery excitement, bright energetic scene with money and celebration",
    src: "https://trjkxgkbkyzthrgkbwfe.supabase.co/storage/v1/object/public/images/placeholders/placeholder-thumbnail-9db9dd3c-374e-42a6-ae04-606cb073e9d7.jpg",
  },
  {
    category: "Tutorial",
    title: "How to Code Like a Pro",
    description: "Clear step-by-step visuals",
    prompt: "Coding tutorial with laptop screen, professional developer workspace",
    src: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=450&fit=crop&crop=entropy&auto=format",
  }
];