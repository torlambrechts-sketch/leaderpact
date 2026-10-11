'use client'
// Origin: shadcn/ui radio-group (MIT). The visual option row is components/lp/OptionRow, which wraps an
// item; Radix gives the radio-group semantics, arrow keys and roving focus.
import * as React from 'react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { cn } from '@/lib/cn'

export const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => <RadioGroupPrimitive.Root ref={ref} className={cn('grid gap-2', className)} {...props} />)
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName

export const RadioGroupItem = RadioGroupPrimitive.Item
export const RadioGroupIndicator = RadioGroupPrimitive.Indicator
