import type { MedicalReview, SubjectMilestone } from './subjectLedger'

export interface ProtocolReviewer {
  id: string
  name: string
  studyIds: readonly string[]
  maxOpenReviews: number
  available: boolean
  active: boolean
}
export interface SubjectReviewRecord { subjectId: string; studyId: string; milestone: SubjectMilestone }
export interface ProtocolInboxItem {
  subjectId: string
  studyId: string
  requestId: string
  protocolVersion: number
  sourceRevision: number
  assigneeId: string | null
  status: MedicalReview['status']
  actionable: boolean
}

export const protocolReviewers: readonly ProtocolReviewer[] = [
  { id: 'med-elaine', name: 'Dr. Elaine Wu', studyIds: ['TF-201'], maxOpenReviews: 2, available: true, active: true },
  { id: 'med-noor', name: 'Dr. Noor Haddad', studyIds: ['TF-201', 'TF-300'], maxOpenReviews: 1, available: true, active: true },
  { id: 'med-omar', name: 'Dr. Omar Bello', studyIds: ['TF-300'], maxOpenReviews: 2, available: false, active: true },
]

export function protocolInbox(records: readonly SubjectReviewRecord[], actorId?: string): ProtocolInboxItem[] {
  return records.flatMap(({ subjectId, studyId, milestone }) => (milestone.medicalReviews ?? []).map(request => ({
    subjectId, studyId, requestId: request.id, protocolVersion: request.protocolVersion,
    sourceRevision: request.sourceRevision, assigneeId: request.assigneeId ?? null, status: request.status,
    actionable: request.status === 'open' && request.sourceRevision === milestone.revision,
  }))).filter(item => actorId === undefined || item.assigneeId === actorId)
    .sort((a, b) => Number(b.actionable) - Number(a.actionable) ||
      a.sourceRevision - b.sourceRevision || a.subjectId.localeCompare(b.subjectId) || a.requestId.localeCompare(b.requestId))
}

export function reviewerWorkload(records: readonly SubjectReviewRecord[], actorId: string): number {
  return protocolInbox(records, actorId).filter(item => item.actionable).length
}

export function reviewerIneligibility(state: SubjectMilestone, studyId: string, actorId: string,
  records: readonly SubjectReviewRecord[]): string[] {
  const actor = protocolReviewers.find(item => item.id === actorId)
  const blockers: string[] = []
  if (!actor?.active || !actor.available) blockers.push('Reviewer is unavailable or inactive.')
  if (actor && !actor.studyIds.includes(studyId)) blockers.push('Reviewer is not qualified for this study.')
  if (actor && reviewerWorkload(records, actorId) >= actor.maxOpenReviews) blockers.push('Reviewer is at capacity.')
  if (actorId === state.amendmentAuthor) blockers.push('Amendment author cannot claim independent review.')
  return blockers
}

export function claimMedicalReview(state: SubjectMilestone, studyId: string, actorId: string,
  records: readonly SubjectReviewRecord[], expectedRevision: number): SubjectMilestone {
  if (state.revision !== expectedRevision) throw new Error('Subject revision changed before claim.')
  const request = (state.medicalReviews ?? []).find(item => item.status === 'open' && item.protocolVersion === state.activeProtocolVersion)
  if (request?.sourceRevision !== state.revision) throw new Error('No current medical review may be claimed.')
  if (request.assigneeId) throw new Error('Medical review is already claimed.')
  const blockers = reviewerIneligibility(state, studyId, actorId, records)
  if (blockers.length) throw new Error(blockers[0])
  const revision = state.revision + 1
  return { ...state, revision, medicalReviews: state.medicalReviews?.map(item => item.id === request.id ?
    { ...item, assigneeId: actorId, sourceRevision: revision } : item),
    history: [...state.history, { revision, action: 'medical-review-claimed', source: 'protocol-review', actor: actorId }] }
}

export function releaseMedicalClaim(state: SubjectMilestone, actorId: string): SubjectMilestone {
  const request = (state.medicalReviews ?? []).find(item => item.status === 'open' && item.assigneeId === actorId)
  if (request?.sourceRevision !== state.revision) throw new Error('Only the current reviewer may release a current claim.')
  const revision = state.revision + 1
  return { ...state, revision, medicalReviews: state.medicalReviews?.map(item => item.id === request.id ?
    { ...item, assigneeId: null, sourceRevision: revision } : item),
    history: [...state.history, { revision, action: 'medical-review-released', source: 'protocol-review', actor: actorId }] }
}

export function transferMedicalReview(state: SubjectMilestone, studyId: string, supervisor: string,
  nextActorId: string, reason: string, records: readonly SubjectReviewRecord[]): SubjectMilestone {
  if (supervisor !== 'medical supervisor' || reason.trim().length < 12) throw new Error('Medical supervisor and transfer reason are required.')
  const request = (state.medicalReviews ?? []).find(item => item.status === 'open' && item.assigneeId)
  if (request?.sourceRevision !== state.revision) throw new Error('Only a current claimed review may be transferred.')
  if (request.assigneeId === nextActorId) throw new Error('Review already belongs to this actor.')
  const blockers = reviewerIneligibility(state, studyId, nextActorId, records)
  if (blockers.length) throw new Error(blockers[0])
  const revision = state.revision + 1
  return { ...state, revision, medicalReviews: state.medicalReviews?.map(item => item.id === request.id ?
    { ...item, assigneeId: nextActorId, sourceRevision: revision } : item),
    history: [...state.history, { revision, action: 'medical-review-transferred', source: reason, actor: supervisor }] }
}
