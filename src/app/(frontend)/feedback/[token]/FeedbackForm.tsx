'use client'

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from 'react'
import { submitFeedback, type FeedbackState } from './actions'

const MAX_PHOTO_BYTES = 8 * 1024 * 1024
const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024
const MAX_VOICE_SECONDS = 120
const MAX_MESSAGE_LENGTH = 5000

type UploadedPhoto = { file: File; previewURL: string }

const copy = {
  en: {
    name: 'Your name',
    anonymous: 'Anonymous',
    shareIdeas: "Share what's on your mind.",
    shareIdeasHelp: 'Your ideas help us make every PARALLAX experience better.',
    messagePlaceholder:
      'What did you enjoy? What inspired you? What could we make even better next time?',
    photos: 'Moments worth remembering',
    photosHelp: "Have pictures from the experience? We'd love to see them.",
    addPhotos: 'Choose photos or drop them here',
    photosHint: 'JPG, PNG, GIF or WebP · up to 5 photos · 8 MB each',
    document: 'Share a document',
    documentHelp: 'Have a suggestion or resource to share? Attach it here.',
    chooseDocument: 'Choose a document',
    documentHint: 'PDF, Word or text · up to 8 MB',
    voice: 'Rather say it? Leave us a voice message.',
    voiceHelp: 'Record a short message and share your thoughts with us.',
    record: 'Record a message',
    stop: 'Stop recording',
    recording: 'Recording',
    voiceReady: 'Your recording is ready',
    playVoice: 'Play recording',
    removeVoice: 'Delete recording',
    voiceDenied: 'Microphone access was blocked. You can still submit the rest.',
    voiceUnavailable: 'Voice recording is not available in this browser.',
    voiceLimit: 'The recording limit is 2 minutes.',
    rating: 'How would you rate the experience?',
    requiredLabel: 'Required',
    ratingRequired: 'Please choose a star rating before sending.',
    ratingMessages: [
      'We’ll work harder to improve.',
      'Thank you for your honesty.',
      'We appreciate your feedback.',
      'We’re glad you enjoyed it!',
      'Amazing! We’re thrilled!',
    ],
    feedback: 'Feedback',
    submit: 'Share my experience',
    sending: 'Sending your feedback…',
    thankYouTitle: 'Thank you for being part of PARALLAX!',
    thankYou:
      'Your voice matters. Your feedback helps us create more meaningful experiences, stronger connections, and better conversations.',
    returnHome: 'Return to PARALLAX',
    error: 'Something went wrong. Please try again.',
    tooLarge: 'That file is too large (maximum 8 MB).',
    photoLimit: 'You can add up to 5 photos.',
    removePhoto: 'Remove photo',
    removeDocument: 'Remove document',
    photoCount: (count: number) => `${count} of 5 photos selected`,
    characterCount: (count: number) => `${count} / ${MAX_MESSAGE_LENGTH}`,
    seconds: (count: number) => `${Math.floor(count / 60)}:${String(count % 60).padStart(2, '0')}`,
    uploadPhoto: 'Upload photos',
    uploadDocument: 'Upload a document',
    optional: 'Optional',
  },
  am: {
    name: 'ስምዎ',
    anonymous: 'ስም አልባ',
    shareIdeas: 'ሃሳብዎን ያጋሩ።',
    shareIdeasHelp: 'ሃሳብዎ እያንዳንዱን የPARALLAX ተሞክሮ የተሻለ ያደርገዋል።',
    messagePlaceholder: 'ምን ወደዱ? ምን አነሳሳዎ? በሚቀጥለው ጊዜ ምን ማሻሻል እንችላለን?',
    photos: 'ማስታወስ የሚገባቸው ቅጽበቶች',
    photosHelp: 'ከተሞክሮው ፎቶዎች አሉዎት? ማየት ደስ ይለናል።',
    addPhotos: 'ፎቶዎችን ይምረጡ ወይም ወደዚህ ይጎትቱ',
    photosHint: 'JPG፣ PNG፣ GIF ወይም WebP · እስከ 5 ፎቶዎች · እያንዳንዱ 8 MB',
    document: 'ሰነድ ያጋሩ',
    documentHelp: 'ሃሳብ ወይም ጠቃሚ ሰነድ ካለዎት እዚህ ያያይዙ።',
    chooseDocument: 'ሰነድ ይምረጡ',
    documentHint: 'PDF፣ Word ወይም ጽሑፍ · እስከ 8 MB',
    voice: 'መናገር ይመርጣሉ? የድምፅ መልእክት ይተዉ።',
    voiceHelp: 'አጭር መልእክት ይቅዱና ሃሳብዎን ያጋሩ።',
    record: 'መልእክት ይቅዱ',
    stop: 'ቅዳትን አቁም',
    recording: 'በመቅዳት ላይ',
    voiceReady: 'ቅዳትዎ ዝግጁ ነው',
    playVoice: 'ቅዳቱን ያጫውቱ',
    removeVoice: 'ቅዳቱን ያጥፉ',
    voiceDenied: 'የማይክሮፎን ፈቃድ ተከልክሏል። ቀሪውን መላክ ይችላሉ።',
    voiceUnavailable: 'የድምፅ ቅዳት በዚህ አሳሽ አይገኝም።',
    voiceLimit: 'የቅዳት ገደቡ 2 ደቂቃ ነው።',
    rating: 'ተሞክሮውን እንዴት ይገመግማሉ?',
    requiredLabel: 'አስፈላጊ',
    ratingRequired: 'ከመላክዎ በፊት ኮከብ ይምረጡ።',
    ratingMessages: [
      'ለማሻሻል የበለጠ እንሠራለን።',
      'እውነተኛ ሃሳብዎን ስላጋሩ እናመሰግናለን።',
      'ግብረ-መልስዎን እናደንቃለን።',
      'ስለወደዱት ደስ ብሎናል!',
      'አስደናቂ ነው! በጣም ተደስተናል!',
    ],
    feedback: 'ግብረ-መልስ',
    submit: 'ተሞክሮዬን አጋራ',
    sending: 'ግብረ-መልስዎን በመላክ ላይ…',
    thankYouTitle: 'የPARALLAX አካል ስለሆኑ እናመሰግናለን!',
    thankYou: 'ድምፅዎ ወሳኝ ነው። ግብረ-መልስዎ ትርጉም ያላቸው ተሞክሮዎችንና ጠንካራ ግንኙነቶችን እንድንፈጥር ይረዳናል።',
    returnHome: 'ወደ PARALLAX ተመለስ',
    error: 'ችግር አጋጥሟል። እባክዎ እንደገና ይሞክሩ።',
    tooLarge: 'ፋይሉ በጣም ትልቅ ነው (ከፍተኛው 8 MB)።',
    photoLimit: 'እስከ 5 ፎቶዎች ማከል ይችላሉ።',
    removePhoto: 'ፎቶውን አስወግድ',
    removeDocument: 'ሰነዱን አስወግድ',
    photoCount: (count: number) => `${count} ከ5 ፎቶዎች ተመርጠዋል`,
    characterCount: (count: number) => `${count} / ${MAX_MESSAGE_LENGTH}`,
    seconds: (count: number) => `${Math.floor(count / 60)}:${String(count % 60).padStart(2, '0')}`,
    uploadPhoto: 'ፎቶዎችን ይስቀሉ',
    uploadDocument: 'ሰነድ ይስቀሉ',
    optional: 'አማራጭ',
  },
} as const

