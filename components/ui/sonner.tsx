'use client'
// Origin: shadcn/ui sonner (MIT), restyled to the design's toast: ink, radius 12, padding 12 by 16, 13.5 px
// at 500, a check in --accent-mid, bottom centre at 24 px, 3.8 s. Values: docs/design/component-specs.md.
import { CircleCheck } from 'lucide-react'
import { Toaster as Sonner, toast } from 'sonner'
import { toastClass } from '@/components/lp/ToastView'

export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      offset={24}
      duration={3800}
      visibleToasts={1}
      icons={{ success: <CircleCheck aria-hidden size="1em" className="text-accent-mid" /> }}
      toastOptions={{ unstyled: true, classNames: { toast: toastClass } }}
    />
  )
}

export { toast }
