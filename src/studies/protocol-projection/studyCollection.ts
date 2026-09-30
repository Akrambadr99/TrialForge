import type { StoragePort } from '../../workspace/repository'
import { readStored, writeStored } from '../../workspace/storageValidation'
import { studyCollectionRule } from './collectionValidation'
import { initialMilestone, readMilestone, requestMedicalReview, transitionMilestone } from './subjectLedger'
import type { SubjectMilestone } from './subjectLedger'
import { claimMedicalReview, protocolInbox } from './protocolWorkload'
import type { SubjectReviewRecord } from './protocolWorkload'

export interface StudyRecord { id: string; protocolVersion: number; revision: number; subjectIds: readonly string[] }
export interface SubjectRecord { id: string; studyId: string; milestone: SubjectMilestone; archived: boolean }
export interface StudyCollection { studies: readonly StudyRecord[]; subjects: readonly SubjectRecord[]; audit: readonly { action: string; id: string; related: readonly string[] }[] }
export interface SubjectBatch { collection: StudyCollection; updated: string[]; skipped: string[]; blocked: { id: string; reason: string }[] }
const key = 'trialforge:study-collection:v1'
function prepared(version: number, review: boolean): SubjectMilestone {
  let milestone = transitionMilestone(initialMilestone, { type: 'record-visit', date: '2026-09-15', protocolVersion: 4, findings: [] })
  if (version > 4) {
    milestone = transitionMilestone(milestone, { type: 'amend-protocol', version, reason: 'Safety-monitoring amendment approved.', actor: 'protocol author' })
    if (review) milestone = requestMedicalReview(milestone, 'protocol author')
  }
  return milestone
}
export function seedStudyCollection(legacy: SubjectMilestone = initialMilestone): StudyCollection {
  return { studies: [
    { id: 'TF-201', protocolVersion: 5, revision: 1, subjectIds: ['S-014', 'S-015', 'S-016', 'S-017'] },
    { id: 'TF-300', protocolVersion: 5, revision: 1, subjectIds: ['S-301', 'S-302'] },
  ], subjects: [
    { id: 'S-014', studyId: 'TF-201', milestone: legacy, archived: false },
    { id: 'S-015', studyId: 'TF-201', milestone: prepared(5, true), archived: false },
    { id: 'S-016', studyId: 'TF-201', milestone: prepared(5, true), archived: false },
    { id: 'S-017', studyId: 'TF-201', milestone: prepared(5, false), archived: true },
    { id: 'S-301', studyId: 'TF-300', milestone: prepared(5, true), archived: false },
    { id: 'S-302', studyId: 'TF-300', milestone: prepared(4, false), archived: false },
  ], audit: [] }
}
export function readStudyCollection(storage: StoragePort): StudyCollection {
  return readStored(storage, key, studyCollectionRule, () => seedStudyCollection(readMilestone(storage)),
    'trialforge:subject:S-014:milestones:v1')
}
export function saveStudyCollection(storage: StoragePort, value: StudyCollection): StudyCollection {
  return writeStored(storage, key, studyCollectionRule, value)
}
export function subjectById(value: StudyCollection, id: string): SubjectRecord {
  const record = value.subjects.find(item => item.id === id)
  if (!record) throw new Error(`Subject ${id} was not found.`)
  return record
}
export function subjectRows(value: StudyCollection, query = '', filter = 'active'): SubjectRecord[] {
  const needle = query.trim().toLowerCase()
  return value.subjects.filter(item => (filter === 'all' || (filter === 'archived') === item.archived) &&
    (!needle || `${item.id} ${item.studyId}`.toLowerCase().includes(needle))).toSorted((a, b) => a.id.localeCompare(b.id))
}
export function subjectInbox(value: StudyCollection) {
  return protocolInbox(value.subjects.filter(item => !item.archived).map(item => ({
    subjectId: item.id, studyId: item.studyId, milestone: item.milestone,
  }))).filter(item => item.status === 'open')
}
export function claimSubjectReview(value: StudyCollection, id: string, reviewerId: string, expectedRevision: number): StudyCollection {
  const record = subjectById(value, id)
  if (record.archived) throw new Error('Archived subject cannot receive a review claim.')
  const records: SubjectReviewRecord[] = value.subjects.filter(item => !item.archived).map(item => ({
    subjectId: item.id, studyId: item.studyId, milestone: item.milestone,
  }))
  const milestone = claimMedicalReview(record.milestone, record.studyId, reviewerId, records, expectedRevision)
  return { ...value, subjects: value.subjects.map(item => item.id === id ? { ...item, milestone } : item),
    audit: [...value.audit, { action: 'medical-review-claimed', id, related: [reviewerId] }] }
}
export function amendStudy(value: StudyCollection, studyId: string, expectedRevision: number): SubjectBatch {
  const study = value.studies.find(item => item.id === studyId)
  if (study?.revision !== expectedRevision) throw new Error('Study revision changed.')
  const version = study.protocolVersion + 1
  const updated: string[] = []; const skipped: string[] = []; const blocked: SubjectBatch['blocked'] = []
  const subjects = value.subjects.map(item => {
    if (item.studyId !== studyId || item.archived) { skipped.push(item.id); return item }
    try {
      const milestone = transitionMilestone(item.milestone, { type: 'amend-protocol', version,
        reason: 'Study-wide safety protocol amendment.', actor: 'protocol author' })
      updated.push(item.id); return { ...item, milestone }
    } catch (error) { blocked.push({ id: item.id, reason: error instanceof Error ? error.message : 'Amendment blocked.' }); return item }
  })
  return { collection: { ...value, subjects, studies: value.studies.map(item => item.id === studyId ?
    { ...item, protocolVersion: version, revision: item.revision + 1 } : item),
    audit: [...value.audit, { action: 'study-amended', id: studyId, related: updated }] }, updated, skipped, blocked }
}
export function requestSubjectReviews(value: StudyCollection, ids: readonly string[]): SubjectBatch {
  const updated: string[] = []; const skipped: string[] = []; const blocked: SubjectBatch['blocked'] = []
  const unique = new Set(ids)
  const subjects = value.subjects.map(item => {
    if (!unique.has(item.id)) return item
    if (item.archived || item.milestone.certifiedProtocolVersion === item.milestone.activeProtocolVersion) { skipped.push(item.id); return item }
    try { const milestone = requestMedicalReview(item.milestone, 'protocol author'); updated.push(item.id); return { ...item, milestone } }
    catch (error) { blocked.push({ id: item.id, reason: error instanceof Error ? error.message : 'Review request blocked.' }); return item }
  })
  for (const id of unique) if (!value.subjects.some(item => item.id === id)) blocked.push({ id, reason: 'Subject not found.' })
  return { collection: { ...value, subjects, audit: [...value.audit, { action: 'reviews-requested', id: 'selection', related: updated }] }, updated, skipped, blocked }
}
export function createSubject(value: StudyCollection, id: string, studyId: string): StudyCollection {
  if (!/^S-\d{3}$/.test(id) || value.subjects.some(item => item.id === id)) throw new Error('Enter a unique subject ID.')
  const study = value.studies.find(item => item.id === studyId)
  if (!study) throw new Error('Study not found.')
  const milestone = { ...initialMilestone, activeProtocolVersion: study.protocolVersion, certifiedProtocolVersion: study.protocolVersion }
  return { ...value, subjects: [...value.subjects, { id, studyId, milestone, archived: false }],
    studies: value.studies.map(item => item.id === studyId ? { ...item, subjectIds: [...item.subjectIds, id] } : item),
    audit: [...value.audit, { action: 'subject-created', id, related: [studyId] }] }
}
export function archiveSubject(value: StudyCollection, id: string): StudyCollection {
  const record = subjectById(value, id)
  if (record.archived || record.milestone.medicalReviews?.some(item => item.status === 'open'))
    throw new Error('Resolve open medical review before archiving subject.')
  return { ...value, subjects: value.subjects.map(item => item.id === id ? { ...item, archived: true } : item),
    audit: [...value.audit, { action: 'subject-archived', id, related: [record.studyId] }] }
}
