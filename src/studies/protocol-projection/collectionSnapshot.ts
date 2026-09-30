import type { SnapshotAdapter } from '../../workspace/collectionSnapshot'
import { readStudyCollection, type StudyCollection } from './studyCollection'
import { studyCollectionRule } from './collectionValidation'

/** Only this primary collection is included; other browser-local workflows remain separate. */
export const collectionSnapshotAdapter: SnapshotAdapter<StudyCollection> = {
  product: 'TrialForge',
  scope: 'study-collection',
  label: 'Study subject collection',
  read: readStudyCollection,
  validate: studyCollectionRule,
  groups: collection => [
    { key: 'subjects', label: 'Subjects', records: collection.subjects.map(record => ({
      id: record.id, label: `${record.studyId} · Protocol ${String(record.milestone.activeProtocolVersion)}${record.archived ? ' · Archived' : ''}`, value: record,
    })) },
    { key: 'studies', label: 'Studies', records: collection.studies.map(record => ({
      id: record.id, label: record.id, value: record,
    })) },
  ],
}
