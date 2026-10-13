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
/** Where the email link lands: a button that signs in, so a mail scanner opening the link uses nothing */
export const CONFIRM_PATH = '/auth/confirm'
/** After sign-in: the group the device's saved scan asked for, or the person's group, or a new one */
export const NEW_GROUP_PATH = '/app/new'
/** The signed-in start: the person's group, or a new one */
export const APP_PATH = '/app'

/** The group's scan status and invite link (design `invite`, handoff 6.4) */
export const invitePath = (group: string) => `/app/${group}/invite`
/** The group's team view, for its members (design `team`, handoff 6.6); Home carries it from milestone 6 */
export const teamPath = (group: string) => `/app/${group}/team`
/** The group's one invite link (handoff 6.5) */
export const joinPath = (code: string) => `/j/${code}`