function Icon({
  name,
  className = 'h-5 w-5',
}: {
  name: 'user' | 'photo' | 'file' | 'mic' | 'arrow' | 'check' | 'spark'
  className?: string
}) {
  const paths = {
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M5 21a7 7 0 0 1 14 0" />
      </>
    ),
    photo: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9" r="1.5" />
        <path d="m21 15-5-5L5 20" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h8" />
      </>
    ),
    mic: (
      <>
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" />
      </>
    ),
    arrow: (
      <>
        <path d="M7 17 17 7M7 7h10v10" />
      </>
    ),
    check: (
      <>
        <path d="m5 12 4 4L19 6" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2zM19 14l1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2z" />
      </>
    ),
  }
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
  )
}

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export default function FeedbackForm({
  experienceID,
  locale,
  token,
}: {
  experienceID: number | null
  locale: 'en' | 'am'
  token: string
}) {
  const t = copy[locale]
  const [state, formAction, pending] = useActionState<FeedbackState, FormData>(submitFeedback, {
    ok: false,
  })
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [message, setMessage] = useState('')
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [voiceBlob, setVoiceBlob] = useState<{ blob: Blob; seconds: number } | null>(null)
  const [voiceURL, setVoiceURL] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [recordError, setRecordError] = useState<'denied' | 'unavailable' | null>(null)
  const [photoError, setPhotoError] = useState<'tooLarge' | 'limit' | null>(null)
  const [documentError, setDocumentError] = useState(false)
  const [dragging, setDragging] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)
  const photosRef = useRef(photos)
  const voiceURLRef = useRef(voiceURL)
  useEffect(() => {
    photosRef.current = photos
    voiceURLRef.current = voiceURL
  }, [photos, voiceURL])

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewURL))
      if (voiceURLRef.current) URL.revokeObjectURL(voiceURLRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop())
    }
  }, [])

  function addPhotos(list: FileList | null) {
    if (!list) return
    setPhotoError(null)
    const incoming = Array.from(list)
    if (incoming.length > 5 - photos.length) setPhotoError('limit')
    for (const file of incoming.slice(0, 5 - photos.length)) {
      if (file.size > MAX_PHOTO_BYTES) {
        setPhotoError('tooLarge')
        continue
      }
      const photo = { file, previewURL: URL.createObjectURL(file) }
      setPhotos((previous) => [...previous, photo])
    }
  }

  function removePhoto(index: number) {
    const removed = photos[index]
    if (removed) URL.revokeObjectURL(removed.previewURL)
    setPhotos((previous) => {
      return previous.filter((_, photoIndex) => photoIndex !== index)
    })
  }

  function handlePhotoDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setDragging(false)
    addPhotos(event.dataTransfer.files)
  }

  function handleDocumentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null
    if (file && file.size > MAX_DOCUMENT_BYTES) {
      setDocumentError(true)
      event.target.value = ''
      setDocumentFile(null)
      return
    }
    setDocumentError(false)
    setDocumentFile(file)
  }

  async function toggleRecording() {
    if (recording) {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordError('unavailable')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      setRecordError(null)
      setRecordingSeconds(0)
      setVoiceBlob(null)
      if (voiceURL) URL.revokeObjectURL(voiceURL)
      setVoiceURL(null)
      const startedAt = Date.now()
      timerRef.current = setInterval(() => {
        const seconds = Math.min(MAX_VOICE_SECONDS, Math.floor((Date.now() - startedAt) / 1000))
        setRecordingSeconds(seconds)
        if (seconds >= MAX_VOICE_SECONDS && recorder.state === 'recording') recorder.stop()
      }, 250)
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        if (timerRef.current) clearInterval(timerRef.current)
        const seconds = Math.min(
          MAX_VOICE_SECONDS,
          Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
        )
        setRecordingSeconds(seconds)
        setRecording(false)
        if (chunksRef.current.length) {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          setVoiceBlob({ blob, seconds })
          setVoiceURL(URL.createObjectURL(blob))
        }
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      setRecordError('denied')
    }
  }

  function removeVoice() {
    if (voiceURL) URL.revokeObjectURL(voiceURL)
    setVoiceURL(null)
    setVoiceBlob(null)
    setRecordingSeconds(0)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget
    form.querySelectorAll('.feedback-generated-file').forEach((input) => input.remove())
    for (const photo of photos) {
      const holder = document.createElement('input')
      holder.type = 'file'
      holder.name = 'photos'
      holder.className = 'feedback-generated-file'
      holder.hidden = true
      const transfer = new DataTransfer()
      transfer.items.add(photo.file)
      holder.files = transfer.files
      form.appendChild(holder)
    }
    if (voiceBlob) {
      const holder = document.createElement('input')
      holder.type = 'file'
      holder.name = 'voice'
      holder.className = 'feedback-generated-file'
      holder.hidden = true
      const transfer = new DataTransfer()
      transfer.items.add(
        new File([voiceBlob.blob], 'voice-message.webm', { type: voiceBlob.blob.type }),
      )
      holder.files = transfer.files
      form.appendChild(holder)
    }
  }

  if (state.ok) {
    return (
      <section
        aria-live="polite"
        className="feedback-enter mx-auto max-w-3xl rounded-[2rem] border border-emerald-900/10 bg-white px-6 py-12 text-center shadow-[0_24px_70px_rgba(12,42,33,.12)] sm:px-14 sm:py-16"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#123c31] text-[#f3d996] shadow-lg shadow-emerald-950/15">
          <Icon className="h-8 w-8" name="check" />
        </div>
        <p className="mt-7 text-xs font-bold uppercase tracking-[.24em] text-emerald-800">
          PARALLAX · {t.feedback}
        </p>
        <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-[-.04em] text-[#102e26] sm:text-5xl">
          {t.thankYouTitle}
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#64716a]">{t.thankYou}</p>
        <a
          className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#123c31] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#0a2821] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800"
          href="/"
        >
          {t.returnHome}
          <Icon className="h-4 w-4" name="arrow" />
        </a>
      </section>
    )
  }

  const ratingMessage = rating ? t.ratingMessages[rating - 1] : ''

  return (
    <form
      action={formAction}
      className="feedback-enter space-y-0 overflow-hidden rounded-[1.75rem] border border-[#123c31]/10 bg-white shadow-[0_24px_70px_rgba(12,42,33,.10)]"
      onSubmit={handleSubmit}
    >
      <input name="token" type="hidden" value={token} />
      <input name="experience_id" type="hidden" value={experienceID ?? ''} />
      <input name="rating" type="hidden" value={rating} />

      <section
        aria-labelledby="feedback-rating-heading"
        className="bg-[#f5f4ed] px-5 py-7 sm:px-10 sm:py-9"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#8b7137]">
              01 · {t.feedback}
            </p>
            <h2
              className="mt-2 text-xl font-bold tracking-[-.03em] text-[#102e26] sm:text-2xl"
              id="feedback-rating-heading"
            >
              {t.rating}
            </h2>
          </div>
          <span className="rounded-full border border-[#123c31]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#61736a]">
            {t.requiredLabel}
          </span>
        </div>
        <div
          aria-label={t.rating}
          className="mt-5 flex items-center gap-1 sm:gap-2"
          onMouseLeave={() => setHoverRating(0)}
          role="group"
        >
          {[1, 2, 3, 4, 5].map((index) => (
            <button
              aria-pressed={rating === index}
              className={`feedback-star flex h-12 w-12 items-center justify-center rounded-xl transition duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 sm:h-14 sm:w-14 ${index <= (hoverRating || rating) ? 'text-[#c89432]' : 'text-[#c9c9bd] hover:text-[#b68a38]'}`}
              key={index}
              onClick={() => {
                setRating(index)
                setHoverRating(0)
              }}
              onFocus={() => setHoverRating(index)}
              onMouseEnter={() => setHoverRating(index)}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="h-9 w-9 sm:h-10 sm:w-10"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3.1-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z" />
              </svg>
              <span className="sr-only">
                {index} {index === 1 ? 'star' : 'stars'}
              </span>
            </button>
          ))}
        </div>
        {ratingMessage && (
          <p
            aria-live="polite"
            className="mt-2 flex min-h-6 items-center gap-2 text-sm font-semibold text-[#466157]"
          >
            {ratingMessage}
            {rating === 5 && (
              <Icon className="feedback-spark h-5 w-5 text-[#c89432]" name="spark" />
            )}
          </p>
        )}
        {state.error === 'rating' && (
          <p className="mt-2 text-sm font-semibold text-red-700" role="alert">
            {t.ratingRequired}
          </p>
        )}
      </section>

      <div className="space-y-8 px-5 py-7 sm:space-y-9 sm:px-10 sm:py-9">
        <label className="block">
          <span className="flex items-center justify-between gap-3 text-sm font-bold text-[#18392f]">
            {t.name}
            <span className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#8a948d]">
              {t.optional}
            </span>
          </span>
          <span className="relative mt-2 block">
            <Icon
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#829087]"
              name="user"
            />
            <input
              autoComplete="name"
              className="w-full rounded-xl border border-[#123c31]/15 bg-[#fbfbf8] py-3.5 pl-12 pr-4 text-sm text-[#102e26] outline-none transition placeholder:text-[#939c96] hover:border-[#123c31]/30 focus:border-[#27624e] focus:bg-white focus:ring-4 focus:ring-[#27624e]/10"
              maxLength={120}
              name="full_name"
              placeholder={t.anonymous}
            />
          </span>
        </label>

        <section aria-labelledby="feedback-message-heading">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3
                className="text-xl font-bold tracking-[-.03em] text-[#102e26]"
                id="feedback-message-heading"
              >
                {t.shareIdeas}
              </h3>
              <p className="mt-1 text-sm leading-6 text-[#748078]">{t.shareIdeasHelp}</p>
            </div>
            <span className="hidden shrink-0 text-xs tabular-nums text-[#87918a] sm:block">
              {t.characterCount(message.length)}
            </span>
          </div>
          <label className="sr-only" htmlFor="feedback-message">
            {t.shareIdeas}
          </label>
          <textarea
            className="mt-4 min-h-40 w-full resize-y rounded-xl border border-[#123c31]/15 bg-[#fbfbf8] px-4 py-4 text-sm leading-7 text-[#102e26] outline-none transition placeholder:text-[#939c96] hover:border-[#123c31]/30 focus:border-[#27624e] focus:bg-white focus:ring-4 focus:ring-[#27624e]/10"
            id="feedback-message"
            maxLength={MAX_MESSAGE_LENGTH}
            name="message"
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t.messagePlaceholder}
            rows={5}
          />
          <p className="mt-2 text-right text-xs tabular-nums text-[#87918a] sm:hidden">
            {t.characterCount(message.length)}
          </p>
        </section>

        <section
          aria-labelledby="feedback-photos-heading"
          className="border-t border-[#123c31]/10 pt-7"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#8b7137]">
                02 · {t.uploadPhoto}
              </p>
              <h3
                className="mt-2 text-lg font-bold tracking-[-.03em] text-[#102e26]"
                id="feedback-photos-heading"
              >
                {t.photos}
              </h3>
              <p className="mt-1 text-sm leading-6 text-[#748078]">{t.photosHelp}</p>
            </div>
            <span className="text-xs font-semibold text-[#718078]">
              {t.photoCount(photos.length)}
            </span>
          </div>
          <input
            accept="image/*"
            aria-label={t.uploadPhoto}
            className="sr-only"
            multiple
            onChange={(event) => {
              addPhotos(event.target.files)
              event.target.value = ''
            }}
            ref={photoInputRef}
            type="file"
          />
          <button
            aria-label={t.addPhotos}
            className={`mt-4 flex min-h-32 w-full flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-6 text-center transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 ${dragging ? 'border-[#27624e] bg-[#edf4ee]' : 'border-[#123c31]/25 bg-[#fbfbf8] hover:border-[#27624e]/60 hover:bg-[#f5f7f2]'}`}
            onClick={() => photoInputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              setDragging(false)
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handlePhotoDrop}
            type="button"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#e7eee7] text-[#27624e]">
              <Icon className="h-5 w-5" name="photo" />
            </span>
            <span className="mt-3 text-sm font-bold text-[#244438]">{t.addPhotos}</span>
            <span className="mt-1 text-xs text-[#87918a]">{t.photosHint}</span>
          </button>
          {photoError && (
            <p className="mt-2 text-sm font-semibold text-red-700" role="alert">
              {photoError === 'tooLarge' ? t.tooLarge : t.photoLimit}
            </p>
          )}
          {photos.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
              {photos.map((photo, index) => (
                <div
                  className="feedback-photo-enter group relative aspect-square overflow-hidden rounded-xl border border-[#123c31]/10 bg-[#f3f1e9]"
                  key={photo.previewURL}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={photo.file.name}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    src={photo.previewURL}
                  />
                  <button
                    aria-label={`${t.removePhoto}: ${photo.file.name}`}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#102e26]/85 text-lg text-white shadow transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    onClick={() => removePhoto(index)}
                    type="button"
                  >
                    ×
                  </button>
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-2 pb-2 pt-5 text-left text-[10px] font-medium text-white">
                    {photo.file.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          aria-labelledby="feedback-document-heading"
          className="border-t border-[#123c31]/10 pt-7"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#8b7137]">
              03 · {t.uploadDocument}
            </p>
            <h3
              className="mt-2 text-lg font-bold tracking-[-.03em] text-[#102e26]"
              id="feedback-document-heading"
            >
              {t.document}
            </h3>
            <p className="mt-1 text-sm leading-6 text-[#748078]">{t.documentHelp}</p>
          </div>
          <input
            accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            aria-label={t.uploadDocument}
            className="sr-only"
            name="document"
            onChange={handleDocumentChange}
            ref={documentInputRef}
            type="file"
          />
          {documentFile ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#123c31]/15 bg-[#f8f8f3] p-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e7eee7] text-[#27624e]">
                <Icon name="file" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-[#244438]">
                  {documentFile.name}
                </span>
                <span className="mt-0.5 block text-xs text-[#87918a]">
                  {formatBytes(documentFile.size)}
                </span>
              </span>
              <button
                aria-label={t.removeDocument}
                className="min-h-10 rounded-lg px-3 text-xs font-bold text-[#6e7972] transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
                onClick={() => {
                  setDocumentFile(null)
                  if (documentInputRef.current) documentInputRef.current.value = ''
                }}
                type="button"
              >
                × <span className="sr-only">{t.removeDocument}</span>
              </button>
            </div>
          ) : (
            <button
              className="mt-4 flex min-h-16 w-full items-center gap-3 rounded-xl border border-[#123c31]/15 bg-[#fbfbf8] px-4 py-3 text-left transition hover:border-[#27624e]/50 hover:bg-[#f5f7f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
              onClick={() => documentInputRef.current?.click()}
              type="button"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#e7eee7] text-[#27624e]">
                <Icon name="file" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-bold text-[#244438]">{t.chooseDocument}</span>
                <span className="mt-0.5 block text-xs text-[#87918a]">{t.documentHint}</span>
              </span>
              <span className="text-xl text-[#829087]" aria-hidden="true">
                +
              </span>
            </button>
          )}
          {documentError && (
            <p className="mt-2 text-sm font-semibold text-red-700" role="alert">
              {t.tooLarge}
            </p>
          )}
        </section>

        <section
          aria-labelledby="feedback-voice-heading"
          className="border-t border-[#123c31]/10 pt-7"
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#8b7137]">
              04 · {t.optional}
            </p>
            <h3
              className="mt-2 text-lg font-bold tracking-[-.03em] text-[#102e26]"
              id="feedback-voice-heading"
            >
              {t.voice}
            </h3>
            <p className="mt-1 text-sm leading-6 text-[#748078]">{t.voiceHelp}</p>
          </div>
          <div className="mt-4 rounded-2xl border border-[#123c31]/10 bg-[#f5f6f1] p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-4">
              <button
                aria-label={recording ? t.stop : t.record}
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white shadow-md transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 ${recording ? 'animate-pulse bg-red-600 shadow-red-900/20 hover:bg-red-700' : 'bg-[#123c31] shadow-emerald-950/15 hover:-translate-y-0.5 hover:bg-[#0a2821]'}`}
                onClick={toggleRecording}
                type="button"
              >
                <Icon className="h-6 w-6" name={recording ? 'check' : 'mic'} />
              </button>
              <div className="min-w-0 flex-1">
                <p
                  aria-live="polite"
                  className={`text-sm font-bold ${recording ? 'text-red-700' : 'text-[#244438]'}`}
                >
                  {recording ? t.recording : voiceBlob ? t.voiceReady : t.record}
                </p>
                <p className="mt-1 text-xs text-[#87918a]">
                  {recording
                    ? t.seconds(recordingSeconds)
                    : voiceBlob
                      ? t.seconds(voiceBlob.seconds)
                      : t.voiceLimit}
                </p>
              </div>
              {recording && (
                <span
                  aria-hidden="true"
                  className="flex items-center gap-2 text-xs font-semibold text-red-700"
                >
                  <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" /> REC
                </span>
              )}
              {voiceBlob && !recording && (
                <button
                  aria-label={t.removeVoice}
                  className="min-h-10 rounded-lg px-3 text-xs font-bold text-[#6e7972] transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
                  onClick={removeVoice}
                  type="button"
                >
                  × <span className="sr-only">{t.removeVoice}</span>
                </button>
              )}
            </div>
            {voiceBlob && voiceURL && (
              <audio
                aria-label={t.playVoice}
                className="mt-4 h-10 w-full accent-[#27624e]"
                controls
                src={voiceURL}
              />
            )}
          </div>
          {recordError === 'denied' && (
            <p className="mt-2 text-sm font-semibold text-amber-800" role="alert">
              {t.voiceDenied}
            </p>
          )}
          {recordError === 'unavailable' && (
            <p className="mt-2 text-sm font-semibold text-amber-800" role="alert">
              {t.voiceUnavailable}
            </p>
          )}
        </section>

        {state.error === 'server' && (
          <p
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
            role="alert"
          >
            {t.error}
          </p>
        )}

        <div className="border-t border-[#123c31]/10 pt-7">
          <button
            className="group flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#123c31] px-6 py-4 text-sm font-bold uppercase tracking-[.1em] text-white shadow-[0_10px_25px_rgba(18,60,49,.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#0a2821] hover:shadow-[0_14px_30px_rgba(18,60,49,.25)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 disabled:cursor-not-allowed disabled:opacity-55"
            disabled={pending || rating === 0}
            type="submit"
          >
            {pending ? (
              <>
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                />
                {t.sending}
              </>
            ) : (
              <>
                {t.submit}
                <Icon
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  name="arrow"
                />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}
