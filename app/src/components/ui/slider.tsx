"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps {
  value: number[]
  onValueChange: (value: number[]) => void
  min: number
  max: number
  step: number
  disabled?: boolean
  className?: string
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, onValueChange, min, max, step, disabled, ...props }, ref) => {
    // Generate unique ID for each slider instance
    const sliderId = React.useId()
    const sliderClass = `slider-${sliderId.replace(/:/g, '')}`
    
    // Calculate the percentage for both background and positioning
    const percentage = ((value[0] - min) / (max - min)) * 100
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onValueChange([parseFloat(e.target.value)])
    }

    return (
      <div className={cn("relative flex w-full items-center", className)}>
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value[0]}
          onChange={handleChange}
          disabled={disabled}
          className={`w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer ${sliderClass}`}
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #e2e8f0 ${percentage}%, #e2e8f0 100%)`
          }}
          {...props}
        />
        <style jsx global>{`
          .${sliderClass} {
            height: 8px !important;
            border-radius: 4px !important;
            outline: none !important;
            -webkit-appearance: none !important;
            appearance: none !important;
          }
          .${sliderClass}::-webkit-slider-track {
            background: transparent !important;
            height: 8px !important;
            border-radius: 4px !important;
          }
          .${sliderClass}::-webkit-slider-thumb {
            appearance: none !important;
            -webkit-appearance: none !important;
            height: 20px !important;
            width: 20px !important;
            border-radius: 50% !important;
            background: #ffffff !important;
            cursor: pointer !important;
            border: 3px solid #3b82f6 !important;
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4) !important;
            position: relative !important;
          }
          .${sliderClass}::-moz-range-track {
            background: transparent !important;
            height: 8px !important;
            border-radius: 4px !important;
            border: none !important;
          }
          .${sliderClass}::-moz-range-thumb {
            height: 20px !important;
            width: 20px !important;
            border-radius: 50% !important;
            background: #ffffff !important;
            cursor: pointer !important;
            border: 3px solid #3b82f6 !important;
            box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4) !important;
          }
        `}</style>
      </div>
    )
  }
)
Slider.displayName = "Slider"

export { Slider }