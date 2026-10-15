import { getTranslations } from 'next-intl/server'
import { startProviderSignIn } from '@/lib/auth/password'
import type { Provider } from '@/lib/auth/schema'

/**
 * "Continue with Google" and "Continue with Microsoft" (owner, 15 October 2026; D-57): one form per provider
 * the Auth project has turned on (lib/auth/providers.ts), posting to the server action that sends the person
 * to the provider. A real button in a real form, so it works before any script runs. The marks are the
 * providers' own, as their sign-in guidelines ask; they are decoration beside the words.
 */
const MARKS: Record<Provider, React.ReactNode> = {
  google: (
    <svg aria-hidden width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A8.65 8.65 0 0 0 9 0 9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  ),
  azure: (
    <svg aria-hidden width="18" height="18" viewBox="0 0 18 18">
      <path fill="#F25022" d="M0 0h8.5v8.5H0z" />
      <path fill="#7FBA00" d="M9.5 0H18v8.5H9.5z" />
      <path fill="#00A4EF" d="M0 9.5h8.5V18H0z" />
      <path fill="#FFB900" d="M9.5 9.5H18V18H9.5z" />
    </svg>
  ),
}

export async function ProviderButtons({ providers }: { providers: Provider[] }) {
  if (providers.length === 0) return null
  const t = await getTranslations('authProviders')
  return (
    <div className="flex flex-col gap-2.5">
      {providers.map((p) => (
        <form key={p} action={startProviderSignIn}>
          <input type="hidden" name="provider" value={p} />
          <button
            type="submit"
            className="flex min-h-[48px] w-full items-center justify-center gap-3 rounded-btn border-[1.5px] border-line bg-surface px-4 text-[15px] font-semibold text-ink hover:bg-surface-sunk"
          >
            {MARKS[p]}
            {t(p)}
          </button>
        </form>
      ))}
      <p className="m-0 mt-1 flex items-center gap-3 text-[13px] text-text-2 max-md:text-[15px]">
        <span aria-hidden className="h-px flex-1 bg-line" />
        {t('or')}
        <span aria-hidden className="h-px flex-1 bg-line" />
      </p>
    </div>
  )
}
