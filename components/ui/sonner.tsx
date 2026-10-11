'use client'
// Origin: shadcn/ui sonner (MIT), restyled to the design's toast: ink background, white text, radius 12,
// 13.5 px at 500, bottom centre. Exact values: docs/design/component-specs.md, toast.
import { Toaster as Sonner, toast } from 'sonner'

export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: 'flex items-center gap-2 rounded-btn bg-ink px-4 py-3 text-[13.5px] font-medium text-white shadow-lg',
          icon: 'text-white',
        },
      }}
    />
  )
}

export { toast }
