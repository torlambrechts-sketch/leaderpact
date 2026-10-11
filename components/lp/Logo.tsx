import * as React from 'react'
import { cn } from '@/lib/cn'

/**
 * The logo (spec, logo): a black circle with a white dot, and the name beside it. In the app's top bar the
 * mark is 24 px with a 9 px dot and the name 16 / 700; in the public header 26 px, 10 px and 17 / 700.
 */
export function Logo({ name, variant = 'app', className }: { name: string; variant?: 'app' | 'public'; className?: string }) {
  const app = variant === 'app'
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-2.5 font-bold text-ink', app ? 'text-[16px]' : 'text-[17px]', className)}>
      <span aria-hidden className={cn('inline-flex items-center justify-center rounded-full bg-ink', app ? 'h-6 w-6' : 'h-[26px] w-[26px]')}>
        <span className={cn('rounded-full bg-white', app ? 'h-[9px] w-[9px]' : 'h-2.5 w-2.5')} />
      </span>
      {name}
    </span>
  )
}
