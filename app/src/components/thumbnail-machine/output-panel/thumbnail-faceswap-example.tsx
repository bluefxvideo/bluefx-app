"use client";

import { Badge } from "@/components/ui/badge";
import Image from "next/image";

export function ThumbnailFaceSwapExample() {
  const faceSwapPlaceholder = {
    title: "Face Swap Preview",
    prompt: "Upload your face and target thumbnail to create personalized content",
    src: "https://ihzcmpngyjxraxzmckiv.supabase.co/storage/v1/object/public/images/placeholders/thumbnail-recreate.png"
  };

  return (
    <div className="w-full">
      <div className="space-y-3">
        {/* Clean Image Placeholder - Matching Generated Style */}
        <div className="relative aspect-video rounded-lg overflow-hidden border border-zinc-700/50 shadow-xl">
          <Image
            src={faceSwapPlaceholder.src}
            alt={faceSwapPlaceholder.title}
            width={800}
            height={450}
            priority
            quality={85}
            placeholder="blur"
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
            className="w-full h-full object-cover"
            onLoad={() => console.log('Thumbnail face swap example loaded successfully')}
          />
          {/* Badge in Top Right - Matching Generated Position */}
          <div className="absolute top-3 right-3">
            <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 shadow-lg">
              <span className="text-xs font-bold">Face Swap</span>
            </Badge>
          </div>
        </div>
        
        {/* Sample Prompt Text */}
        <p className="text-xs text-zinc-500 text-center">
          {faceSwapPlaceholder.prompt}
        </p>
      </div>
    </div>
  );
}