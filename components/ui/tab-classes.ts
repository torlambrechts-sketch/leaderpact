/**
 * The segmented strip's classes (spec, tabs), shared by the Radix tabs (components/ui/tabs.tsx, a client
 * module) and the link tabs (components/lp/LinkTabs.tsx, rendered on the server). They live in a module of
 * their own because a server component that imports a value from a 'use client' module receives a client
 * reference, not the string.
 */
export const tabStripClass = 'inline-flex flex-wrap gap-1 rounded-btn border border-bar bg-surface p-1'
export const tabClass =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-r9 px-4 py-2 text-[13.5px] font-semibold text-text-2 transition-colors max-md:min-h-[44px]'
export const tabOnClass = 'bg-ink text-white hover:text-white'
