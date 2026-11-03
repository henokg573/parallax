'use client'

import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

const tokenPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function QRScanner() {
  const router = useRouter()
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => () => controlsRef.current?.stop(), [])

  async function startScanner() {
    setError('')
    try {
      const reader = new BrowserQRCodeReader()
      controlsRef.current = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current || undefined,
        (result) => {
          if (!result) return
          const scannedValue = result.getText().trim()
          let token = scannedValue

          try {
            const scannedURL = new URL(scannedValue)
            const segments = scannedURL.pathname.split('/').filter(Boolean)
            if (segments.length !== 2 || segments[0] !== 'check-in') {
              setError('This QR code is not a Parallax check-in ticket.')
              return
            }
            token = segments[1]
          } catch {
            // A plain UUID is also accepted for printed tickets.
          }

          if (!tokenPattern.test(token)) {
            setError('This QR code does not contain a valid Parallax ticket.')
            return
          }

          controlsRef.current?.stop()
          controlsRef.current = null
          setScanning(false)
          router.push(`/check-in/${token}`)
        },
      )
      setScanning(true)
    } catch {
      setScanning(false)
      setError('Camera access failed. Allow camera access or use the ticket link manually.')
    }
  }

  function stopScanner() {
    controlsRef.current?.stop()
    controlsRef.current = null
    setScanning(false)
  }

  return (
    <section className="mt-6 grid max-w-2xl gap-4">
      <video
        className="aspect-video w-full rounded border border-zinc-300 bg-zinc-950 object-cover"
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-label="Camera view for scanning Parallax ticket QR codes"
      />
      <div className="flex flex-wrap gap-3">
        {scanning ? (
          <button className="rounded border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800" onClick={stopScanner} type="button">
            Stop camera
          </button>
        ) : (
          <button className="rounded bg-emerald-900 px-4 py-2 text-sm font-semibold text-white" onClick={startScanner} type="button">
            Start camera
          </button>
        )}
        <a className="rounded border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800" href="/admin/registrations">
          View registrations
        </a>
      </div>
      {error && <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">{error}</p>}
      <p className="text-sm text-zinc-600">Only verified registrations can be checked in. Camera access requires localhost or HTTPS.</p>
    </section>
  )
}