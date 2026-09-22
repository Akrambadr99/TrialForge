import type { StoragePort } from '../../workspace/repository'

export interface SubjectMilestone {
  visitAt: string | null
  protocolVersion: number | null
  activeProtocolVersion: number
  amendmentAuthor: string | null
  certifiedProtocolVersion: number
  nextVisitAuthorized: boolean
  revision: number
  history: readonly { revision: number; action: string; source: string; actor?: string }[]
}
export type SubjectAction =
  | { type: 'record-visit'; date: string; protocolVersion: number; findings: readonly string[] }
  | { type: 'authorize-next' }
  | { type: 'reopen-visit' }
  | { type: 'amend-protocol'; version: number; reason: string; actor: string }
  | { type: 'certify-amendment'; actor: string; reason: string }
  | { type: 'revalidate-visit'; reason: string; actor: string }
const key = 'trialforge:subject:S-014:milestones:v1'
export const initialMilestone: SubjectMilestone = { visitAt: null, protocolVersion: null, activeProtocolVersion: 4, amendmentAuthor: null, certifiedProtocolVersion: 4, nextVisitAuthorized: false, revision: 0, history: [] }

export function readMilestone(storage: StoragePort): SubjectMilestone {
  const raw = storage.getItem(key)
  if (!raw) return initialMilestone
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || !('revision' in value) || typeof value.revision !== 'number' ||
    !('history' in value) || !Array.isArray(value.history) || !('visitAt' in value) ||
    (value.visitAt !== null && typeof value.visitAt !== 'string') || !('nextVisitAuthorized' in value) ||
    typeof value.nextVisitAuthorized !== 'boolean' || !('protocolVersion' in value) ||
    (value.protocolVersion !== null && typeof value.protocolVersion !== 'number')) throw new Error('Invalid subject milestone record.')
  const record = value as Omit<SubjectMilestone, 'activeProtocolVersion' | 'amendmentAuthor' | 'certifiedProtocolVersion'> & Partial<Pick<SubjectMilestone, 'activeProtocolVersion' | 'amendmentAuthor' | 'certifiedProtocolVersion'>>
  return { ...record, activeProtocolVersion: record.activeProtocolVersion ?? 4, amendmentAuthor: record.amendmentAuthor ?? null, certifiedProtocolVersion: record.certifiedProtocolVersion ?? 4 }
}
export function amendmentReviewPolicy(state: SubjectMilestone, actor: string): { allowed: boolean; blockers: string[]; queue: 'author' | 'medical-review' | 'visit-revalidation' } {
  const blockers: string[] = []
  if (state.certifiedProtocolVersion === state.activeProtocolVersion) blockers.push('No uncertified amendment requires review.')
  if (actor !== 'medical reviewer') blockers.push('Only the medical reviewer may certify a protocol amendment.')
  if (actor === state.amendmentAuthor) blockers.push('The amendment author cannot certify their own protocol.')
  return { allowed: blockers.length === 0, blockers, queue: state.certifiedProtocolVersion === state.activeProtocolVersion ? 'visit-revalidation' : 'medical-review' }
}
export function nextVisitBlockers(state: SubjectMilestone): string[] {
  if (!state.visitAt) return ['Visit 6 evidence must be recorded before the next visit is authorized.']
  return state.protocolVersion === state.activeProtocolVersion ? [] :
    ['Visit 6 was recorded under a superseded protocol and requires revalidation.']
}
export function transitionMilestone(state: SubjectMilestone, action: SubjectAction): SubjectMilestone {
  let next: SubjectMilestone
  switch (action.type) {
    case 'record-visit':
      if (state.visitAt) throw new Error('Visit 6 is already recorded.')
      if (action.findings.length) throw new Error('Protocol or consent findings block this visit.')
      next = { ...state, visitAt: action.date, protocolVersion: action.protocolVersion }
      break
    case 'authorize-next':
      if (nextVisitBlockers(state).length) throw new Error(nextVisitBlockers(state)[0])
      if (state.nextVisitAuthorized) throw new Error('The next visit is already authorized.')
      next = { ...state, nextVisitAuthorized: true }
      break
    case 'reopen-visit':
      if (!state.visitAt) throw new Error('No recorded visit exists.')
      if (state.nextVisitAuthorized) throw new Error('Next-visit authorization depends on Visit 6.')
      next = { ...state, visitAt: null, protocolVersion: null }
      break
    case 'amend-protocol':
      if (action.version <= state.activeProtocolVersion || action.reason.trim().length < 12) throw new Error('A newer protocol version and amendment reason are required.')
      if (action.actor !== 'protocol author') throw new Error('Only the protocol author may submit an amendment.')
      next = { ...state, activeProtocolVersion: action.version, amendmentAuthor: action.actor, nextVisitAuthorized: false }
      break
    case 'certify-amendment':
      { const policy = amendmentReviewPolicy(state, action.actor); if (!policy.allowed) throw new Error(policy.blockers[0]) }
      if (action.reason.trim().length < 12) throw new Error('A certification reason is required.')
      next = { ...state, certifiedProtocolVersion: state.activeProtocolVersion }
      break
    case 'revalidate-visit':
      if (!state.visitAt || state.protocolVersion === state.activeProtocolVersion) throw new Error('No recorded visit requires revalidation.')
      if (state.certifiedProtocolVersion !== state.activeProtocolVersion) throw new Error('The current amendment requires independent certification before visit revalidation.')
      if (action.actor !== 'medical reviewer') throw new Error('Only the medical reviewer may revalidate Visit 6.')
      if (action.reason.trim().length < 12) throw new Error('A revalidation reason is required.')
      next = { ...state, protocolVersion: state.activeProtocolVersion }
      break
  }
  const revision = state.revision + 1
  return { ...next, revision, history: [...state.history, {
    revision, action: action.type, source: action.type === 'authorize-next' ? 'subject-readiness' : 'protocol-timeline',
    ...('actor' in action ? { actor: action.actor } : {}),
  }] }
}
export function commitMilestone(storage: StoragePort, action: SubjectAction): SubjectMilestone {
  const next = transitionMilestone(readMilestone(storage), action)
  storage.setItem(key, JSON.stringify(next))
  return next
}
