import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * A labelled text input (design: the save card and the settings forms): the label at 12.5 / 600 above,
 * the field 44 px high, radius 11, padding 0 by 14, 14.5 px (16 px on phones, app/globals.css), and an
 * optional hint and error below, tied to the field with aria-describedby. `tone="ink"` is the dark save
 * card: white label and hint, a borderless white field.
 */
export function TextField({
  id,
  label,
  hint,
  error,
  tone = 'surface',
  className,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; hint?: string; error?: string; tone?: 'surface' | 'ink' }) {
  const described = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined
  const ink = tone === 'ink'
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className={cn('text-[12.5px] font-semibold max-md:text-[15px]', ink ? 'text-white' : 'text-text-2')}>
        {label}
      </label>
      <input
        id={id}
        aria-describedby={described}
        aria-invalid={error ? true : undefined}
        className={cn(
          'h-11 rounded-input px-3.5 text-[14.5px] text-ink',
          ink ? 'border-0 bg-surface' : 'border border-line bg-surface',
          error && !ink && 'border-danger',
        )}
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className={cn('text-[12px] max-md:text-[15px]', ink ? 'text-white/85' : 'text-text-2')}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className={cn('text-[12.5px] font-semibold max-md:text-[15px]', ink ? 'text-white' : 'text-danger')}>
          {error}
        </p>
      )}
    </div>
  )
}
