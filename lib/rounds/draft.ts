/**
 * A member's answers to a diagnostic round, kept on their device until they submit (handoff 6.11: progress
 * saves if the person stops). The record and its rules are the scan's (lib/scan/draft.ts): the version
 * answered, the answers by question, the question on screen, parsed when read and removed when stale.
 *
 * - **One record per round and person,** so two people signing in on one shared browser never see each
 *   other's answers. The key is the device's own: it never reaches the database, and submitting removes it.
 * - **It lasts as long as the round can.** A diagnostic is open for its window, 30 days at the most (the
 *   setting's range, handoff 8), and one 7-day extension, so a record unsaved for longer is for a round
 *   that has closed.
 */
export const roundDraftKey = (round: string, person: string) => `leaderpact.round.${round}.${person}`
export const ROUND_DRAFT_DAYS = 37
