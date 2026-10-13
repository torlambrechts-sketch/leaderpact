import { SimpleBar } from '@/components/lp/SimpleBar'

/** Making a group: outside any group, so the simple bar (the app shell needs a group) */
export default function NewGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SimpleBar />
      <main id="main">{children}</main>
    </>
  )
}
