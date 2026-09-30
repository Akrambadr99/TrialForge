import type { StorageReader } from '../../platform/storage-port'
import { readStudyCollection } from './studyCollection'

export function activeRecordWork(storage: StorageReader) {
  return readStudyCollection(storage).subjects.filter(item => !item.archived).map(item => ({ subjectId: item.id, studyId: item.studyId, milestone: item.milestone }))
}
export function selectedRecordWork(storage: StorageReader, id: string) {
  const record = activeRecordWork(storage).find(item => item.subjectId === id)
  if (!record) throw new Error('Active record not found.')
  return record
}
