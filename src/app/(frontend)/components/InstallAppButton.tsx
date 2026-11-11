'use client'

import { useEffect, useState } from 'react'

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function InstallAppButton({ className = '' }: { className?: string }) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isAppleTouchDevice, setIsAppleTouchDevice] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)

  useEffect(() => {
    setIsInstalled(window.matchMedia('(display-mode: standalone)').matches)
    setIsAppleTouchDevice(
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1),
    )

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const handleAppInstalled = () => setIsInstalled(true)

    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  if (isInstalled) return null

  if (installPrompt) {
    return (
      <button
        className={className}
        onClick={async () => {
          await installPrompt.prompt()
          await installPrompt.userChoice
          setInstallPrompt(null)
        }}
        type="button"
      >
        Install Parallax
      </button>
    )
  }

  return (
    <div className={className}>
      <button
        aria-expanded={showInstructions}
        className="cursor-pointer"
        onClick={() => setShowInstructions((visible) => !visible)}
        type="button"
      >
        Install Parallax
      </button>
      {showInstructions && (
        <span className="mt-2 block max-w-64 text-xs font-normal leading-relaxed">
          {isAppleTouchDevice
            ? 'In Safari, tap Share, then Add to Home Screen.'
            : 'Choose Install app or Add to Home Screen in your browser menu.'}
        </span>
      )}
    </div>
  )
}
