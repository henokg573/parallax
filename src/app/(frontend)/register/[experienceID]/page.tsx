import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { RegistrationForm } from '@/app/(frontend)/components/RegistrationForm'
import { getPublicHomeContent } from '@/lib/public-content'

export const dynamic = 'force-dynamic'

type RegistrationPageProps = {
  params: Promise<{ experienceID: string }>
}

export async function generateMetadata({ params }: RegistrationPageProps): Promise<Metadata> {
  const { experienceID } = await params
  const content = await getPublicHomeContent('en')
  const experience = content.experiences.find((item) => String(item.id) === experienceID)

  return {
    title: experience ? `Register for ${experience.title} | Parallax` : 'Registration | Parallax',
    description: experience?.summary || 'Register for a Parallax community experience.',
  }
}

export default async function RegistrationPage({ params }: RegistrationPageProps) {
  const { experienceID } = await params
  const content = await getPublicHomeContent('en')
  const experience = content.experiences.find((item) => String(item.id) === experienceID)

  if (!experience) notFound()

  return (
    <main className="registration-page">
      <a className="registration-back" href="/">
        ← Back to Parallax
      </a>
      <div className="registration-page-card">
        <p className="section-label">PARALLAX EXPERIENCE</p>
        <h1>Register for {experience.title}</h1>
        <p className="registration-page-summary">{experience.summary}</p>
        <p className="registration-page-details">
          {experience.location} · {new Date(experience.startDate).toLocaleDateString('en', {
            dateStyle: 'long',
          })}
        </p>
        <RegistrationForm experienceID={String(experience.id)} locale="en" />
      </div>
    </main>
  )
}
