"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function ThumbnailExamplesCarousel() {
  // Show only the mountain/lifestyle image
  const featuredThumbnail = thumbnailData[2]; // The mountain image

  return (
    <div className="space-y-6">      
      <div className="space-y-4">
        <Card className="overflow-hidden bg-zinc-800/50 border-zinc-700 hover:shadow-lg transition-shadow pt-0">
          <div className="relative">
            <img
              src={featuredThumbnail.src}
              alt={featuredThumbnail.title}
              className="w-full aspect-video object-cover"
            />
            {/* Category Badge */}
            <div className="absolute top-3 left-3">
              <Badge className="bg-blue-500/90 text-white border-0">
                {featuredThumbnail.category}
              </Badge>
            </div>
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-white mb-1">{featuredThumbnail.title}</h3>
            <p className="text-sm text-zinc-400">{featuredThumbnail.description}</p>
          </div>
        </Card>
        
        {/* Subtle indicator of more examples */}
        <p className="text-xs text-zinc-500 text-center">
          More thumbnail styles available in generation
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
    src: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=450&fit=crop&crop=entropy&auto=format",
  },
  {
    category: "Tech Review", 
    title: "iPhone 15 Pro Max Review",
    description: "Clean product showcase",
    src: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800&h=450&fit=crop&crop=entropy&auto=format",
  },
  {
    category: "Lifestyle",
    title: "Morning Routine Guide",
    description: "Bright, energetic composition",  
    src: "https://trjkxgkbkyzthrgkbwfe.supabase.co/storage/v1/object/public/images/placeholders/placeholder-thumbnail-9db9dd3c-374e-42a6-ae04-606cb073e9d7.jpg",
  },
  {
    category: "Tutorial",
    title: "How to Code Like a Pro",
    description: "Clear step-by-step visuals",
    src: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=450&fit=crop&crop=entropy&auto=format",
  }
];