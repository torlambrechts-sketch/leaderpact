'use client'
// Origin: shadcn/ui tabs (MIT), restyled: the active tab is black with white text, the others text-2 on
// no fill (handoff section 4). Radix gives roving focus and arrow keys, which Orgpuls's hand-made tabs
// lacked. Tabs that change the URL are links with aria-current instead (components/lp/LinkTabs).
import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/cn'

export const Tabs = TabsPrimitive.Root

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List ref={ref} className={cn('inline-flex flex-wrap items-center gap-1', className)} {...props} />
))
TabsList.displayName = TabsPrimitive.List.displayName

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex min-h-[36px] items-center gap-1.5 rounded-btn-sm px-3 py-[7px] text-[13px] font-semibold text-text-2 transition-colors',
      'hover:text-ink data-[state=active]:bg-ink data-[state=active]:text-white',
      className,
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => <TabsPrimitive.Content ref={ref} className={cn('mt-4', className)} {...props} />)
TabsContent.displayName = TabsPrimitive.Content.displayName
