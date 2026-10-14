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

/** The group's settings (handoff 6.18): Plan and billing is the one tab so far, and the Team plan's checkout */
export const settingsPath = (group: string) => `/app/${group}/settings`
export const planBillingPath = (group: string) => `/app/${group}/settings/plan`
export const upgradePath = (group: string) => `/app/${group}/settings/upgrade`

/** The group's charter and members (handoff 6.8) */
export const groupPath = (group: string) => `/app/${group}/group`
/** An invitation to join a group: the token in the path is the capability (0014) */
export const joinInvitePath = (token: string) => `/join/${token}`

/** The group's rounds (handoff 6.10), and one round's questionnaire for a member who is asked (handoff 6.11) */
export const assessPath = (group: string) => `/app/${group}/assess`
export const roundPath = (group: string, round: string) => `/app/${group}/assess/${round}`
