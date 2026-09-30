import type { StudyCollection } from './studyCollection'

type Record = StudyCollection['subjects'][number]
function selected(path: string, id: string) { return path + (path.includes('?') ? '&' : '?') + 'record=' + encodeURIComponent(id) }
export function recordDetailPath(record: Record) { return selected('/studies/' + record.studyId + '/subjects/' + record.id + '/timeline', record.id) }
export function recordDecisionPath(record: Record) { return selected('/studies/' + record.studyId + '/subjects/' + record.id + '/readiness', record.id) }
