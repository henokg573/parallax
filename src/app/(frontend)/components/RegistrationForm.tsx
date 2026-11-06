'use client'

import { useActionState } from 'react'
import { registerForExperience, type RegistrationState } from '@/app/(frontend)/actions/register'

const initialState: RegistrationState = {
  success: false,
  message: '',
}

const labels = {
  en: {
    fullName: 'Full name',
    email: 'Email',
    phone: 'Phone',
    preferredChannel: 'Preferred communication channel',
    preferredChannelHelp: 'We will use this channel for registration updates.',
    reference: 'Payment reference',
    receipt: 'Payment receipt',
    receiptHelp: 'Upload a screenshot or PDF (maximum 5 MB).',
    send: 'Send registration',
    sending: 'Sending…',
  },
  am: {
    fullName: 'ሙሉ ስም',
    email: 'ኢሜይል',
    phone: 'ስልክ',
    preferredChannel: 'የመገናኛ መንገድ',
    preferredChannelHelp: 'ለምዝገባ ዝመናዎች ይህን መንገድ እንጠቀማለን።',
    reference: 'የክፍያ ማጣቀሻ',
    receipt: 'የክፍያ ደረሰኝ',
    receiptHelp: 'ስክሪንሾት ወይም PDF ይጫኑ (ከፍተኛ 5 MB)።',
    send: 'ምዝገባውን ላክ',
    sending: 'በመላክ ላይ…',
  },
} as const

export function RegistrationForm({
  experienceID,
  locale,
}: {
  experienceID: string
  locale: 'en' | 'am'
}) {
  const [state, action, pending] = useActionState(registerForExperience, initialState)
  const copy = labels[locale]

  if (state.success) {
    return <p className="registration-success">{state.message}</p>
  }

  return (
    <form action={action} className="registration-form">
      <input type="hidden" name="experience" value={experienceID} />
      <input type="hidden" name="locale" value={locale} />
      <label>
        <span>{copy.fullName}</span>
        <input name="fullName" required autoComplete="name" />
        {state.errors?.fullName && <small>{state.errors.fullName}</small>}
      </label>
      <label>
        <span>{copy.email}</span>
        <input name="email" type="email" required autoComplete="email" />
        {state.errors?.email && <small>{state.errors.email}</small>}
      </label>
      <label>
        <span>{copy.phone}</span>
        <input name="phone" required autoComplete="tel" />
        {state.errors?.phone && <small>{state.errors.phone}</small>}
      </label>
      <label>
        <span>{copy.preferredChannel}</span>
        <select name="preferredChannel" defaultValue="email" required>
          <option value="email">Email</option>
          <option value="phone">Phone call</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="telegram">Telegram</option>
        </select>
        <small className="field-help">{copy.preferredChannelHelp}</small>
        {state.errors?.preferredChannel && <small>{state.errors.preferredChannel}</small>}
      </label>
      <label>
        <span>{copy.reference}</span>
        <input name="paymentReference" required />
        {state.errors?.paymentReference && <small>{state.errors.paymentReference}</small>}
      </label>
      <label>
        <span>{copy.receipt}</span>
        <input name="paymentReceipt" type="file" required accept="image/*,application/pdf,.pdf" />
        <small className="field-help">{copy.receiptHelp}</small>
        {state.errors?.paymentReceipt && <small>{state.errors.paymentReceipt}</small>}
      </label>
      <button type="submit" disabled={pending}>
        {pending ? copy.sending : copy.send}
      </button>
      {state.message && <p className="form-message">{state.message}</p>}
    </form>
  )
}
