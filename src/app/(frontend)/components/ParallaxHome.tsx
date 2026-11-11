'use client'

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { PublicHomeContent, PublicMedia, PublicVideo } from '@/lib/public-content'
import { InstallAppButton } from './InstallAppButton'

type IconName =
  | 'arrow'
  | 'book'
  | 'check'
  | 'compass'
  | 'heart'
  | 'menu'
  | 'mountain'
  | 'play'
  | 'spark'
  | 'users'
  | 'x'

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    book: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    compass: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m16 8-2.5 5.5L8 16l2.5-5.5Z" />
      </>
    ),
    heart: (
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
    ),
    menu: (
      <>
        <path d="M4 7h16M4 17h16" />
      </>
    ),
    mountain: (
      <>
        <path d="m3 20 6-11 4 6 2-3 6 8Z" />
        <path d="m7.5 11.7 1.6 1 1.4-1.2" />
      </>
    ),
    play: <path d="m9 7 8 5-8 5Z" />,
    spark: (
      <path d="m12 3-1.2 4.2A5 5 0 0 1 7.3 11L3 12l4.3 1a5 5 0 0 1 3.5 3.8L12 21l1.2-4.2a5 5 0 0 1 3.5-3.8l4.3-1-4.3-1a5 5 0 0 1-3.5-3.8Z" />
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
      </>
    ),
    x: (
      <>
        <path d="m6 6 12 12M18 6 6 18" />
      </>
    ),
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

type SocialPlatform = 'telegram' | 'whatsapp' | 'linkedin' | 'tiktok' | 'instagram' | 'youtube' | 'x' | 'snapchat'

function SocialIcon({ platform, size = 17 }: { platform: SocialPlatform; size?: number }) {
  const paths: Record<SocialPlatform, ReactNode> = {
    telegram: <path d="m21 4-3 16-6-5-3 2 1-5L4 9l17-5Zm-9 10 6-7-8 5 2 2Z" />,
    whatsapp: (
      <>
        <path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5Z" />
        <path d="M9 8.5c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.7 1.7c.1.2.1.4-.1.6l-.5.6c.6 1.1 1.5 1.8 2.7 2.3l.5-.6c.2-.2.4-.2.6-.1l1.7.8c.2.1.3.3.2.5-.2 1-.8 1.4-1.6 1.4-2.6-.1-5.8-2.8-6.3-5.4-.2-.7.1-1.4.4-1.8Z" />
      </>
    ),
    linkedin: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 10v6M8 7.5v.1M12 16v-3.2a2.8 2.8 0 0 1 5.6 0V16M12 10v6" />
      </>
    ),
    tiktok: <path d="M14 4v10.2a3.7 3.7 0 1 1-3-3.6M14 4c.5 2.1 1.8 3.5 4 4" />,
    instagram: (
      <>
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.7" r=".7" fill="currentColor" stroke="none" />
      </>
    ),
    youtube: (
      <>
        <path d="M21 12s0-3.5-.4-4.8a2.5 2.5 0 0 0-1.8-1.8C17.5 5 12 5 12 5s-5.5 0-6.8.4a2.5 2.5 0 0 0-1.8 1.8C3 8.5 3 12 3 12s0 3.5.4 4.8a2.5 2.5 0 0 0 1.8 1.8c1.3.4 6.8.4 6.8.4s5.5 0 6.8-.4a2.5 2.5 0 0 0 1.8-1.8C21 15.5 21 12 21 12Z" />
        <path d="m10 9 5 3-5 3Z" />
      </>
    ),
    x: <path d="m5 5 14 14M19 5 5 19" />,
    snapchat: <path d="M12 4.5a4 4 0 0 0-4 4v2.2c0 .7-.5 1.3-1.2 1.5l-1.3.4c-.4.1-.4.7 0 .8l1.7.4c.3.1.5.3.6.6.2.6.8 1 1.5 1.1.4.1.7.4.9.7.4.7 1 1.3 1.8 1.6.8-.3 1.4-.9 1.8-1.6.2-.3.5-.6.9-.7.7-.1 1.3-.5 1.5-1.1.1-.3.3-.5.6-.6l1.7-.4c.4-.1.4-.7 0-.8l-1.3-.4a1.6 1.6 0 0 1-1.2-1.5V8.5a4 4 0 0 0-4-4Z" />,
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[platform]}
    </svg>
  )
}

