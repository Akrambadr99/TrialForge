import { array, booleanValue, nonEmptyText, nonNegativeInteger, nullable, object, oneOf, optional, refine, text, uniqueBy } from '../../workspace/storageValidation'
import type { MedicalReview, SubjectMilestone } from './subjectLedger'
import type { StudyCollection, StudyRecord, SubjectRecord } from './studyCollection'

const medicalReview = object<MedicalReview>({
  id: nonEmptyText, protocolVersion: nonNegativeInteger, sourceRevision: nonNegativeInteger,
  requestedBy: text, assignee: text, assigneeId: optional(nullable(text)),
  status: oneOf('open', 'stale', 'completed', 'superseded'), supersedesId: optional(text),
  outcome: optional(oneOf('certified', 'changes_requested')), reason: optional(text),
})
const milestone = object<SubjectMilestone>({
  visitAt: nullable(text), protocolVersion: nullable(nonNegativeInteger), activeProtocolVersion: nonNegativeInteger,
  amendmentAuthor: nullable(text), certifiedProtocolVersion: nonNegativeInteger, nextVisitAuthorized: booleanValue,
  medicalReviews: optional(uniqueBy(array(medicalReview), 'id')), revision: nonNegativeInteger,
  history: array(object<SubjectMilestone['history'][number]>({
    revision: nonNegativeInteger, action: text, source: text, actor: optional(text),
  })),
})
const study = object<StudyRecord>({
  id: nonEmptyText, protocolVersion: nonNegativeInteger, revision: nonNegativeInteger,
  subjectIds: refine(array(nonEmptyText), ids => new Set(ids).size === ids.length, 'duplicate subject membership'),
})
const subject = object<SubjectRecord>({ id: nonEmptyText, studyId: nonEmptyText, milestone, archived: booleanValue })

/** Structural persistence rules do not forbid stale reviews or protocol/visit version differences. */
export const studyCollectionRule = refine(object<StudyCollection>({
  studies: uniqueBy(array(study), 'id'), subjects: uniqueBy(array(subject), 'id'),
  audit: array(object<StudyCollection['audit'][number]>({ action: text, id: text, related: array(text) })),
}), collection => {
  const memberships = new Map<string, string>()
  for (const parent of collection.studies) {
    for (const id of parent.subjectIds) {
      if (memberships.has(id)) return false
      memberships.set(id, parent.id)
    }
  }
  return memberships.size === collection.subjects.length && collection.subjects.every(record => memberships.get(record.id) === record.studyId)
},
'study and subject membership references are inconsistent')
