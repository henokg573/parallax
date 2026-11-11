import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-auth'
import { isTelegramConfigured } from '@/lib/telegram'
import AdminShell from '../admin-shell'
import { changeAdminPassword, saveAdminProfile, testTelegramConnection } from '../actions'

export const dynamic = 'force-dynamic'

const fieldClass = 'w-full rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15'

const errors: Record<string, string> = {
  'profile-invalid': 'Enter a valid email address and a name with at least two characters.',
  'current-password': 'The current password is incorrect.',
  'email-taken': 'That email address is already in use by another admin.',
  'password-length': 'Your new password must be between 12 and 200 characters.',
  'password-mismatch': 'The new passwords do not match.',
  'password-unchanged': 'Choose a new password different from your current one.',
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; profile?: string; password?: string; telegram?: string }>
}) {
  const admin = await getAdminSession()
  if (!admin) redirect('/admin/login?next=%2Fadmin%2Fsettings')
  const query = await searchParams

  return (
    <AdminShell admin={admin} active="/admin/settings" title="Account settings" subtitle="Update your admin profile and password.">
      {query.error && errors[query.error] && (
        <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900" role="alert">
          {errors[query.error]}
        </p>
      )}
      {query.profile && (
        <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          Account details saved.
        </p>
      )}
      {query.password && (
        <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          Password changed successfully.
        </p>
      )}
      {query.telegram === 'sent' && (
        <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          Test notification sent to the configured Telegram chat.
        </p>
      )}
      {query.telegram === 'failed' && (
        <p className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900" role="alert">
          Telegram could not deliver the test message. Check the bot token, chat ID, and the bot's access to the chat.
        </p>
      )}
      {(query.telegram === 'not-configured' || query.telegram === 'missing') && (
        <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
          Telegram is not configured. Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to the server environment, then redeploy.
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-zinc-950">Profile</h2>
          <p className="mt-1 text-sm text-zinc-600">Your name and sign-in email are visible to your team.</p>
          <form action={saveAdminProfile} className="mt-5 grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
              Display name
              <input autoComplete="name" className={fieldClass} maxLength={120} name="display_name" required defaultValue={admin.display_name} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
              Sign-in email
              <input autoComplete="email" className={fieldClass} maxLength={190} name="email" required type="email" defaultValue={admin.email} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
              Current password to confirm changes
              <input autoComplete="current-password" className={fieldClass} name="current_password" required type="password" />
            </label>
            <button className="w-fit rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700" type="submit">
              Save profile
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-zinc-950">Change password</h2>
          <p className="mt-1 text-sm text-zinc-600">Use at least 12 characters. Your current password is required.</p>
          <form action={changeAdminPassword} className="mt-5 grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
              Current password
              <input autoComplete="current-password" className={fieldClass} name="current_password" required type="password" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
              New password
              <input autoComplete="new-password" className={fieldClass} minLength={12} maxLength={200} name="new_password" required type="password" />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-zinc-800">
              Confirm new password
              <input autoComplete="new-password" className={fieldClass} minLength={12} maxLength={200} name="confirm_password" required type="password" />
            </label>
            <button className="w-fit rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700" type="submit">
              Change password
            </button>
          </form>
        </section>
      </div>

      {admin.role === 'super-admin' && (
        <section className="mt-5 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-zinc-950">Telegram registration notifications</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {isTelegramConfigured()
              ? 'Bot credentials are configured on the server. New registrations and payment decisions will be sent to the configured chat.'
              : 'Not configured. Set the bot token and group chat ID as server-only environment variables. Never put the bot token in source code or a NEXT_PUBLIC variable.'}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            Add the bot to the group and allow it to send messages. Registration alerts include the participant’s name, email, phone, preferred contact channel, payment reference, and experience.
          </p>
          <form action={testTelegramConnection} className="mt-4">
            <button className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50" type="submit">
              Send test notification
            </button>
          </form>
        </section>
      )}
    </AdminShell>
  )
}
