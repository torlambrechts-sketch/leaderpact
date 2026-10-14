'use client'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { sendBeacon } from '@/lib/site/beacon'
import { SCAN_PATH } from '@/lib/routes'

/**
 * Mounted on the public site's layout (D-39): counts each page view and a press on anything that leads to the
 * scan, in Sentral (lib/site/beacon.ts). The beacon itself refuses the pages it must never count, so the scan
 * and the Leader Profile's tests send nothing. It stores nothing on the device.
 */
export function SiteBeacon() {
  const pathname = usePathname()
  useEffect(() => {
    sendBeacon({ k: 'view' })
  }, [pathname])

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = e.target instanceof Element ? e.target.closest('a[href]') : null
      if (link?.getAttribute('href')?.split(/[?#]/)[0] === SCAN_PATH) sendBeacon({ k: 'cta', l: 'start-scan' })
    }
    document.addEventListener('click', onClick, { capture: true })
    return () => document.removeEventListener('click', onClick, { capture: true })
  }, [])
  return null
}
