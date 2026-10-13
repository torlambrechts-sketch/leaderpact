'use client'
import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowRight, Check } from 'lucide-react'
import { Card } from '@/components/lp/Card'
import { HintBox } from '@/components/lp/HintBox'
import { TextField } from '@/components/lp/TextField'
import { WarningBox } from '@/components/lp/WarningBox'
import { Button, buttonVariants } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { confirmCheckout, startCheckout } from '@/lib/billing/actions'
import { checkoutSchema, type BillingReason, type Interval, type Method } from '@/lib/billing/schema'
import { cn } from '@/lib/cn'
import { homePath, planBillingPath } from '@/lib/routes'

type Step = 1 | 2 | 3 | 4
type Field = 'company' | 'country' | 'orgNumber' | 'invoiceEmail' | 'reference'
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

interface Details {
  company: string
  orgNumber: string
  country: string
  invoiceEmail: string
  reference: string
}

/** A choice of two, as the design draws it: a ring that fills, a label and a line under it */
function Choice<T extends string>({ legend, value, options, onChange }: { legend: string; value: T; options: { value: T; label: string; body: string }[]; onChange: (v: T) => void }) {
  const id = React.useId()
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend id={id} className="mb-2 text-[14px] font-bold max-md:text-[15px]">
        {legend}
      </legend>
      <RadioGroup aria-labelledby={id} value={value} onValueChange={(v) => onChange(v as T)} className="grid gap-2.5 md:grid-cols-2">
        {options.map((o) => (
          <RadioGroupItem
            key={o.value}
            value={o.value}
            className="group flex w-full items-start gap-2.5 rounded-option border-[1.5px] border-line bg-surface px-3.5 py-3 text-left data-[state=checked]:border-ink data-[state=checked]:bg-accent"
          >
            <span aria-hidden className="mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border-[1.5px] border-line group-data-[state=checked]:border-ink">
              <span className="hidden h-2 w-2 rounded-full bg-ink group-data-[state=checked]:block" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[14px] font-semibold text-ink max-md:text-[15px]">{o.label}</span>
              <span className="text-[12.5px] text-text-2 max-md:text-[15px]">{o.body}</span>
            </span>
          </RadioGroupItem>
        ))}
      </RadioGroup>
    </fieldset>
  )
}

/**
 * The Team plan's checkout (handoff 6.18; design `settings`, plan tab, the flow): billing period, then
 * company details and payment method, then review, then done. An invoice needs the organisation number
 * and an invoice email (handoff 6.18). Tax follows the company's country and is the payment provider's to
 * compute (owner D2c), so no tax line is made up here (handoff 11: no "VAT 25%"). No card number is shown
 * (handoff 11): a vendor will bring its own form; the development adapter pays or fails on demand; with
 * no adapter the review says payment is not connected, and nothing is started.
 */
