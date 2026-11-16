'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { submitFeedback, type FeedbackState } from './actions'

const MAX_PHOTO_BYTES = 8 * 1024 * 1024
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024
const MAX_VOICE_SECONDS = 120

function Star({ filled, onClick, index }: { filled: boolean; onClick: () => void; index: number }) {
  return (
    <button
      aria-label={`${index} star${index === 1 ? '' : 's'}`}
      className="text-4xl transition hover:scale-110 sm:text-5xl"
      onClick={onClick}
      type="button"
    >
      <svg aria-hidden="true" className={filled ? 'text-amber-400' : 'text-zinc-300'} fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2l2.95 6.3 6.9.9-5.05 4.75 1.3 6.85L12 17.5l-6.1 3.3 1.3-6.85L2.15 9.2l6.9-.9L12 2z" />
      </svg>
    </button>
  )
}

const copy = {
  en: {
    rating: 'How would you rate the program?',
    ratingRequired: 'Please tap the stars to rate the program.',
    name: 'Your name (optional)',
    namePlaceholder: 'Anonymous',
    ideas: 'Share your ideas and feedback',
    ideasPlaceholder: 'What did you enjoy? What should we do differently next time?',
    photos: 'Photos from the experience (optional)',
    photosHelp: 'Up to 5 images, 8 MB each.',
    document: 'A document (optional)',
    documentHelp: 'PDF, Word, or text up to 8 MB.',
    voice: 'Voice message (optional)',
    voiceHelp: 'Record up to 2 minutes.',
    voiceRecord: 'Record voice message',
    voiceStop: 'Stop recording',
    voiceReRecord: 'Record again',
    voiceReady: (seconds: number) => `Voice message ready (${seconds}s).`,
    voiceDenied: 'Microphone access was blocked. You can still submit the rest.',
    submit: 'Send feedback',
    sending: 'Sending…',
    thankYou: 'Thank you! Your feedback has been received.',
    error: 'Something went wrong. Please try again.',
    tooLarge: 'That file is too large (maximum 8 MB).',
    removePhoto: 'Remove',
  },
  am: {
    rating: 'ፕሮግራሙን እንዴት ይሰበዋል?',
    ratingRequired: 'እባክዎ ኮከቦቹን ተጫኑ።',
    name: 'ስምዎ (አማራጭ)',
    namePlaceholder: 'ስም አልባ',
    ideas: 'ሃሳብዎንና ግብረ-መልስዎን ያጋሩ',
    ideasPlaceholder: 'ምን ደስ አለዎት? ቀጥሎ ምን እንዲለወጥ ይፈልጋሉ?',
    photos: 'ከልምድዎ ያሉ ፎቶዎች (አማራጭ)',
    photosHelp: 'እስከ 5 ምስሎች፣ እያንዳንዱ 8 MB።',
    document: 'ሰነድ (አማራጭ)',
    documentHelp: 'PDF፣ Word ወይም ጽሑፍ እስከ 8 MB።',
    voice: 'የድምፅ መልእክት (አማራጭ)',
    voiceHelp: 'እስከ 2 ደቂቃ ይቅዱ።',
    voiceRecord: 'የድምፅ መልእክት ይቅዱ',
    voiceStop: 'ቅዳትን አቁም',
    voiceReRecord: 'እንደገና ይቅዱ',
    voiceReady: (seconds: number) => `የድምፅ መልእክት ተዘጋጅቷል (${seconds} ሰከንድ)።`,
    voiceDenied: 'የማይክሮፎን ፈቃድ ተከልክሏል። ቀሪውን መሙላት ይችላሉ።',
    submit: 'ግብረ-መልስ ይላኩ',
    sending: 'በመላክ ላይ…',
    thankYou: 'አመሰግናለሁ! ግብረ-መልስዎ ደርሷል።',
    error: 'ችግር አጋጥሟል። እባክዎ እንደገና ይሞክሩ።',
    tooLarge: 'ያው ፋይል በጣም ትልቅ ነው (ከአንድ ማለቅ 8 MB)።',
    removePhoto: 'አስወግድ',
  },
} as const

type UploadedPhoto = { file: File; previewURL: string }

