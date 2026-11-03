'use client'

import { useEffect, useState } from 'react'

export type SiteAnnouncement = {
  id: number
  title: string
  message: string
  linkURL: string | null
  linkLabel: string | null
  dismissible: boolean
}

export function AnnouncementPopup({ announcement }: { announcement: SiteAnnouncement | null }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!announcement) return
    if (announcement.dismissible) {
      const dismissed = window.localStorage.getItem(`parallax-announcement-dismissed-${announcement.id}`)
      if (dismissed) return
    }
    setVisible(true)
  }, [announcement])

  if (!announcement || !visible) return null

  function dismiss() {
    if (announcement?.dismissible) {
      window.localStorage.setItem(`parallax-announcement-dismissed-${announcement.id}`, '1')
    }
    setVisible(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-zinc-950/60 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={announcement.title}>
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-emerald-700 via-emerald-800 to-zinc-950 px-6 pb-8 pt-7">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Announcement
          </span>
          <h2 className="mt-3 text-2xl font-black leading-tight text-white">{announcement.title}</h2>
        </div>
        <div className="px-6 py-6">
          <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700">{announcement.message}</p>
          {announcement.linkURL && (
            <a
              className="mt-5 block rounded-xl bg-emerald-700 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-emerald-800"
              href={announcement.linkURL}
              target="_blank"
              rel="noreferrer"
              onClick={dismiss}
            >
              {announcement.linkLabel || 'Learn more'} →
            </a>
          )}
        </div>
        {announcement.dismissible && (
          <div className="flex items-center justify-between border-t border-zinc-100 px-6 py-3">
            <button className="text-xs font-semibold text-zinc-500 hover:text-zinc-800" onClick={dismiss} type="button">
              Don&apos;t show again
            </button>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-zinc-600 transition hover:bg-zinc-200"
              aria-label="Close announcement"
              onClick={dismiss}
              type="button"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
