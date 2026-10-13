import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface PlanCard {
  key: 'free' | 'team'
  name: string
  /** the price line, or a line saying what it costs; a member is shown no price (handoff 6.19, D-30) */
  price?: string
  per?: string
  items: string[]
  current: boolean
  /** the plan's actions: Upgrade and the trial for the leader; a line for a member */
  action?: React.ReactNode
}

/**
 * The plans side by side (handoff 6.18 "Compare plans"; design `settings`, plan tab): Free and Team, the
 * Organisation plan being outside the MVP (handoff 1). Meetings are in the Team list (handoff 11). The Team
 * card is the featured one, as in the design: ink border on the accent.
 */
export function PlanCards({ plans, currentLabel, label }: { plans: PlanCard[]; currentLabel: string; label: string }) {
  return (
    <ul aria-label={label} className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
      {plans.map((p) => (
        <li
          key={p.key}
          className={cn(
            'flex flex-col gap-3 rounded-option border-[1.5px] px-[18px] py-4',
            p.key === 'team' ? 'border-ink bg-surface-soft' : 'border-line bg-surface',
          )}
        >
          <div className="flex items-center gap-2">
            <h3 className="m-0 flex-1 text-[16px] font-bold">{p.name}</h3>
            {p.current && <span className="rounded-chip bg-ink px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-white">{currentLabel}</span>}
          </div>
          {(p.price || p.per) && (
            <p className="m-0 flex flex-wrap items-baseline gap-x-2">
              {p.price && <span className="text-[24px] font-bold tracking-[-0.02em]">{p.price}</span>}
              {p.per && <span className="text-[13px] text-text-2 max-md:text-[15px]">{p.per}</span>}
            </p>
          )}
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {p.items.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[13.5px] max-md:text-[15px]">
                <Check aria-hidden size={15} className="mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          {p.action && <div className="mt-auto flex flex-col gap-2 pt-1">{p.action}</div>}
        </li>
      ))}
    </ul>
  )
}
