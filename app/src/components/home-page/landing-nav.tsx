'use client';

import { Button } from "@/components/ui/button"
import { Moon, Sun } from 'lucide-react'
import { useTheme } from "next-themes"

export function LandingNav() {
  const { theme, setTheme } = useTheme()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/70 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent"></div>
              <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent"></div>
            </div>
            <span className="font-semibold text-xl">BlueFX</span>
          </div>
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-6">
              <a href="#arsenal" className="text-sm hover:text-primary">Features</a>
              <a href="#pricing-plans" className="text-sm hover:text-primary">Pricing</a>
            </nav>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-sm"
            >
              Log in
            </Button>
            <Button size="sm">
              Sign Up
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="h-9 w-9"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </div>
        </div>
      </header>
  )
}