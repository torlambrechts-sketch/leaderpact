import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * shadcn/ui's `cn()`: join class names and let the last of two conflicting Tailwind classes win.
 * tailwind-merge is told about this theme's custom font sizes, so `text-micro` and `text-ink` are not
 * mistaken for the same group (both start with `text-`), and about its radius scale: without it,
 * `rounded-input rounded-btn-sm` keeps both and the stylesheet's order, not the caller, decides.
 */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['landing-headline', 'section-headline', 'greeting', 'page-title', 'card-headline', 'sub-headline', 'big-number', 'micro'] },
      ],
      rounded: [
        { rounded: ['chip', 'chip-lg', 'r8', 'r9', 'btn-sm', 'input', 'icon-tile', 'btn', 'option', 'r16', 'card', 'card-lg', 'hero', 'pill'] },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs))
}
