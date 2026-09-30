import type { StoragePort } from '../../workspace/repository'
import { readStudyCollection } from './studyCollection'

export function activeRecordWork(storage: StoragePort) {
  return readStudyCollection(storage).subjects.filter(item => !item.archived).map(item => ({ subjectId: item.id, studyId: item.studyId, milestone: item.milestone }))
}
export function selectedRecordWork(storage: StoragePort, id: string) {
  const record = activeRecordWork(storage).find(item => item.subjectId === id)
  if (!record) throw new Error('Active record not found.')
  return record
}