export default function FeedbackForm({ experienceID, locale }: { experienceID: number | null; locale: 'en' | 'am' }) {
  const t = copy[locale]
  const [state, formAction, pending] = useActionState<FeedbackState, FormData>(submitFeedback, { ok: false })
  const [rating, setRating] = useState(0)
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [voiceBlob, setVoiceBlob] = useState<{ blob: Blob; seconds: number } | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordError, setRecordError] = useState(false)
  const [tooLarge, setTooLarge] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const done = state.ok

  useEffect(() => {
    return () => {
      photos.forEach((photo) => URL.revokeObjectURL(photo.previewURL))
    }
  }, [photos])

  if (done) {
    return (
      <div className="rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-3xl text-white">✓</div>
        <h2 className="mt-4 text-2xl font-extrabold text-emerald-950">{t.thankYou}</h2>
      </div>
    )
  }

  function addPhotos(list: FileList | null) {
    if (!list) return
    setTooLarge(false)
    const incoming = Array.from(list).slice(0, 5 - photos.length)
    for (const file of incoming) {
      if (file.size > MAX_PHOTO_BYTES) {
        setTooLarge(true)
        continue
      }
      setPhotos((prev) => (prev.length < 5 ? [...prev, { file, previewURL: URL.createObjectURL(file) }] : prev))
    }
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      const startedAt = Date.now()
      timerRef.current = setInterval(() => {
        if ((Date.now() - startedAt) / 1000 >= MAX_VOICE_SECONDS) recorder.stop()
      }, 500)
      recorder.ondataavailable = (event) => chunksRef.current.push(event.data)
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        if (timerRef.current) clearInterval(timerRef.current)
        const seconds = Math.min(MAX_VOICE_SECONDS, Math.round((Date.now() - startedAt) / 1000))
        setRecording(false)
        if (chunksRef.current.length) {
          setVoiceBlob({ blob: new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }), seconds })
        }
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
      setRecordError(false)
    } catch {
      setRecordError(true)
    }
  }

  const inputClass = 'mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15'
  const labelClass = 'block text-sm font-bold text-zinc-800'

  return (
    <form action={formAction} className="space-y-6" ref={formRef}>
      <input name="experience_id" type="hidden" value={experienceID ?? ''} />
      <input name="rating" type="hidden" value={rating} />

      <div>
        <span className={labelClass}>{t.rating}</span>
        <div className="mt-2 flex gap-1.5">
          {[1, 2, 3, 4, 5].map((index) => (
            <Star filled={index <= rating} index={index} key={index} onClick={() => setRating(index)} />
          ))}
        </div>
        {state.error === 'rating' && <p className="mt-2 text-sm font-semibold text-red-700">{t.ratingRequired}</p>}
      </div>

      <label className="block">
        <span className={labelClass}>{t.name}</span>
        <input className={inputClass} maxLength={120} name="full_name" placeholder={t.namePlaceholder} />
      </label>

      <label className="block">
        <span className={labelClass}>{t.ideas}</span>
        <textarea className={inputClass} name="message" placeholder={t.ideasPlaceholder} rows={5} />
      </label>

      <div>
        <span className={labelClass}>{t.photos}</span>
        <input accept="image/*" className="mt-1.5 block w-full text-sm text-zinc-700" multiple name="photos_input" onChange={(event) => addPhotos(event.target.files)} type="file" />
        <p className="mt-1 text-xs text-zinc-500">{t.photosHelp}</p>
        {tooLarge && <p className="mt-1 text-xs font-semibold text-red-700">{t.tooLarge}</p>}
        {photos.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {photos.map((photo, index) => (
              <div className="relative" key={photo.previewURL}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" className="aspect-square w-full rounded-lg object-cover" src={photo.previewURL} />
                <button
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white shadow"
                  onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="block">
        <span className={labelClass}>{t.document}</span>
        <input
          accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="mt-1.5 block w-full text-sm text-zinc-700"
          name="document_input"
          type="file"
        />
        <p className="mt-1 text-xs text-zinc-500">{t.documentHelp}</p>
      </label>

      <div>
        <span className={labelClass}>{t.voice}</span>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm transition ${recording ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-700 hover:bg-emerald-800'}`}
            onClick={toggleRecording}
            type="button"
          >
            {recording ? `● ${t.voiceStop}` : voiceBlob ? t.voiceReRecord : t.voiceRecord}
          </button>
          {voiceBlob && <span className="text-sm font-semibold text-emerald-800">{t.voiceReady(voiceBlob.seconds)}</span>}
        </div>
        <p className="mt-1 text-xs text-zinc-500">{t.voiceHelp}</p>
        {recordError && <p className="mt-1 text-xs font-semibold text-amber-700">{t.voiceDenied}</p>}
      </div>

      {state.error === 'server' && <p className="text-sm font-semibold text-red-700">{t.error}</p>}

      <button
        className="w-full rounded-2xl bg-emerald-700 px-6 py-4 text-base font-extrabold uppercase tracking-wide text-white shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-800 disabled:opacity-60"
        disabled={pending}
        onClick={() => {
          const form = formRef.current
          if (!form) return
          for (const photo of photos) {
            const holder = document.createElement('input')
            holder.type = 'file'
            holder.name = 'photos'
            const transfer = new DataTransfer()
            transfer.items.add(photo.file)
            holder.files = transfer.files
            form.appendChild(holder)
          }
          if (voiceBlob) {
            const holder = document.createElement('input')
            holder.type = 'file'
            holder.name = 'voice'
            const transfer = new DataTransfer()
            transfer.items.add(new File([voiceBlob.blob], 'voice-message.webm', { type: voiceBlob.blob.type }))
            holder.files = transfer.files
            form.appendChild(holder)
          }
        }}
        type="submit"
      >
        {pending ? t.sending : t.submit}
      </button>
    </form>
  )
}
