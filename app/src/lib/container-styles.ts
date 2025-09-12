/**
 * Standardized container styles for consistent UI across the application
 * These replace Card components with semantic divs for better control
 */

export const containerStyles = {
  // Main panel container - replaces Card
  panel: "bg-background border border-border/30 rounded-lg",
  
  // Secondary panel with subtle background
  secondaryPanel: "bg-secondary/50 border border-border/30 rounded-lg",
  
  // Muted section background
  section: "bg-muted/30 p-6",
  
  // Header section with bottom border
  header: "border-b border-border/30 p-6",
  
  // Content area padding
  content: "p-6",
  
  // Compact content padding
  contentCompact: "p-4",
  
  // Empty state container
  empty: "flex items-center justify-center h-full",
  
  // Error state styling
  error: "bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20 backdrop-blur-sm",
  
  // Warning state styling
  warning: "bg-yellow-500/10 border border-yellow-500/30 backdrop-blur-sm",
  
  // Success state styling
  success: "bg-green-500/10 border border-green-500/30 backdrop-blur-sm",
  
  // Info state styling
  info: "bg-blue-500/10 border border-blue-500/30 backdrop-blur-sm",
  
  // Overlay background
  overlay: "bg-secondary/20",
  
  // Grid container for output panels
  outputGrid: "grid gap-4 p-4",
  
  // Flex container for vertical layouts
  flexColumn: "flex flex-col h-full",
  
  // Scrollable content area
  scrollable: "overflow-auto",
  
  // Fixed header that doesn't scroll
  stickyHeader: "flex-shrink-0 sticky top-0 z-10 bg-background",
  
  // Main content area that can scroll
  scrollContent: "flex-1 min-h-0 overflow-auto"
} as const;

/**
 * Helper function to combine container styles
 * @param styles Array of style keys or custom classes
 * @returns Combined className string
 */
export function combineContainerStyles(...styles: (keyof typeof containerStyles | string)[]): string {
  return styles
    .map(style => {
      if (style in containerStyles) {
        return containerStyles[style as keyof typeof containerStyles];
      }
      return style;
    })
    .join(' ');
}

/**
 * Common container patterns
 */
export const containerPatterns = {
  // Standard output panel with header
  outputPanel: combineContainerStyles('flexColumn'),
  
  // Panel with header and scrollable content
  panelWithHeader: (headerContent: string, contentClasses?: string) => ({
    container: combineContainerStyles('secondaryPanel', 'flexColumn'),
    header: containerStyles.header,
    content: combineContainerStyles('scrollContent', contentClasses || 'content')
  }),
  
  // Empty state panel
  emptyPanel: combineContainerStyles('empty', 'content'),
  
  // Error panel
  errorPanel: combineContainerStyles('error', 'panel', 'content'),
  
  // Success panel
  successPanel: combineContainerStyles('success', 'panel', 'content'),
  
  // Tool layout main container
  toolContainer: "h-full bg-background",
  
  // Two column layout container
  twoColumnLayout: "grid grid-cols-1 lg:grid-cols-2 gap-4 h-full",
  
  // Single column centered content
  centeredContent: "flex items-center justify-center h-full px-6"
} as const;