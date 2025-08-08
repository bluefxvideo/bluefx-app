import React from 'react'
import { cn } from '@/lib/utils'

interface MobileOptimizedGridProps {
  children: React.ReactNode
  className?: string
}

export const MobileOptimizedGrid: React.FC<MobileOptimizedGridProps> = ({ 
  children, 
  className 
}) => {
  return (
    <div className={cn(
      "grid gap-3",
      "grid-cols-1", // Mobile: 1 column
      "sm:grid-cols-2", // Small screens: 2 columns
      "md:grid-cols-3", // Medium screens: 3 columns
      "lg:grid-cols-4", // Large screens: 4 columns
      "xl:grid-cols-5", // Extra large: 5 columns
      className
    )}>
      {children}
    </div>
  )
}

interface MobileOptimizedCardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export const MobileOptimizedCard: React.FC<MobileOptimizedCardProps> = ({ 
  children, 
  className,
  onClick 
}) => {
  return (
    <div
      className={cn(
        "p-4 rounded-lg border bg-card text-card-foreground shadow-sm",
        "transition-all duration-200",
        "hover:shadow-md hover:scale-[1.02]",
        "active:scale-[0.98]", // Mobile tap feedback
        "touch-manipulation", // Optimize for touch
        "select-none", // Prevent text selection on mobile
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

interface MobileOptimizedButtonProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'outline'
  disabled?: boolean
}

export const MobileOptimizedButton: React.FC<MobileOptimizedButtonProps> = ({ 
  children, 
  className,
  onClick,
  variant = 'primary',
  disabled = false
}) => {
  const baseClasses = cn(
    "min-h-[44px]", // Minimum touch target size
    "px-6 py-3",
    "rounded-lg font-medium",
    "transition-all duration-200",
    "touch-manipulation",
    "select-none",
    "active:scale-[0.96]", // Tap feedback
    disabled && "opacity-50 cursor-not-allowed"
  )

  const variantClasses = {
    primary: "bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700",
    secondary: "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600",
    outline: "border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600"
  }

  return (
    <button
      className={cn(baseClasses, variantClasses[variant], className)}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

interface MobileResponsiveContainerProps {
  children: React.ReactNode
  className?: string
}

export const MobileResponsiveContainer: React.FC<MobileResponsiveContainerProps> = ({ 
  children, 
  className 
}) => {
  return (
    <div className={cn(
      "w-full max-w-7xl mx-auto",
      "px-4", // Mobile padding
      "sm:px-6", // Small screens
      "lg:px-8", // Large screens
      className
    )}>
      {children}
    </div>
  )
}

interface MobileOptimizedInputProps {
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
  className?: string
  type?: string
}

export const MobileOptimizedInput: React.FC<MobileOptimizedInputProps> = ({
  placeholder,
  value,
  onChange,
  className,
  type = 'text'
}) => {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className={cn(
        "w-full min-h-[44px]", // Minimum touch target
        "px-4 py-3",
        "text-base", // Prevent zoom on iOS
        "border border-gray-300 rounded-lg",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
        "bg-white text-gray-900",
        "placeholder:text-gray-500",
        className
      )}
    />
  )
}

interface MobileStackProps {
  children: React.ReactNode
  className?: string
  spacing?: 'sm' | 'md' | 'lg'
}

export const MobileStack: React.FC<MobileStackProps> = ({ 
  children, 
  className,
  spacing = 'md'
}) => {
  const spacingClasses = {
    sm: "gap-2",
    md: "gap-4", 
    lg: "gap-6"
  }

  return (
    <div className={cn(
      "flex flex-col",
      spacingClasses[spacing],
      className
    )}>
      {children}
    </div>
  )
}

// Custom hook for mobile detection
export const useMobile = () => {
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return isMobile
}

// Touch-friendly spacing utilities
export const mobileSpacing = {
  xs: "p-2",
  sm: "p-3", 
  md: "p-4",
  lg: "p-6",
  xl: "p-8"
}

// Safe area utilities for mobile browsers
export const MobileSafeArea: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen pb-safe-bottom pt-safe-top">
      {children}
    </div>
  )
}