const copy = {
  en: {
    tagline: 'FAITH · ADVENTURE · COMMUNITY',
    navGather: 'Why we gather',
    navExperiences: 'Experiences',
    navStory: 'Our story',
    navSocial: 'Social wall',
    nextExperience: 'Find your next experience',
    menu: 'Toggle menu',
    heroEyebrow: 'FAITH · ADVENTURE · BELONGING',
    heroTitle: 'Change your angle.',
    heroEmphasis: 'Find your path.',
    heroDescription:
      'Meaningful experiences for young adults in Ethiopia—where faith goes deeper, horizons grow wider, and strangers become family.',
    explore: 'Explore experiences',
    about: 'See what we’re about',
    upNext: 'UP NEXT',
    registrationOpen: 'REGISTRATION OPEN',
    seeExperience: 'See the experience',
    scroll: 'SCROLL TO DISCOVER',
    communityProof: 'BUILT BY COMMUNITY, FOR COMMUNITY',
    gatherKicker: 'WHY WE GATHER',
    gatherTitle: 'More than a weekend.',
    gatherEmphasis: 'A place to become.',
    gatherText:
      'We believe the best kind of growth happens shoulder to shoulder—on a trail, around a table, and in conversations that stay with you.',
    pillars: [
      [
        'Faith, made real',
        'Honest conversations, shared worship, and Scripture that meets everyday life.',
      ],
      [
        'Adventure, with purpose',
        'Thoughtfully planned trails and journeys through Ethiopia’s wild beauty.',
      ],
      [
        'People, not profiles',
        'A welcoming table for real friendships, mentorship, and belonging.',
      ],
      ['Growth, together', 'Practical ideas that help you step boldly into your calling.'],
    ],
    nextChapter: 'THE NEXT CHAPTER',
    experiencesTitle: 'Experiences worth',
    experiencesEmphasis: 'showing up for.',
    free: 'Free',
    spots: 'spots',
    externalRegistration: 'Open registration link',
    register: 'Register with Parallax',
    noExperiences: 'New experiences are being prepared.',
    noExperiencesHelp: 'Check back soon or follow Parallax for the next announcement.',
    planned: 'Carefully planned',
    verified: 'Verified registration',
    welcoming: 'Welcoming to newcomers',
    storyKicker: 'OUR STORY',
    storyFallbackTitle: 'We were looking for this too.',
    storyFallbackExcerpt: 'Come for the experience. Leave with a community.',
    storyFallbackBody:
      'Not another program to attend, but a community to belong to. A place where faith and real life meet—on mountain paths, in shared meals, and through friendships that keep growing.',
    storyCount: 'stories from our growing community',
    peopleWelcomed: 'PEOPLE WELCOMED',
    experiencesShared: 'EXPERIENCES SHARED',
    growingFamily: 'GROWING FAMILY',
    socialKicker: 'THE SOCIAL WALL',
    socialTitle: 'One community.',
    socialEmphasis: 'Every channel.',
    socialDescription:
      'Stories from Telegram, TikTok, Instagram, YouTube, and Facebook—curated by the Parallax team.',
    viewOriginal: 'View original',
    socialEmpty: 'The social wall is ready for your first curated post.',
    reelKicker: 'FROM THE COMMUNITY',
    reelFollow: 'Follow our socials',
    reelWatch: 'Watch more',
    takeNextStep: 'TAKE THE NEXT STEP',
    newsletterTitle: 'Your next story',
    newsletterEmphasis: 'starts here.',
    newsletterDescription: 'Monthly updates. New experiences. No noise—just the good stuff.',
    subscribedTitle: 'You’re on the trail.',
    subscribedText: 'We’ll send the next update your way.',
    email: 'Email address',
    emailPlaceholder: 'Your email address',
    join: 'Join the community',
    consent: 'By joining, you agree to receive occasional Parallax updates.',
    footerLine1: 'Change your angle.',
    footerLine2: 'Find your path.',
    backToTop: 'BACK TO TOP ↑',
  },
  am: {
    tagline: 'እምነት · ጀብዱ · ማህበረሰብ',
    navGather: 'ለምን እንሰባሰባለን',
    navExperiences: 'ጉዞዎችና ዝግጅቶች',
    navStory: 'ታሪካችን',
    navSocial: 'ማህበራዊ ገጽ',
    nextExperience: 'ቀጣዩን ተሞክሮዎን ያግኙ',
    menu: 'ምናሌን ክፈት',
    heroEyebrow: 'እምነት · ጀብዱ · አብሮነት',
    heroTitle: 'እይታዎን ይቀይሩ።',
    heroEmphasis: 'መንገድዎን ያግኙ።',
    heroDescription:
      'በኢትዮጵያ ላሉ ወጣቶች ትርጉም ያላቸው ተሞክሮዎች—እምነት የሚጠልቅበት፣ አድማስ የሚሰፋበት እና እንግዶች ቤተሰብ የሚሆኑበት።',
    explore: 'ተሞክሮዎችን ያስሱ',
    about: 'ስለ እኛ ይወቁ',
    upNext: 'ቀጣይ',
    registrationOpen: 'ምዝገባ ክፍት ነው',
    seeExperience: 'ተሞክሮውን ይመልከቱ',
    scroll: 'ለማሰስ ወደታች ይሂዱ',
    communityProof: 'በማህበረሰብ፣ ለማህበረሰብ',
    gatherKicker: 'ለምን እንሰባሰባለን',
    gatherTitle: 'ከአንድ ቅዳሜና እሁድ በላይ።',
    gatherEmphasis: 'የምናድግበት ስፍራ።',
    gatherText: 'እውነተኛ እድገት ትከሻ ለትከሻ—በጉዞ ላይ፣ በጠረጴዛ ዙሪያ እና ከእኛ ጋር በሚቆዩ ውይይቶች እንደሚፈጠር እናምናለን።',
    pillars: [
      ['እውነተኛ እምነት', 'ቅን ውይይት፣ የጋራ አምልኮ እና ከዕለት ተዕለት ሕይወት ጋር የሚገናኝ ቃል።'],
      ['ዓላማ ያለው ጀብዱ', 'በኢትዮጵያ ውብ ተፈጥሮ ውስጥ በጥንቃቄ የታቀዱ ጉዞዎች።'],
      ['ሰዎች፣ መገለጫዎች አይደሉም', 'ለእውነተኛ ወዳጅነት፣ ምክር እና አብሮነት ክፍት የሆነ ማህበረሰብ።'],
      ['አብረን እናድግ', 'ወደ ጥሪዎ በድፍረት እንዲራመዱ የሚረዱ ተግባራዊ ሀሳቦች።'],
    ],
    nextChapter: 'ቀጣዩ ምዕራፍ',
    experiencesTitle: 'ልትሳተፉባቸው የሚገቡ',
    experiencesEmphasis: 'ልዩ ተሞክሮዎች።',
    free: 'ነፃ',
    spots: 'ቦታዎች',
    externalRegistration: 'የምዝገባ ሊንኩን ክፈት',
    register: 'በፓራላክስ ይመዝገቡ',
    noExperiences: 'አዳዲስ ተሞክሮዎች በዝግጅት ላይ ናቸው።',
    noExperiencesHelp: 'በቅርቡ ይመለሱ ወይም ቀጣዩን ማስታወቂያ ለማግኘት ፓራላክስን ይከተሉ።',
    planned: 'በጥንቃቄ የታቀደ',
    verified: 'የተረጋገጠ ምዝገባ',
    welcoming: 'ለአዲስ ተሳታፊዎች ክፍት',
    storyKicker: 'ታሪካችን',
    storyFallbackTitle: 'እኛም ይህንን እንፈልግ ነበር።',
    storyFallbackExcerpt: 'ለተሞክሮው ይምጡ። ማህበረሰብ ይዘው ይመለሱ።',
    storyFallbackBody:
      'የሚሳተፉበት ሌላ ፕሮግራም ሳይሆን የሚካተቱበት ማህበረሰብ። እምነት ከእውነተኛ ሕይወት ጋር የሚገናኝበት—በተራራ መንገድ፣ በጋራ ምግብ እና በሚያድግ ወዳጅነት።',
    storyCount: 'የማህበረሰባችን ታሪኮች',
    peopleWelcomed: 'የተቀበልናቸው ሰዎች',
    experiencesShared: 'የጋራ ተሞክሮዎች',
    growingFamily: 'እያደገ ያለ ቤተሰብ',
    socialKicker: 'ማህበራዊ ገጽ',
    socialTitle: 'አንድ ማህበረሰብ።',
    socialEmphasis: 'በሁሉም መድረክ።',
    socialDescription: 'ከቴሌግራም፣ ቲክቶክ፣ ኢንስታግራም፣ ዩቲዩብ እና ፌስቡክ የተመረጡ ታሪኮች።',
    viewOriginal: 'ዋናውን ይመልከቱ',
    socialEmpty: 'ማህበራዊ ገጹ ለመጀመሪያው ልጥፍዎ ዝግጁ ነው።',
    reelKicker: 'ከማህበረሰቡ',
    reelFollow: 'ማህበራዊ ገጾቻችንን ይከተሉ',
    reelWatch: 'ተጨማሪ ይመልከቱ',
    takeNextStep: 'ቀጣዩን እርምጃ ይውሰዱ',
    newsletterTitle: 'ቀጣዩ ታሪክዎ',
    newsletterEmphasis: 'ከዚህ ይጀምራል።',
    newsletterDescription: 'ወርሃዊ ዜናዎች፣ አዳዲስ ተሞክሮዎች—ጠቃሚው ብቻ።',
    subscribedTitle: 'ከእኛ ጋር ነዎት።',
    subscribedText: 'ቀጣዩን ዜና እንልክልዎታለን።',
    email: 'ኢሜይል',
    emailPlaceholder: 'ኢሜይልዎ',
    join: 'ማህበረሰቡን ይቀላቀሉ',
    consent: 'በመቀላቀል አልፎ አልፎ የፓራላክስ ዜና ለመቀበል ተስማምተዋል።',
    footerLine1: 'እይታዎን ይቀይሩ።',
    footerLine2: 'መንገድዎን ያግኙ።',
    backToTop: 'ወደ ላይ ↑',
  },
} as const

