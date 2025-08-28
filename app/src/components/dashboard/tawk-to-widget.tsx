'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

interface TawkToWidgetProps {
  isVisible: boolean;
  onClose?: () => void;
}

export function TawkToWidget({ isVisible, onClose }: TawkToWidgetProps) {
  const pathname = usePathname();
  const tawkInitialized = useRef(false);
  
  // Only initialize Tawk.to if we're on the dashboard page
  useEffect(() => {
    // Ensure we're only on the exact dashboard page
    if (pathname !== '/dashboard') {
      return;
    }

    // Only initialize once and when visible
    if (!isVisible || tawkInitialized.current) {
      return;
    }

    // Add Tawk.to script dynamically
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://embed.tawk.to/68adae1925236c1924467e1b/1j3j705bu';
    script.charset = 'UTF-8';
    script.setAttribute('crossorigin', '*');
    
    // Initialize Tawk.to when script loads
    script.onload = () => {
      if (typeof window !== 'undefined' && (window as any).Tawk_API) {
        const TawkAPI = (window as any).Tawk_API;
        
        // Configure Tawk.to to be hidden by default
        TawkAPI.hideWidget();
        
        // Show widget when this component becomes visible
        if (isVisible) {
          TawkAPI.showWidget();
        }
        
        // Handle close events
        TawkAPI.onChatMinimized = () => {
          if (onClose) {
            onClose();
          }
        };
        
        tawkInitialized.current = true;
      }
    };
    
    // Add script to page
    document.head.appendChild(script);
    
    // Cleanup function
    return () => {
      // Don't remove script as it might break Tawk.to
      // Just hide the widget if it exists
      if ((window as any).Tawk_API) {
        (window as any).Tawk_API.hideWidget();
      }
    };
  }, [isVisible, pathname, onClose]);
  
  // Show/hide widget based on visibility prop
  useEffect(() => {
    if (tawkInitialized.current && (window as any).Tawk_API) {
      const TawkAPI = (window as any).Tawk_API;
      if (isVisible) {
        TawkAPI.showWidget();
      } else {
        TawkAPI.hideWidget();
      }
    }
  }, [isVisible]);
  
  // Hide widget when navigating away from dashboard
  useEffect(() => {
    if (pathname !== '/dashboard' && tawkInitialized.current && (window as any).Tawk_API) {
      (window as any).Tawk_API.hideWidget();
    }
  }, [pathname]);
  
  // This component doesn't render anything visible
  // Tawk.to manages its own DOM elements
  return null;
}