'use client'
// Origin: shadcn/ui tabs (MIT), restyled as the design's segmented strip (spec, tabs): a white strip with
// a --bar border, radius 12, padding 4, gap 4; each tab 8 by 16, radius 9, 13.5 / 600; on is ink with
// white text, off is --text-2 on no fill. Radix gives roving focus and arrow keys. Tabs that change the
// URL are links (components/lp/LinkTabs). Settings uses a vertical menu instead (spec, tabs).
import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/cn'
import { tabClass, tabStripClass } from '@/components/ui/tab-classes'

export const Tabs = TabsPrimitive.Root


export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => <TabsPrimitive.List ref={ref} className={cn(tabStripClass, className)} {...props} />)
TabsList.displayName = TabsPrimitive.List.displayName

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(tabClass, 'hover:text-ink data-[state=active]:bg-ink data-[state=active]:text-white', className)}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => <TabsPrimitive.Content ref={ref} className={cn('mt-4', className)} {...props} />)
TabsContent.displayName = TabsPrimitive.Content.displayName
