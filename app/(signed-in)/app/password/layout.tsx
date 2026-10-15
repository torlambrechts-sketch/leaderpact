import { SimpleBar } from '@/components/lp/SimpleBar'

/** Setting a new password: outside any group, so the simple bar (the app shell needs a group) */
export default function NewPasswordLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SimpleBar />
      <main id="main">{children}</main>
    </>
  )
}
