/**
 * The public site's paths (handoff section 5), in one place for the server and the client. A path here
 * is public only if lib/supabase/middleware.ts lists it too.
 */
export const LANDING_PATH = '/leadership-team-assessment'
export const SCAN_PATH = '/scan'
export const RESULT_PATH = '/scan/result'
export const PRIVACY_PATH = '/privacy'
export const DATA_PROCESSING_PATH = '/data-processing'

/** Sign-in by email link (handoff section 8, Authentication) */
export const SIGN_IN_PATH = '/sign-in'
/** An account without the scan: for someone trying the product, a mentor or HR, who then makes or joins a group */
export const SIGN_UP_PATH = '/sign-up'
/** Where the email link lands: a button that signs in, so a mail scanner opening the link uses nothing */
export const CONFIRM_PATH = '/auth/confirm'
/** After sign-in: the group the device's saved scan asked for, or the person's group, or a new one */
export const NEW_GROUP_PATH = '/app/new'
/** The signed-in start: the person's group, or a new one */
export const APP_PATH = '/app'

/** The group's Home (handoff 6.7) */
export const homePath = (group: string) => `/app/${group}/home`
/** The group's scan status and invite link (design `invite`, handoff 6.4) */
export const invitePath = (group: string) => `/app/${group}/invite`
/** The group's team view, for its members (design `team`, handoff 6.6); Home carries it from milestone 6 */
export const teamPath = (group: string) => `/app/${group}/team`
/** The group's one invite link (handoff 6.5) */
export const joinPath = (code: string) => `/j/${code}`

/** The Leader Profile's public page (handoff section 5), and each test's page */
export const PROFILE_PATH = '/leader-profile'
export const profileTestPath = (test: 'quick' | 'full') => `/leader-profile/${test}`
/** The person's own page: the Leader Profile and its sharing (handoff 6.17); not per group */
export const ME_PATH = '/app/me'

/** The group's settings (handoff 6.18): the person's Account, the group's name and threshold, the person's Notifications and Privacy, then the group's plan and checkout */
export const settingsPath = (group: string) => `/app/${group}/settings`
export const accountPath = (group: string) => `/app/${group}/settings/account`
export const groupSettingsPath = (group: string) => `/app/${group}/settings/group`
export const notificationsPath = (group: string) => `/app/${group}/settings/notifications`
export const privacyPath = (group: string) => `/app/${group}/settings/privacy`
export const planBillingPath = (group: string) => `/app/${group}/settings/plan`
export const upgradePath = (group: string) => `/app/${group}/settings/upgrade`

/** The group's charter and members (handoff 6.8) */
export const groupPath = (group: string) => `/app/${group}/group`
/** An invitation to join a group: the token in the path is the capability (0014) */
export const joinInvitePath = (token: string) => `/join/${token}`

/** The group's rounds (handoff 6.10), and one round's questionnaire for a member who is asked (handoff 6.11) */
export const assessPath = (group: string) => `/app/${group}/assess`
export const roundPath = (group: string, round: string) => `/app/${group}/assess/${round}`

/** The group's results in three depths (handoff 6.12): the overview, one scale, and the scale's questions */
export const resultsPath = (group: string, round?: string) => `/app/${group}/results${round ? `?round=${round}` : ''}`
export const scalePath = (group: string, scale: string, round: string) => `/app/${group}/results/${scale}?round=${round}`
export const scaleItemsPath = (group: string, scale: string, round: string) => `/app/${group}/results/${scale}/items?round=${round}`

/** The group's focus areas and actions (handoff 6.13) */
export const planPath = (group: string) => `/app/${group}/plan`

/** The group's meetings and their agendas (handoff 6.14) */
export const meetingsPath = (group: string) => `/app/${group}/meetings`

/** A meeting, live or held (handoff 6.15) */
export const livePath = (group: string, meeting: string) => `/app/${group}/meetings/${meeting}`

/** Asking for one's data (handoff 6.18): 5 a day, HTTP 429 past that (handoff 8) */
export const EXPORT_API_PATH = '/api/export'
/** The export's mailed link: the token in the path is the capability (0022, 0023) */
export const exportPath = (token: string) => `/export/${token}`
