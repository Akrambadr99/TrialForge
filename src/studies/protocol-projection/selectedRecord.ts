import type { StoragePort } from '../../workspace/repository'
import { bindRecord } from '../../workspace/recordStorage'
import { readStudyCollection, saveStudyCollection } from './studyCollection'
import { readMilestone } from './subjectLedger'

export function openSelectedRecord(storage: StoragePort, id = 'S-014') {
  return bindRecord(storage, id, {
    key: 'trialforge:subject:S-014:milestones:v1',
    collectionKey: 'trialforge:study-collection:v1',
    read: readStudyCollection, save: saveStudyCollection,
    find: (collection, target) => collection.subjects.find(item => item.id === target),
    value: record => record.milestone, archived: record => record.archived,
    replace: (collection, target, raw) => {
      const value = readMilestone({ getItem: () => raw, setItem: () => { throw new Error('Read only decoder.') } })
      return { ...collection, subjects: collection.subjects.map(item => item.id === target ? { ...item, milestone: value } : item),
        audit: [...collection.audit, { action: 'detail-updated', id: target, related: [] }] }
    },
  })
}