export function UpgradeFlow({
  group,
  already,
  prices,
  canPay,
  development,
  countries,
  teamItems,
}: {
  group: { id: string; name: string }
  already: boolean
  prices: { year: string; month: string }
  canPay: boolean
  development: boolean
  countries: { code: string; name: string }[]
  teamItems: string[]
}) {
  const t = useTranslations('billing')
  const router = useRouter()
  const [step, setStep] = React.useState<Step>(1)
  const [period, setPeriod] = React.useState<Interval>('year')
  const [method, setMethod] = React.useState<Method>('card')
  const [details, setDetails] = React.useState<Details>({ company: '', orgNumber: '', country: '', invoiceEmail: '', reference: '' })
  const [errors, setErrors] = React.useState<Partial<Record<Field, string>>>({})
  const [paying, setPaying] = React.useState<'idle' | 'busy'>('idle')
  const [problem, setProblem] = React.useState<string | null>(null)
  const heading = React.useRef<HTMLHeadingElement>(null)
  const moved = React.useRef(false)
  React.useEffect(() => {
    if (moved.current) heading.current?.focus()
  }, [step])

  const go = (next: Step) => {
    moved.current = true
    setProblem(null)
    setStep(next)
  }
  const set = (field: keyof Details) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDetails((d) => ({ ...d, [field]: e.target.value }))
  const price = period === 'year' ? prices.year : prices.month
  const per = t(period === 'year' ? 'perYearShort' : 'perMonthShort')
  const countryName = countries.find((c) => c.code === details.country)?.name ?? details.country

  if (step !== 4 && already) {
    return (
      <Card large className="flex flex-col gap-3">
        <h2 className="m-0 text-[18px] font-bold">{t('alreadyTitle')}</h2>
        <Link href={planBillingPath(group.id) as Route} className={buttonVariants({ variant: 'secondary', className: 'self-start' })}>
          {t('seeBilling')}
        </Link>
      </Card>
    )
  }

  function checkDetails(): boolean {
    const e: Partial<Record<Field, string>> = {}
    const email = details.invoiceEmail.trim()
    if (!details.company.trim()) e.company = t('errorCompany')
    if (!details.country) e.country = t('errorCountry')
    if (method === 'invoice' && !details.orgNumber.trim()) e.orgNumber = t('errorOrgNumber')
    if (method === 'invoice' && !email) e.invoiceEmail = t('errorInvoiceEmail')
    else if (email && !EMAIL.test(email)) e.invoiceEmail = t('errorEmail')
    if (details.reference.trim().length > 60) e.reference = t('errorReference')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function sayReason(reason: BillingReason) {
    setProblem(reason === 'already' ? t('alreadyTitle') : reason === 'not_leader' ? t('onlyLeader') : reason === 'unavailable' ? t('notConnected') : t('payFailed'))
  }

  async function pay(outcome: 'paid' | 'failed') {
    const input = checkoutSchema.safeParse({ group: group.id, interval: period, method, ...details })
    if (!input.success) return go(2)
    setPaying('busy')
    setProblem(null)
    const started = await startCheckout(input.data).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    if (!started.ok) {
      setPaying('idle')
      return sayReason(started.reason)
    }
    const result = await confirmCheckout({ checkout: started.checkout, outcome, group: group.id }).catch(() => ({ ok: false as const, reason: 'failed' as const }))
    setPaying('idle')
    if (!result.ok) return sayReason(result.reason)
    if (!result.paid) return setProblem(t('paymentFailed'))
    go(4)
    router.refresh()
  }

  const steps = [t('step1'), t('step2'), t('step3'), t('step4')]

  return (
    <Card large className="flex flex-col gap-5 md:px-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 ref={heading} tabIndex={-1} className="m-0 flex-1 text-[18px] font-bold focus-visible:outline-none">
          {step === 4 ? t('doneTitle') : t('upgradeTitle')}
        </h2>
        {step !== 4 && (
          <Link href={planBillingPath(group.id) as Route} className="text-[13px] font-semibold underline underline-offset-2 max-md:text-[15px]">
            {t('comparePlans')}
          </Link>
        )}
      </div>

      <ol aria-label={t('stepsLabel')} className="m-0 grid list-none grid-cols-4 gap-2 p-0">
        {steps.map((label, i) => {
          const n = (i + 1) as Step
          return (
            <li key={label} aria-current={n === step ? 'step' : undefined} className="flex flex-col gap-1.5">
              <span aria-hidden className={cn('h-1 rounded-pill', n < step ? 'bg-ink' : n === step ? 'bg-accent-deep' : 'bg-line')} />
              <span className={cn('text-[12px] font-semibold max-md:text-[13px]', n <= step ? 'text-ink' : 'text-text-2')}>
                <span className="max-md:sr-only">{t('stepWords', { n, label })}</span>
                <span aria-hidden className="md:hidden">{n}</span>
              </span>
            </li>
          )
        })}
      </ol>

      {step === 1 && (
        <>
          <Choice<Interval>
            legend={t('periodLegend')}
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'year', label: t('yearly'), body: t('pricePerYear', { price: prices.year }) },
              { value: 'month', label: t('monthly'), body: t('pricePerMonth', { price: prices.month }) },
            ]}
          />
          <ul aria-label={t('teamIncludes')} className="m-0 grid list-none gap-x-5 gap-y-2 rounded-option border border-line bg-surface-soft p-4 md:grid-cols-2">
            {teamItems.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[13.5px] max-md:text-[15px]">
                <Check aria-hidden size={15} className="mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </>
      )}

      {step === 2 && (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 md:grid-cols-2">
            <TextField id="billing-company" label={t('fieldCompany')} value={details.company} onChange={set('company')} error={errors.company} autoComplete="organization" maxLength={120} required />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="billing-country" className="text-[12.5px] font-semibold text-text-2 max-md:text-[15px]">
                {t('fieldCountry')}
              </label>
              <select
                id="billing-country"
                value={details.country}
                onChange={set('country')}
                required
                aria-invalid={errors.country ? true : undefined}
                aria-describedby={errors.country ? 'billing-country-error' : 'billing-country-hint'}
                autoComplete="country"
                className={cn('h-11 rounded-input border bg-surface px-3 text-[14.5px] text-ink', errors.country ? 'border-danger' : 'border-line')}
              >
                <option value="">{t('chooseCountry')}</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              {errors.country ? (
                <p id="billing-country-error" role="alert" className="m-0 text-[12.5px] font-semibold text-danger max-md:text-[15px]">
                  {errors.country}
                </p>
              ) : (
                <p id="billing-country-hint" className="m-0 text-[12px] text-text-2 max-md:text-[15px]">
                  {t('countryHint')}
                </p>
              )}
            </div>
            <TextField id="billing-org-number" label={t('fieldOrgNumber')} hint={t('invoiceHint')} value={details.orgNumber} onChange={set('orgNumber')} error={errors.orgNumber} maxLength={40} />
            <TextField id="billing-invoice-email" type="email" label={t('fieldInvoiceEmail')} hint={t('invoiceHint')} value={details.invoiceEmail} onChange={set('invoiceEmail')} error={errors.invoiceEmail} autoComplete="email" maxLength={254} />
            <TextField id="billing-reference" label={t('fieldReference')} hint={t('referenceHint')} value={details.reference} onChange={set('reference')} error={errors.reference} maxLength={60} />
          </div>
          <Choice<Method>
            legend={t('methodLegend')}
            value={method}
            onChange={setMethod}
            options={[
              { value: 'card', label: t('methodCard'), body: t('methodCardBody') },
              { value: 'invoice', label: t('methodInvoice'), body: t('methodInvoiceBody') },
            ]}
          />
        </>
      )}

      {step === 3 && (
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
          <dl className="m-0 grid grid-cols-[minmax(0,130px)_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[13.5px] max-md:text-[15px]">
            <dt className="text-text-2">{t('rowPlan')}</dt>
            <dd className="m-0 font-semibold">{t('reviewPlan', { period: t(period === 'year' ? 'yearly' : 'monthly') })}</dd>
            <dt className="text-text-2">{t('rowGroup')}</dt>
            <dd className="m-0 break-words">{group.name}</dd>
            <dt className="text-text-2">{t('rowCompany')}</dt>
            <dd className="m-0 break-words">{[details.company.trim(), details.orgNumber.trim()].filter(Boolean).join(' · ')}</dd>
            <dt className="text-text-2">{t('rowCountry')}</dt>
            <dd className="m-0">{countryName}</dd>
            <dt className="text-text-2">{t('rowPayment')}</dt>
            <dd className="m-0 break-words">{method === 'card' ? t('methodCard') : t('methodInvoiceTo', { email: details.invoiceEmail.trim().toLowerCase() })}</dd>
            {details.reference.trim() && (
              <>
                <dt className="text-text-2">{t('rowReference')}</dt>
                <dd className="m-0 break-words">{details.reference.trim()}</dd>
              </>
            )}
            <dt className="text-text-2">{t('rowCarries')}</dt>
            <dd className="m-0">{t('carries')}</dd>
          </dl>
          <div className="flex flex-col gap-2 rounded-option border border-line bg-surface-soft p-4 text-[13.5px] max-md:text-[15px]">
            <p className="m-0 flex justify-between gap-3">
              <span>{t('teamPlan')}</span>
              <span className="font-bold">{price}</span>
            </p>
            <p className="m-0 text-text-2">{per}</p>
            <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{t('taxNote')}</p>
            <p className="m-0 text-[12.5px] text-text-2 max-md:text-[15px]">{t('cancelNote')}</p>
          </div>
          {development && <HintBox className="md:col-span-2">{t('devPayNote')}</HintBox>}
          {!canPay && <WarningBox className="md:col-span-2">{t('notConnected')}</WarningBox>}
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
            <Check size={26} />
          </span>
          <p className="m-0 max-w-[480px] text-[14.5px] leading-[1.55] text-text-2 max-md:text-[15px]">{t('doneBody')}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href={homePath(group.id) as Route} className={buttonVariants({ className: 'gap-2' })}>
              {t('goHome')}
              <ArrowRight aria-hidden size={15} />
            </Link>
            <Link href={planBillingPath(group.id) as Route} className={buttonVariants({ variant: 'secondary' })}>
              {t('seeBilling')}
            </Link>
          </div>
        </div>
      )}

      {problem && (
        <p role="alert" className="m-0 text-[13.5px] font-semibold text-danger max-md:text-[15px]">
          {problem}
        </p>
      )}

      {step !== 4 && (
        <div className="flex flex-wrap justify-between gap-2.5 border-t border-rule-softer pt-4">
          {step > 1 ? (
            <Button variant="secondary" disabled={paying === 'busy'} onClick={() => go((step - 1) as Step)}>
              {t('back')}
            </Button>
          ) : (
            <span />
          )}
          {step === 1 && <Button onClick={() => go(2)}>{t('continue')}</Button>}
          {step === 2 && <Button onClick={() => checkDetails() && go(3)}>{t('continue')}</Button>}
          {step === 3 && canPay && (
            <div className="flex flex-wrap gap-2">
              {development && (
                <Button variant="secondary" disabled={paying === 'busy'} onClick={() => pay('failed')}>
                  {t('devFail')}
                </Button>
              )}
              <Button disabled={paying === 'busy'} onClick={() => pay('paid')}>
                {paying === 'busy' ? t('paying') : t('pay', { price })}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
