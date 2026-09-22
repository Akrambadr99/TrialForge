import type { StoragePort } from '../../workspace/repository'

export interface SubjectMilestone {
  visitAt: string | null
  protocolVersion: number | null
  nextVisitAuthorized: boolean
  revision: number
  history: readonly { revision: number; action: string; source: string }[]
}
export type SubjectAction =
  | { type: 'record-visit'; date: string; protocolVersion: number; findings: readonly string[] }
  | { type: 'authorize-next' }
  | { type: 'reopen-visit' }
const key = 'trialforge:subject:S-014:milestones:v1'
export const initialMilestone: SubjectMilestone = { visitAt: null, protocolVersion: null, nextVisitAuthorized: false, revision: 0, history: [] }

export function readMilestone(storage: StoragePort): SubjectMilestone {
  const raw = storage.getItem(key)
  if (!raw) return initialMilestone
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || !('revision' in value) || typeof value.revision !== 'number' ||
    !('history' in value) || !Array.isArray(value.history) || !('visitAt' in value) ||
    (value.visitAt !== null && typeof value.visitAt !== 'string') || !('nextVisitAuthorized' in value) ||
    typeof value.nextVisitAuthorized !== 'boolean' || !('protocolVersion' in value) ||
    (value.protocolVersion !== null && typeof value.protocolVersion !== 'number')) throw new Error('Invalid subject milestone record.')
  return value as SubjectMilestone
}
export function nextVisitBlockers(state: SubjectMilestone): string[] {
  return state.visitAt ? [] : ['Visit 6 evidence must be recorded before the next visit is authorized.']
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
  }
  const revision = state.revision + 1
  return { ...next, revision, history: [...state.history, {
    revision, action: action.type, source: action.type === 'authorize-next' ? 'subject-readiness' : 'protocol-timeline',
  }] }
}
export function commitMilestone(storage: StoragePort, action: SubjectAction): SubjectMilestone {
  const next = transitionMilestone(readMilestone(storage), action)
  storage.setItem(key, JSON.stringify(next))
  return next
}
