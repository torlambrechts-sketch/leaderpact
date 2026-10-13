'use client'
import type * as React from 'react'
import { usePathname } from 'next/navigation'

/** Leaves out what the shell shows on every page on the one page that says it already (Plan and billing) */
export function HideOn({ suffix, children }: { suffix: string; children: React.ReactNode }) {
  const path = usePathname()
  return path?.endsWith(suffix) ? null : children
}
