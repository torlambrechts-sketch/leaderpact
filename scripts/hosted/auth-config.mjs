#!/usr/bin/env node
/**
 * The hosted project's Auth settings, from this repository (supabase/config.toml's rule: if the hosted
 * project needs a setting, the repository says it). Applied through the Supabase Management API to
 * LeaderPact's project only (CLAUDE.md, The hosted project; D-10, D-26).
 *
 *   node scripts/hosted/auth-config.mjs --site https://<production address>            # print the change
 *   NODE_USE_ENV_PROXY=1 node scripts/hosted/auth-config.mjs --site https://… --apply   # send it
 *
 * - **The 15-minute link** that works once (handoff 8): `mailer_otp_exp` 900.
 * - **Where a link may return**: the production address and Vercel's preview addresses, each to
 *   /auth/confirm; the site address is the production one.
 * - **The three mails** of supabase/templates (the sign-in link, the confirmation, the password reset), the same
 *   files the local stack and CI send.
 * - **Sign-up with a password** (D-57): confirmed by mail, at least 10 characters, length the only rule.
 * - **Google and Microsoft** (D-57), each turned on when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or
 *   AZURE_CLIENT_ID and AZURE_CLIENT_SECRET, are set; the secrets are never printed.
 * - **The sender** (owner D3, D-26): post@leaderpact.com, named after PRODUCT_NAME, through Brevo's SMTP
 *   relay. Supabase Auth sets no reply-to of its own, so a reply goes to the sender, post@leaderpact.com,
 *   as D3 asks. The relay's login and key are read from BREVO_SMTP_LOGIN and BREVO_SMTP_KEY when set, and
 *   never printed; without them the SMTP fields are left as they are.
 * - **The project-wide mail limit**: 30 an hour, as supabase/config.toml has it; sent with the SMTP
 *   fields, since Supabase allows it only with custom SMTP.
 * - **The 30-day session time-box** is a paid-plan setting (owner A2) and is not sent from here.
 *
 * The Management API token is not handled here: the session's network proxy adds it for
 * api.supabase.com ("Supabase LeaderPact"). The script refuses any project but LeaderPact's.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('../../', import.meta.url).pathname
export const PROJECT_REF = 'tgxjbshdjwoemsmrtkzw'
export const MAIL_FROM = 'post@leaderpact.com'
export const MAIL_REPLY_TO = 'post@leaderpact.com'
const PREVIEWS = 'https://*-tor-lambrechts-s-projects.vercel.app/auth/confirm'
const PREVIEW_CALLBACKS = 'https://*-tor-lambrechts-s-projects.vercel.app/auth/callback'

function productName() {
  const brand = readFileSync(join(ROOT, 'lib/brand.ts'), 'utf8')
  const name = /export const PRODUCT_NAME = '([^']+)'/.exec(brand)?.[1]
  if (!name) throw new Error('auth-config: PRODUCT_NAME not found in lib/brand.ts')
  return name
}

function template(file) {
  return readFileSync(join(ROOT, 'supabase/templates', file), 'utf8')
}

/** The settings, as the Management API names them (PATCH /v1/projects/{ref}/config/auth) */
export function settings(site) {
  const url = new URL(site)
  if (url.protocol !== 'https:') throw new Error('auth-config: the site address must be https')
  const origin = url.origin
  const body = {
    site_url: origin,
    uri_allow_list: [`${origin}/auth/confirm`, PREVIEWS, `${origin}/auth/callback`, PREVIEW_CALLBACKS].join(','),
    mailer_otp_exp: 900,
    mailer_subjects_magic_link: 'Your sign-in link',
    mailer_templates_magic_link_content: template('magic_link.html'),
    mailer_subjects_confirmation: 'Confirm your email',
    mailer_templates_confirmation_content: template('confirmation.html'),
    mailer_subjects_recovery: 'Set a new password',
    mailer_templates_recovery_content: template('recovery.html'),
    // sign-up with a password (D-57): the address is confirmed by mail; at least 10 characters, length the only rule
    external_email_enabled: true,
    disable_signup: false,
    mailer_autoconfirm: false,
    password_min_length: 10,
    password_required_characters: '',
  }
  // Google and Microsoft (D-57), each turned on only when its client's id and secret are in the environment
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    Object.assign(body, { external_google_enabled: true, external_google_client_id: process.env.GOOGLE_CLIENT_ID, external_google_secret: process.env.GOOGLE_CLIENT_SECRET })
  }
  if (process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET) {
    Object.assign(body, {
      external_azure_enabled: true,
      external_azure_client_id: process.env.AZURE_CLIENT_ID,
      external_azure_secret: process.env.AZURE_CLIENT_SECRET,
      external_azure_url: 'https://login.microsoftonline.com/common/v2.0',
    })
  }
  if (process.env.BREVO_SMTP_LOGIN && process.env.BREVO_SMTP_KEY) {
    Object.assign(body, {
      smtp_admin_email: MAIL_FROM,
      smtp_sender_name: productName(),
      smtp_host: 'smtp-relay.brevo.com',
      smtp_port: '587',
      smtp_user: process.env.BREVO_SMTP_LOGIN,
      smtp_pass: process.env.BREVO_SMTP_KEY,
      // Supabase allows a mail limit of its own only with custom SMTP
      rate_limit_email_sent: 30,
    })
  }
  return body
}

function shown(body) {
  const copy = { ...body }
  if (copy.smtp_pass) copy.smtp_pass = '(set from BREVO_SMTP_KEY, not shown)'
  if (copy.smtp_user) copy.smtp_user = '(set from BREVO_SMTP_LOGIN, not shown)'
  for (const k of ['external_google_secret', 'external_azure_secret']) if (copy[k]) copy[k] = '(set from the environment, not shown)'
  for (const k of Object.keys(copy)) if (k.endsWith('_content')) copy[k] = `(${copy[k].length} characters from supabase/templates)`
  return copy
}

async function main(argv) {
  const at = argv.indexOf('--site')
  const site = at >= 0 ? argv[at + 1] : undefined
  if (!site) {
    console.error('auth-config: --site https://<production address> is required')
    process.exit(2)
  }
  const ref = argv.includes('--ref') ? argv[argv.indexOf('--ref') + 1] : PROJECT_REF
  if (ref !== PROJECT_REF) {
    console.error(`auth-config: refused. Only LeaderPact's project (${PROJECT_REF}) is configured from here.`)
    process.exit(2)
  }
  const body = settings(site)
  console.log(JSON.stringify(shown(body), null, 2))
  if (!body.smtp_host) console.log('auth-config: BREVO_SMTP_LOGIN and BREVO_SMTP_KEY are not set; the SMTP fields are left as they are')
  if (!argv.includes('--apply')) return
  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  // the status and Supabase's message only: the answer echoes settings, the SMTP key among them
  let message = ''
  try {
    message = (await response.json()).message ?? ''
  } catch {
    // no JSON body
  }
  console.log(`auth-config: ${response.status}${message ? ` ${message}` : ''}`)
  if (!response.ok) process.exit(1)
}

if (process.argv[1]?.endsWith('auth-config.mjs')) await main(process.argv.slice(2))
