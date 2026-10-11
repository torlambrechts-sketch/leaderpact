// Origin: shadcn/ui button (MIT), restyled to the design's tokens (handoff section 4).
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

/**
 * Primary: black, white text, 600. Secondary: white with the strong border. Small: radius 10, 12.5 px,
 * 700. Danger: white, danger text, danger border. Exact sizes: docs/design/component-specs.md, button.
 * `asChild` renders a link styled as a button, so navigation stays a real link (CLAUDE.md, Design).
 */
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-ink text-white hover:bg-[#2a2a2a] hover:text-white',
        secondary: 'border border-line-strong bg-surface text-ink hover:border-accent-mid hover:text-ink',
        danger: 'border border-danger-border bg-surface text-danger hover:text-danger',
        ghost: 'text-ink hover:bg-surface-soft hover:text-ink',
      },
      size: {
        default: 'min-h-[40px] rounded-btn px-[14px] py-[9px] text-[14px]',
        small: 'min-h-[32px] rounded-btn-sm px-3 py-[7px] text-[12.5px] font-bold',
        large: 'min-h-[48px] rounded-btn px-[22px] py-3 text-[15px]',
        icon: 'h-9 w-9 rounded-btn-sm',
      },
    },
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
