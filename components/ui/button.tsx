// Origin: shadcn/ui button (MIT), restyled to the measured design (docs/design/component-specs.md, button).
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

/**
 * The design has several button sizes (spec, button), and these are its clusters:
 *
 * | size    | radius | padding | font                                   |
 * |---------|--------|---------|----------------------------------------|
 * | default | 11     | 10 / 16 | 13.5; primary 700, others 600 (most used) |
 * | compact | 10     | 9 / 15  | 13.5 / 600                             |
 * | small   | 10     | 8 / 13  | 12.5 / 700                             |
 * | xsmall  | 9      | 6 / 12  | 12.5 / 700                             |
 * | large   | 12     | 12 / 22 | 14 / 600 (secondary 12 / 18)           |
 *
 * The handoff's "12 px, 600" is the large size; the owner's B2 answer is to take what the design uses.
 * Below 768 px every size is at least 44 px high, the touch target of handoff section 13. `asChild`
 * renders a link styled as a button, so navigation stays a real link.
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-[.45] max-md:min-h-[44px] [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-white hover:text-white',
        secondary: 'border border-line-strong bg-surface text-ink hover:text-ink',
        danger: 'border border-danger-border bg-surface text-danger hover:text-danger',
        // white on an ink surface: the Upgrade in the sample banner
        'on-ink': 'bg-surface text-accent-deep hover:text-accent-deep',
      },
      size: {
        default: 'rounded-input px-4 py-2.5 text-[13.5px]',
        compact: 'rounded-btn-sm px-[15px] py-[9px] text-[13.5px] font-semibold',
        small: 'rounded-btn-sm px-[13px] py-2 text-[12.5px] font-bold',
        xsmall: 'rounded-r9 px-3 py-1.5 text-[12.5px] font-bold',
        large: 'rounded-btn px-[22px] py-3 text-[14px] font-semibold',
      },
    },
    compoundVariants: [
      { variant: 'primary', size: 'default', className: 'font-bold' },
      { variant: ['secondary', 'danger'], size: 'default', className: 'font-semibold' },
      { variant: 'on-ink', size: 'default', className: 'rounded-btn-sm px-4 py-[9px] font-bold' },
      { variant: 'secondary', size: 'large', className: 'px-[18px]' },
    ],
    defaultVariants: { variant: 'primary', size: 'default' },
  },
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        // a button outside a form submits nothing by accident
        {...(asChild ? {} : { type: type ?? 'button' })}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
