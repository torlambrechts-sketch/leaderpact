'use client'
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Download } from 'lucide-react'
import { TextField } from '@/components/lp/TextField'
import { Button } from '@/components/ui/button'
import { requestTemplate } from '@/app/(public)/templates/actions'
import { sendBeacon } from '@/lib/site/beacon'
import { templateFilePath } from '@/lib/site/templates'
import { Rich } from './Rich'

type Problem = 'invalid' | 'rate_limited' | 'failed'

/**
 * The form beside a template's page (D-37, after Orgpuls D-241): a name and an address, the organisation and
 * role if the person wants, and a box, unticked, for e-mail about new templates and articles. When the
 * request is filed the files are there to download; a browser that has asked before sees them at once.
 */
export function TemplateDownload({ slug, files, ready: readyAtFirst }: { slug: string; files: { name: string; label: string; format: string }[]; ready: boolean }) {
  const t = useTranslations('site.templateForm')
  const [ready, setReady] = React.useState(readyAtFirst)
  const [name, setName] = React.useState('')
  const [mail, setMail] = React.useState('')
  const [org, setOrg] = React.useState('')
  const [role, setRole] = React.useState('')
  const [consent, setConsent] = React.useState(false)
  const [trap, setTrap] = React.useState('')
  const [problem, setProblem] = React.useState<Problem | null>(null)
  const [sending, startSending] = React.useTransition()
  const readyHeading = React.useRef<HTMLHeadingElement>(null)

  React.useEffect(() => {
    if (ready && !readyAtFirst) readyHeading.current?.focus()
  }, [ready, readyAtFirst])

  const card = 'flex scroll-mt-6 flex-col gap-4 rounded-card-lg border border-bar bg-surface p-6 shadow-[0_40px_70px_-36px_rgba(60,50,30,.22)] md:p-7'

  if (ready)
    return (
      <section id="get-the-template" aria-labelledby="template-ready" className={card}>
        <h2 id="template-ready" ref={readyHeading} tabIndex={-1} className="m-0 font-display text-sub-headline focus-visible:outline-none">
          {t('readyTitle')}
        </h2>
        <p role="status" className="m-0 text-[14.5px] leading-[1.55] text-text-2 max-md:text-[15px]">
          {t('readyText')}
        </p>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {files.map((f) => (
            <li key={f.name}>
              <a
                href={templateFilePath(f.name)}
                download
                className="flex min-h-[48px] items-center justify-between gap-3 rounded-btn bg-ink px-4 py-3 text-[15px] font-semibold text-white no-underline hover:text-white"
              >
                <span className="inline-flex items-center gap-2">
                  <Download aria-hidden size={16} />
                  {f.label}
                </span>
                <span className="rounded-pill bg-white/15 px-2 py-0.5 text-[11.5px] uppercase tracking-[0.06em]">{f.format}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    )

  const message = problem === 'invalid' ? t('invalid') : problem === 'rate_limited' ? t('limited') : problem === 'failed' ? t('failed') : null

  return (
    <form
      id="get-the-template"
      noValidate
      aria-labelledby="template-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim() || !/.+@.+\..+/.test(mail)) return setProblem('invalid')
        startSending(async () => {
          const r = await requestTemplate({ slug, name, mail, org, role, consent, trap }).catch(() => null)
          if (r?.ok) {
            setReady(true)
            // a code only: which template, and who asked, never leave in a count (D-39)
            sendBeacon({ k: 'cta', l: 'template' })
          }
          else setProblem(r?.problem ?? 'failed')
        })
      }}
      className={card}
    >
      <h2 id="template-form" className="m-0 font-display text-sub-headline">
        {t('title')}
      </h2>
      <p className="m-0 text-[14.5px] leading-[1.55] text-text-2 max-md:text-[15px]">{t('text')}</p>
      <TextField id="template-name" label={t('name')} value={name} autoComplete="name" required onChange={(e) => (setName(e.target.value), setProblem(null))} />
      <TextField id="template-mail" label={t('mail')} type="email" value={mail} autoComplete="email" required onChange={(e) => (setMail(e.target.value), setProblem(null))} />
      <TextField id="template-org" label={t('org')} hint={t('optional')} value={org} autoComplete="organization" onChange={(e) => setOrg(e.target.value)} />
      <TextField id="template-role" label={t('role')} hint={t('optional')} value={role} autoComplete="organization-title" onChange={(e) => setRole(e.target.value)} />
      <label className="flex cursor-pointer items-start gap-2.5 text-[14px] leading-[1.5] text-text-body max-md:text-[15px]">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-[3px] h-[18px] w-[18px] flex-none accent-[var(--ink)]" />
        <span>{t('consent')}</span>
      </label>
      {/* for form bots only: off screen, out of the tab order, hidden from assistive technology */}
      <input
        name="website"
        value={trap}
        onChange={(e) => setTrap(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-10000px] h-px w-px overflow-hidden"
      />
      <Button type="submit" size="large" disabled={sending}>
        {sending ? t('sending') : t('send')}
      </Button>
      {message ? (
        <p role="alert" className="m-0 text-[13.5px] font-semibold text-danger max-md:text-[15px]">
          {message}
        </p>
      ) : null}
      <p className="m-0 text-[12.5px] leading-[1.55] text-text-2 max-md:text-[15px]">
        <Rich text={t('privacy')} />
      </p>
    </form>
  )
}
