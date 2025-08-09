import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, X, Smartphone } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PWAInstallPromptProps {
  onInstall: () => void
  onDismiss: () => void
}

const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({ onInstall, onDismiss }) => {
  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 shadow-lg border-2 border-blue-200 md:left-auto md:w-80">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-blue-500" />
            Install BlueFX AI
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-gray-600 mb-3">
          Install our app for faster access, offline support, and a native experience.
        </p>
        <div className="flex gap-2">
          <Button
            onClick={onInstall}
            size="sm"
            className="flex-1 h-8 text-xs"
          >
            <Download className="h-3 w-3 mr-1" />
            Install
          </Button>
          <Button
            onClick={onDismiss}
            variant="outline"
            size="sm"
            className="h-8 text-xs"
          >
            Later
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export const PWASetup: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if already installed
    const checkInstalled = () => {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true)
        return
      }
      
      // Check for iOS standalone mode
      if ((window.navigator as Navigator & { standalone?: boolean }).standalone) {
        setIsInstalled(true)
        return
      }
    }

    checkInstalled()

    // Register service worker
    if ('serviceWorker' in navigator && !isInstalled) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(registration => {
          console.log('Service Worker registered successfully:', registration)
          
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New content is available
                  console.log('New content available, refreshing...')
                  window.location.reload()
                }
              })
            }
          })
        })
        .catch(error => {
          console.log('Service Worker registration failed:', error)
        })
    }

    // Handle install prompt
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      console.log('beforeinstallprompt event fired')
      e.preventDefault()
      setDeferredPrompt(e)
      
      // Don't show immediately, wait for user interaction
      setTimeout(() => {
        if (!localStorage.getItem('pwa-prompt-dismissed')) {
          setShowInstallPrompt(true)
        }
      }, 10000) // Show after 10 seconds
    }

    // Handle successful installation
    const handleAppInstalled = () => {
      console.log('PWA was installed')
      setIsInstalled(true)
      setShowInstallPrompt(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener)
    window.addEventListener('appinstalled', handleAppInstalled as EventListener)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener)
      window.removeEventListener('appinstalled', handleAppInstalled as EventListener)
    }
  }, [isInstalled])

  const handleInstall = async () => {
    if (!deferredPrompt) {
      console.log('No deferred prompt available')
      return
    }

    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      
      console.log(`User response to install prompt: ${outcome}`)
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt')
      } else {
        console.log('User dismissed the install prompt')
      }
      
      setDeferredPrompt(null)
      setShowInstallPrompt(false)
    } catch (error) {
      console.error('Error during PWA installation:', error)
    }
  }

  const handleDismiss = () => {
    setShowInstallPrompt(false)
    localStorage.setItem('pwa-prompt-dismissed', 'true')
    
    // Show again after 7 days
    setTimeout(() => {
      localStorage.removeItem('pwa-prompt-dismissed')
    }, 7 * 24 * 60 * 60 * 1000)
  }

  // Don't show anything if already installed or no prompt available
  if (isInstalled || !showInstallPrompt || !deferredPrompt) {
    return null
  }

  return (
    <PWAInstallPrompt
      onInstall={handleInstall}
      onDismiss={handleDismiss}
    />
  )
}

// Hook to check PWA installation status
export const usePWA = () => {
  const [isInstalled, setIsInstalled] = useState(false)
  const [canInstall, setCanInstall] = useState(false)

  useEffect(() => {
    // Check if running as PWA
    const checkInstalled = () => {
      if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true)
        return true
      }
      
      if ((window.navigator as Navigator & { standalone?: boolean }).standalone) {
        setIsInstalled(true)
        return true
      }
      
      return false
    }

    setIsInstalled(checkInstalled())

    // Check if installation is available
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault()
      setCanInstall(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener)
    }
  }, [])

  return {
    isInstalled,
    canInstall,
    isOnline: navigator.onLine
  }
}

// Component to show PWA features and benefits
export const PWAFeatures: React.FC = () => {
  const { isInstalled, canInstall } = usePWA()

  if (isInstalled) {
    return (
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-blue-600">
            <Smartphone className="h-5 w-5" />
            <span className="font-medium">App installed successfully!</span>
          </div>
          <p className="text-sm text-blue-600 mt-1">
            You&apos;re now using BlueFX AI as a native app with offline support.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!canInstall) {
    return null
  }

  return (
    <Card className="bg-blue-50 border-blue-200">
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 text-blue-700 mb-2">
          <Download className="h-5 w-5" />
          <span className="font-medium">Install BlueFX AI</span>
        </div>
        <ul className="text-sm text-blue-600 space-y-1">
          <li>• Faster loading and better performance</li>
          <li>• Work offline with cached content</li>
          <li>• Native app experience</li>
          <li>• Push notifications for updates</li>
        </ul>
      </CardContent>
    </Card>
  )
}