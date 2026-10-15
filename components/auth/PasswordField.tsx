'use client'
import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * A password input with a button that shows or hides what was typed (D-57). The button names what it does and
 * says whether it is pressed; the field keeps the browser's password manager in reach through `autoComplete`.
 */
export function PasswordField({
  id,
  label,
  hint,
  error,
  showLabel,
  hideLabel,
  className,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; hint?: string; error?: string; showLabel: string; hideLabel: string }) {
  const [shown, setShown] = React.useState(false)
  const described = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[12.5px] font-semibold text-text-2 max-md:text-[15px]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={shown ? 'text' : 'password'}
          aria-describedby={described}
          aria-invalid={error ? true : undefined}
          className={cn('h-11 w-full rounded-input border border-line bg-surface py-0 pl-3.5 pr-12 text-[14.5px] text-ink', error && 'border-danger')}
          {...input}
        />
        <button
          type="button"
          aria-pressed={shown}
          aria-controls={id}
          onClick={() => setShown((s) => !s)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-input text-text-2 hover:text-ink"
        >
          {shown ? <EyeOff aria-hidden size={18} /> : <Eye aria-hidden size={18} />}
          <span className="sr-only">{shown ? hideLabel : showLabel}</span>
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-[12px] text-text-2 max-md:text-[15px]">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-[12.5px] font-semibold text-danger max-md:text-[15px]">
          {error}
        </p>
      )}
    </div>
  )
}
