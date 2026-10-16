/**
 * The free templates behind an e-mail address (D-37, after Orgpuls D-241): one page each under /templates,
 * the files they give, and the cookie that says which a browser has asked for.
 *
 * The files are built from what the articles already say and kept in private/templates, outside public/: the
 * Word templates by scripts/templates/build.py, the guide by scripts/templates/guide.mjs (D-60), which prints the
 * published articles. app/(public)/templates/file/[file] serves them only to a browser whose cookie names a
 * template holding the file. That is a soft gate, as such gates are: the point is the address the person chose to
 * give, not secrecy. The page's words are data/templates/<slug>.json.
 */
export type TemplateFormat = 'docx' | 'pdf'
export type TemplateFile = { name: string; format: TemplateFormat }

export type Template = {
  slug: string
  /** a template to fill in, or a guide to read (D-60): the form and its answer say which */
  kind: 'template' | 'guide'
  files: TemplateFile[]
  /** the searches its page answers */
  queries: [string, ...string[]]
  /** the articles a reader of the template reads next, by slug */
  related: [string, string]
  published: string
  modified: string
}

/** The guide (D-60): the published articles, printed in their parts, as one PDF */
export const GUIDE_SLUG = 'leadership-team-guide'
export const GUIDE_FILE = 'how-leadership-teams-really-work.pdf'

export const TEMPLATES: Template[] = [
  {
    slug: 'leadership-team-charter-template',
    kind: 'template',
    files: [{ name: 'leadership-team-charter-template.docx', format: 'docx' }],
    queries: ['leadership team charter template', 'team charter template'],
    related: ['leadership-team-charter', 'leadership-team-purpose'],
    published: '2026-10-13',
    modified: '2026-10-13',
  },
  {
    slug: 'leadership-team-meeting-agenda-template',
    kind: 'template',
    files: [{ name: 'leadership-team-meeting-agenda-template.docx', format: 'docx' }],
    queries: ['leadership team meeting agenda template', 'executive meeting agenda template'],
    related: ['leadership-team-meeting-agenda', 'task-conflict-and-relationship-conflict'],
    published: '2026-10-13',
    modified: '2026-10-13',
  },
  {
    slug: GUIDE_SLUG,
    kind: 'guide',
    files: [{ name: GUIDE_FILE, format: 'pdf' }],
    queries: ['leadership team guide', 'leadership team effectiveness ebook'],
    related: ['what-makes-a-leadership-team-effective', 'how-to-assess-a-leadership-team'],
    published: '2026-10-16',
    modified: '2026-10-16',
  },
]

export const templateBySlug = (slug: string) => TEMPLATES.find((t) => t.slug === slug) ?? null

export const TEMPLATES_PATH = '/templates'
export const templatePath = (slug: string) => `${TEMPLATES_PATH}/${slug}`
export const templateFilePath = (name: string) => `${TEMPLATES_PATH}/file/${name}`

/** The cookie that lists the templates a browser has asked for: comma-separated slugs, for /templates only */
export const TEMPLATE_COOKIE = 'lp_templates'

export const MIME: Record<TemplateFormat, string> = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf',
}

/** The slugs a cookie value grants, unknown ones left out */
export const granted = (cookie: string | undefined) =>
  (cookie ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => templateBySlug(s))

/** The template that gives this file to a browser holding these slugs, if any */
export const grantFor = (file: string, slugs: string[]) => TEMPLATES.find((t) => slugs.includes(t.slug) && t.files.some((f) => f.name === file)) ?? null
