import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * shadcn/ui's `cn()`: join class names and let the last of two conflicting Tailwind classes win.
 * tailwind-merge is told about this theme's custom font sizes, so `text-micro` and `text-ink` are not
 * mistaken for the same group (both start with `text-`).
 */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['landing-headline', 'section-headline', 'greeting', 'card-headline', 'sub-headline', 'big-number', 'micro'] },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs))
}
