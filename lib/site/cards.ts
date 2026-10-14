/**
 * The share cards (scripts/seo/og-images.mjs writes them to public/og): one per article, one per page that
 * has its own, and the default. An article's card is the brand, "Articles" and its heading; no product
 * picture and no claims (Orgpuls D-235).
 */
export const articleCard = (slug: string) => `/og/articles/${slug}.png`
export const pageCard = (key: string) => `/og/${key}.png`
