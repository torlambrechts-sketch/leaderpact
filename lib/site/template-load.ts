import { TemplateContent } from './page-content'
import { templateBySlug, TEMPLATES, type Template } from './templates'
import charter from '@/data/templates/leadership-team-charter-template.json'
import agenda from '@/data/templates/leadership-team-meeting-agenda-template.json'
import guide from '@/data/templates/leadership-team-guide.json'

/** The templates' page words, imported so the build carries them; tests/unit/site.test.ts holds the list equal to the registry */
export const TEMPLATE_FILES: Record<string, unknown> = {
  'leadership-team-charter-template': charter,
  'leadership-team-meeting-agenda-template': agenda,
  'leadership-team-guide': guide,
}

export function loadTemplate(slug: string): { template: Template; content: TemplateContent } | null {
  const template = templateBySlug(slug)
  const file = TEMPLATE_FILES[slug]
  if (!template || file === undefined) return null
  return { template, content: TemplateContent.parse(file) }
}

export const allTemplates = () => TEMPLATES.flatMap((t) => loadTemplate(t.slug) ?? [])
