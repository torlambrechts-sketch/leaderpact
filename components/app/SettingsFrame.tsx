import 'server-only'
import * as React from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { getTranslations } from 'next-intl/server'
import { CreditCard } from 'lucide-react'
import { AppPage, PageTitle } from '@/components/app/AppPage'
import { planBillingPath } from '@/lib/routes'

/**
 * Settings (handoff 6.18, design `settings`): the group's name over the title, then the settings menu on the
 * left, a vertical menu as the spec has it (a white card, radius 18, padding 10; each entry 10 by 12, radius
 * 10, 14 / 600 with a 17 px icon, the current one in ink), and the tab's cards on the right. Below 960 px
 * the menu sits above. Of the five tabs only Plan and billing exists yet; the shell lists only pages that
 * exist, and so does this menu (D-33).
 */
export async function SettingsFrame({ group, children }: { group: { id: string; name: string }; children: React.ReactNode }) {
  const t = await getTranslations('billing')
  return (
    <AppPage>
      <PageTitle eyebrow={group.name} title={t('settingsTitle')} />
      <div className="grid items-start gap-6 min-[960px]:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label={t('tabsLabel')} className="rounded-card border border-white bg-surface p-2.5 min-[960px]:sticky min-[960px]:top-24">
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            <li>
              <Link
                href={planBillingPath(group.id) as Route}
                aria-current="page"
                className="flex items-center gap-2.5 rounded-btn-sm bg-ink px-3 py-2.5 text-[14px] font-semibold text-white hover:text-white max-md:min-h-[44px] max-md:text-[15px]"
              >
                <CreditCard aria-hidden size={17} />
                {t('tabPlan')}
              </Link>
            </li>
          </ul>
        </nav>
        <div className="flex min-w-0 flex-col gap-5">{children}</div>
      </div>
    </AppPage>
  )
}
