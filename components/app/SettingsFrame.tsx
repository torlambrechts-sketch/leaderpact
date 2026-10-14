import 'server-only'
import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { Bell, CreditCard, Shield, User, type LucideIcon } from 'lucide-react'
import { AppPage, PageTitle } from '@/components/app/AppPage'
import { cn } from '@/lib/cn'
import { accountPath, notificationsPath, planBillingPath, privacyPath } from '@/lib/routes'

export type SettingsTab = 'account' | 'notifications' | 'privacy' | 'plan'

const TABS: ReadonlyArray<{ key: SettingsTab; label: 'tabAccount' | 'tabNotifications' | 'tabPrivacy' | 'tabPlan'; icon: LucideIcon; href: (group: string) => string }> = [
  { key: 'account', label: 'tabAccount', icon: User, href: accountPath },
  { key: 'notifications', label: 'tabNotifications', icon: Bell, href: notificationsPath },
  { key: 'privacy', label: 'tabPrivacy', icon: Shield, href: privacyPath },
  { key: 'plan', label: 'tabPlan', icon: CreditCard, href: planBillingPath },
]

/**
 * Settings (handoff 6.18, design `settings`): the group's name over the title, then the settings menu on the
 * left, a vertical menu as the spec has it (a white card, radius 18, padding 10; each entry 10 by 12, radius
 * 10, 14 / 600 with a 17 px icon, the current one in ink), and the tab's cards on the right. Below 960 px
 * the menu sits above. Account, Notifications and Privacy are the person's own; Plan and billing is the
 * group's. The Group tab (name, threshold) is not built yet, and the menu lists only pages that exist (D-33,
 * D-53).
 */
export async function SettingsFrame({ group, active, children }: { group: { id: string; name: string }; active: SettingsTab; children: React.ReactNode }) {
  const t = await getTranslations('settings')
  return (
    <AppPage>
      <PageTitle eyebrow={group.name} title={t('title')} />
      <div className="grid items-start gap-6 min-[960px]:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label={t('tabsLabel')} className="rounded-card border border-white bg-surface p-2.5 min-[960px]:sticky min-[960px]:top-24">
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {TABS.map(({ key, label, icon: Icon, href }) => {
              const current = key === active
              return (
                <li key={key}>
                  <Link
                    href={href(group.id) as Route}
                    aria-current={current ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-btn-sm px-3 py-2.5 text-[14px] font-semibold max-md:min-h-[44px] max-md:text-[15px]',
                      current ? 'bg-ink text-white hover:text-white' : 'text-ink hover:bg-surface-sunk',
                    )}
                  >
                    <Icon aria-hidden size={17} />
                    {t(label)}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="flex min-w-0 flex-col gap-5">{children}</div>
      </div>
    </AppPage>
  )
}