const pillarIcons: IconName[] = ['book', 'compass', 'users', 'spark']

function eventDate(value: string, locale: 'en' | 'am') {
  const date = new Date(value)
  const dateLocale = locale === 'am' ? 'am-ET' : 'en'
  return {
    day: new Intl.DateTimeFormat(dateLocale, { day: '2-digit' }).format(date),
    month: new Intl.DateTimeFormat(dateLocale, { month: 'short' }).format(date).toUpperCase(),
    year: date.getFullYear(),
  }
}

function platformLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

type ReelItem = {
  key: string
  href: string
  platform: string
  kind: 'social' | 'story' | 'experience'
  experienceID?: string
  video: PublicVideo | null
  image: PublicMedia | null
  caption: string
}

export function ParallaxHome({ content }: { content: Record<'en' | 'am', PublicHomeContent> }) {
  const [language, setLanguage] = useState<'en' | 'am'>('en')
  const [subscribed, setSubscribed] = useState(false)
  const [reelIndex, setReelIndex] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const { experiences, stories, socialPosts, socialLinks } = content[language]
  const t = copy[language]
  const featured = experiences[0]
  const story = stories[0]

  // Build the hero reel from published admin content: videos, photos, and social posts.
  const reelItems: ReelItem[] = socialPosts.slice(0, 8).map((post) => ({
    key: `post-${post.id}`,
    href: post.postURL,
    platform: post.platform,
    kind: 'social' as const,
    video: post.video,
    image: post.thumbnail,
    caption: post.caption,
  }))
  if (stories[0]?.video && reelItems.length < 8) {
    reelItems.push({
      key: 'story-video',
      href: '#story',
      platform: 'story',
      kind: 'story' as const,
      video: stories[0].video,
      image: stories[0].image,
      caption: stories[0].title,
    })
  }
  if (stories[0]?.image && reelItems.length < 8) {
    reelItems.push({
      key: 'story-photo',
      href: '#story',
      platform: 'story',
      kind: 'story' as const,
      video: null,
      image: stories[0].image,
      caption: stories[0].title,
    })
  }
  for (const event of experiences) {
    if (String(event.id) === String(featured?.id)) continue
    if (reelItems.length >= 8) break
    if (event.video) {
      reelItems.push({
        key: `event-${event.id}-video`,
        href: '#events',
        platform: event.kind,
        kind: 'experience' as const,
        experienceID: String(event.id),
        video: event.video,
        image: event.image,
        caption: event.title,
      })
    }
    if (event.image && reelItems.length < 8) {
      reelItems.push({
        key: `event-${event.id}-photo`,
        href: '#events',
        platform: event.kind,
        kind: 'experience' as const,
        experienceID: String(event.id),
        video: null,
        image: event.image,
        caption: event.title,
      })
    }
  }

  useEffect(() => {
    const item = reelItems[reelIndex]
    if (!item || item.video) return undefined
    const timer = window.setTimeout(() => {
      setReelIndex((current) => (current + 1) % reelItems.length)
    }, 4200)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reelIndex, reelItems.length])

  useEffect(() => {
    const item = reelItems[reelIndex]
    if (!item?.video || !videoRef.current) return undefined
    const video = videoRef.current
    video.muted = true
    const play = video.play()
    if (play) play.catch(() => undefined)
    const advance = () => setReelIndex((current) => (current + 1) % reelItems.length)
    video.addEventListener('ended', advance)
    return () => video.removeEventListener('ended', advance)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reelIndex, reelItems.length])

  useEffect(() => {
    const saved = window.localStorage.getItem('parallax-language')
    if (saved === 'en' || saved === 'am') setLanguage(saved)
  }, [])

  function selectLanguage(locale: 'en' | 'am') {
    setLanguage(locale)
    window.localStorage.setItem('parallax-language', locale)
    document.documentElement.lang = locale
  }

  function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubscribed(true)
  }

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Parallax">
          <img className="brand-logo" src="/logo.jpg" alt="Parallax" />
        </a>
        <div className="mobile-top-language" aria-label="Language">
          <button type="button" onClick={() => selectLanguage('en')} aria-pressed={language === 'en'}>
            EN
          </button>
          <button type="button" onClick={() => selectLanguage('am')} aria-pressed={language === 'am'}>
            አማ
          </button>
        </div>
        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="#gather">{t.navGather}</a>
          <a href="#events">{t.navExperiences}</a>
          <a href="#story">{t.navStory}</a>
          <a href="#social">{t.navSocial}</a>
        </nav>
        <div className="header-actions">
          <div className="language" aria-label="Language">
            {(['en', 'am'] as const).map((item) => (
              <button
                type="button"
                className={language === item ? 'active' : ''}
                onClick={() => selectLanguage(item)}
                key={item}
                aria-pressed={language === item}
              >
                {item === 'en' ? 'EN' : 'አማ'}
              </button>
            ))}
          </div>
          <a className="header-cta" href="#events">
            {t.nextExperience} <Icon name="arrow" size={17} />
          </a>
        </div>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          <a href="#top" aria-label="Home">
            <Icon name="mountain" size={18} />
            <span>Home</span>
          </a>
          <a href="#gather" aria-label={t.navGather}>
            <Icon name="heart" size={18} />
            <span>{language === 'am' ? 'ማህበረሰብ' : 'Gather'}</span>
          </a>
          <a href="#events" aria-label={t.navExperiences}>
            <Icon name="compass" size={18} />
            <span>{language === 'am' ? 'ጉዞዎች' : 'Trips'}</span>
          </a>
          <a href="#story" aria-label={t.navStory}>
            <Icon name="book" size={18} />
            <span>{language === 'am' ? 'ታሪክ' : 'Story'}</span>
          </a>
          <a href="#social" aria-label={t.navSocial}>
            <Icon name="users" size={18} />
            <span>{language === 'am' ? 'ማህበራዊ' : 'Social'}</span>
          </a>
        </nav>
      </header>

      <main>
        <section className="hero" id="top">
          <img
            src="/images/hero.jpg"
            alt="Friends hiking along a mountain ridge at sunrise"
          />
          <div className="hero-shade" />
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-content">
            <div className="hero-copy">
              <p className="eyebrow light">
                <span /> {t.heroEyebrow}
              </p>
              <h1>
                {t.heroTitle}
                <br />
                <em>{t.heroEmphasis}</em>
              </h1>
              <p className="hero-description">{t.heroDescription}</p>
              <div className="hero-actions">
                <a className="button button-gold" href="#events">
                  {t.explore} <Icon name="arrow" />
                </a>
                <a className="text-link" href="#story">
                  <span className="play">
                    <Icon name="play" size={16} />
                  </span>{' '}
                  {t.about}
                </a>
              </div>
            </div>
            {reelItems.length > 0 && (
              <aside className="community-reel" aria-label={t.reelKicker}>
                <p className="reel-kicker">{t.reelKicker}</p>
                <div className="reel-stage">
                  {reelItems.map((item, index) => {
                    const active = index === reelIndex
                    return (
                      <div
                        className={`reel-item${active ? ' is-active' : ''}${index < reelIndex ? ' is-behind' : ''}`}
                        key={item.key}
                        aria-hidden={!active}
                      >
                        {item.video ? (
                          active ? (
                            <video
                              ref={videoRef}
                              autoPlay
                              muted
                              loop
                              playsInline
                              preload="auto"
                              aria-label={item.video.alt || item.caption}
                              src={item.video.url}
                            />
                          ) : (
                            <video muted playsInline preload="none" aria-hidden src={item.video.url} />
                          )
                        ) : item.image ? (
                          <img
                            src={item.image.url}
                            alt={item.image.alt || ''}
                          />
                        ) : (
                          <div className="reel-quote">
                            <strong>{item.caption}</strong>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <div className="reel-copy">
                  <span>{reelItems[reelIndex]?.platform ? platformLabel(reelItems[reelIndex].platform) : ''}</span>
                  <p>{reelItems[reelIndex]?.caption || ''}</p>
                </div>
                <div className="reel-dots">
                  {reelItems.map((item, index) => (
                    <button
                      type="button"
                      className={index === reelIndex ? 'is-active' : ''}
                      onClick={() => setReelIndex(index)}
                      key={item.key}
                      aria-label={`Item ${index + 1}`}
                      aria-pressed={index === reelIndex}
                    />
                  ))}
                </div>
                <div className="reel-follow">
                  {reelItems[reelIndex]?.kind === 'experience' ? (
                    <a
                      className="button button-gold reel-follow-button"
                      href={`/register/${reelItems[reelIndex]?.experienceID || ''}`}
                    >
                      <Icon name="check" size={15} /> {t.register}
                    </a>
                  ) : (
                    <>
                      <a className="button button-gold reel-follow-button" href="#social">
                        <Icon name="heart" size={15} /> {t.reelFollow}
                      </a>
                      <a className="text-link" href="#social">
                        {t.reelWatch} <Icon name="arrow" size={14} />
                      </a>
                    </>
                  )}
                </div>
              </aside>
            )}
            {featured && (
              <aside className="next-card">
                <div className="next-card-top">
                  <span>{t.upNext}</span>
                  <span className="spots">
                    <i /> {t.registrationOpen}
                  </span>
                </div>
                {featured.image && (
                  <img
                    className="next-card-image"
                    src={featured.image.url}
                    alt={featured.image.alt || featured.title}
                  />
                )}
                <div className="next-date">
                  <strong>{eventDate(featured.startDate, language).day}</strong>
                  <span>
                    {eventDate(featured.startDate, language).month}
                    <br />
                    {eventDate(featured.startDate, language).year}
                  </span>
                </div>
                <h3>{featured.title}</h3>
                <p>
                  <Icon name="mountain" size={16} /> {featured.kind} · {featured.location}
                </p>
                <div className="next-card-actions">
                  <a href="#events">
                    {t.seeExperience} <Icon name="arrow" size={17} />
                  </a>
                  <a
                    className="next-card-register"
                    href={`/register/${featured.id}`}
                  >
                    {t.register} <Icon name="check" size={15} />
                  </a>
                </div>
              </aside>
            )}
          </div>
          <div className="hero-bottom">
            <p>{t.scroll}</p>
            <div className="scroll-line">
              <span />
            </div>
            <p className="hero-proof">
              <Icon name="heart" size={16} /> {t.communityProof}
            </p>
          </div>
        </section>

        <section className="intro" id="gather">
          <div className="section-kicker">
            <span>01</span>
            <p>{t.gatherKicker}</p>
          </div>
          <div className="intro-heading">
            <h2>
              {t.gatherTitle}
              <br />
              <em>{t.gatherEmphasis}</em>
            </h2>
            <p>{t.gatherText}</p>
          </div>
          <div className="pillars">
            {t.pillars.map((pillar, index) => (
              <article className="pillar" key={pillar[0]}>
                <div className="pillar-top">
                  <span className="pillar-icon">
                    <Icon name={pillarIcons[index]} />
                  </span>
                  <small>0{index + 1}</small>
                </div>
                <h3>{pillar[0]}</h3>
                <p>{pillar[1]}</p>
                <div className="pillar-rule" />
              </article>
            ))}
          </div>
        </section>

        <section className="events-section" id="events">
          <div className="section-kicker light-kicker">
            <span>02</span>
            <p>{t.nextChapter}</p>
          </div>
          <div className="events-heading">
            <h2>
              {t.experiencesTitle}
              <br />
              <em>{t.experiencesEmphasis}</em>
            </h2>
          </div>
          {experiences.length ? (
            <div className="events-grid">
              {experiences.map((event, index) => {
                const date = eventDate(event.startDate, language)
                return (
                  <article className="event-card" key={String(event.id)}>
                    <div className="event-image">
                      {event.video ? (
                        <video
                          className="event-video"
                          controls
                          autoPlay
                          muted
                          loop
                          playsInline
                          preload="auto"
                          aria-label={event.video.alt || event.title}
                          src={event.video.url}
                        />
                      ) : (
                        <img
                          src={event.image?.url || '/images/event-hike.jpg'}
                          alt={event.image?.alt || event.title}
                        />
                      )}
                      <span className="event-type">{event.kind}</span>
                      <div className="event-date">
                        <strong>{date.day}</strong>
                        <span>{date.month}</span>
                      </div>
                      <span className="card-index">0{index + 1}</span>
                    </div>
                    <div className="event-info">
                      <p>{event.location}</p>
                      <h3>{event.title}</h3>
                      <p className="event-summary">{event.summary}</p>
                      <div>
                        <span>
                          {event.price
                            ? `${event.price.toLocaleString()} ${event.currency || 'ETB'}`
                            : t.free}
                          {event.capacity ? ` · ${event.capacity} ${t.spots}` : ''}
                        </span>
                      </div>
                      {event.registrationURL && (
                        <a
                          className="external-registration"
                          href={event.registrationURL}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t.externalRegistration} <Icon name="arrow" size={16} />
                        </a>
                      )}
                      {event.resourceURL && (
                        <a
                          className="external-registration"
                          href={event.resourceURL}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {language === 'am' ? 'ተጨማሪ መረጃ' : 'More information'} <Icon name="arrow" size={16} />
                        </a>
                      )}
                      <a className="external-registration" href={`/register/${event.id}`}>
                        {t.register} <Icon name="arrow" size={16} />
                      </a>
                    </div>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="empty-state">
              <p>{t.noExperiences}</p>
              <span>{t.noExperiencesHelp}</span>
            </div>
          )}
          <div className="trust-row">
            <span>
              <Icon name="check" size={17} /> {t.planned}
            </span>
            <span>
              <Icon name="check" size={17} /> {t.verified}
            </span>
            <span>
              <Icon name="check" size={17} /> {t.welcoming}
            </span>
          </div>
        </section>

        <section className="story-section" id="story">
          <div className="story-image">
            {story?.video ? (
              <video
                className="story-video"
                controls
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                aria-label={story.video.alt || story.title}
                src={story.video.url}
              />
            ) : (
              <img
                src={story?.image?.url || '/images/story.jpg'}
                alt={story?.image?.alt || 'Ethiopian highlands'}
              />
            )}
            <div className="story-quote">
              <span>“</span>
              <p>{story?.excerpt || t.storyFallbackExcerpt}</p>
              <small>— {story?.authorName || 'PARALLAX COMMUNITY'}</small>
            </div>
          </div>
          <div className="story-copy">
            <div className="section-kicker">
              <span>03</span>
              <p>{t.storyKicker}</p>
            </div>
            <h2>{story?.title || t.storyFallbackTitle}</h2>
            <p className="story-lead">{story?.excerpt || t.storyFallbackExcerpt}</p>
            <p>{story?.body || t.storyFallbackBody}</p>
            {stories.length > 1 && (
              <p className="story-count">
                {stories.length} {t.storyCount}
              </p>
            )}
            <div className="story-stats">
              <div>
                <strong>180+</strong>
                <span>{t.peopleWelcomed}</span>
              </div>
              <div>
                <strong>14</strong>
                <span>{t.experiencesShared}</span>
              </div>
              <div>
                <strong>1</strong>
                <span>{t.growingFamily}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="social-section" id="social">
          <div className="section-kicker">
            <span>04</span>
            <p>{t.socialKicker}</p>
          </div>
          <div className="social-heading">
            <h2>
              {t.socialTitle}
              <br />
              <em>{t.socialEmphasis}</em>
            </h2>
            <p>{t.socialDescription}</p>
          </div>
          {socialPosts.length ? (
            <div className="social-grid">
              {socialPosts.map((post) => (
                post.video ? (
                  <article className="social-card social-card--video" key={String(post.id)}>
                    <video
                      controls
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="auto"
                      aria-label={post.video.alt || post.caption}
                      src={post.video.url}
                    />
                    <div className="social-card-copy">
                      <span>{platformLabel(post.platform)}</span>
                      <p>{post.caption}</p>
                      <a href={post.postURL} target="_blank" rel="noreferrer">
                        {t.viewOriginal} <Icon name="arrow" size={14} />
                      </a>
                    </div>
                  </article>
                ) : (
                  <a
                    href={post.postURL}
                    target="_blank"
                    rel="noreferrer"
                    className="social-card"
                    key={String(post.id)}
                  >
                    {post.thumbnail && (
                      <img
                        src={post.thumbnail.url}
                        alt={post.thumbnail.alt || ''}
                      />
                    )}
                    <span>{platformLabel(post.platform)}</span>
                    <p>{post.caption}</p>
                    <small>
                      {t.viewOriginal} <Icon name="arrow" size={14} />
                    </small>
                  </a>
                )
              ))}
            </div>
          ) : (
            <div className="social-empty">{t.socialEmpty}</div>
          )}
        </section>

        <section className="newsletter" id="join">
          <div>
            <p className="eyebrow">
              <span /> {t.takeNextStep}
            </p>
            <h2>
              {t.newsletterTitle}
              <br />
              <em>{t.newsletterEmphasis}</em>
            </h2>
          </div>
          <div className="signup">
            <p>{t.newsletterDescription}</p>
            {subscribed ? (
              <div className="success">
                <span>
                  <Icon name="check" />
                </span>
                <div>
                  <strong>{t.subscribedTitle}</strong>
                  <small>{t.subscribedText}</small>
                </div>
              </div>
            ) : (
              <form onSubmit={subscribe}>
                <label>
                  <span className="sr-only">{t.email}</span>
                  <input type="email" required placeholder={t.emailPlaceholder} />
                </label>
                <button type="submit">
                  {t.join} <Icon name="arrow" />
                </button>
              </form>
            )}
            <small>{t.consent}</small>
          </div>
        </section>
      </main>

      <footer>
        <div className="footer-main">
          <a className="brand footer-brand" href="#top">
            <img className="brand-logo" src="/logo.jpg" alt="Parallax" />
          </a>
          <p>
            {t.footerLine1}
            <br />
            {t.footerLine2}
          </p>
          <nav>
            <a href="#gather">{t.navGather}</a>
            <a href="#events">{t.navExperiences}</a>
            <a href="#story">{t.navStory}</a>
            <a href="#social">{t.navSocial}</a>
          </nav>
          <div className="socials">
            {socialLinks.map((link) => (
              <a aria-label={link.platform} href={link.url} key={link.platform} target="_blank" rel="noreferrer">
                <SocialIcon platform={link.platform as SocialPlatform} />
              </a>
            ))}
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 PARALLAX ETHIOPIA</p>
          <p>{t.tagline}</p>
          <a href="#top">{t.backToTop}</a>
          <InstallAppButton className="text-xs font-semibold text-white/80" />
          <a href="/admin/login">Team sign in</a>
        </div>
      </footer>
    </div>
  )
}
