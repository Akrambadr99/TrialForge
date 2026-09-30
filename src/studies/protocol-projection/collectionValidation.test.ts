import { describe, expect, it, vi } from 'vitest'
import { StoredDataError } from '../../workspace/storageValidation'
import { studyCollectionRule } from './collectionValidation'
import { initialMilestone, transitionMilestone } from './subjectLedger'
import { amendStudy, archiveSubject, createSubject, readStudyCollection, requestSubjectReviews,
  saveStudyCollection, seedStudyCollection, subjectById } from './studyCollection'

const key = 'trialforge:study-collection:v1'
const legacyKey = 'trialforge:subject:S-014:milestones:v1'
function storage(entries: [string, string][] = []) {
  const values = new Map(entries)
  return { values, getItem: (id: string) => values.get(id) ?? null,
    setItem: vi.fn((id: string, raw: string) => { values.set(id, raw) }) }
}
function changed(path: string, value: unknown) {
  const collection = structuredClone(seedStudyCollection())
  const segments = path.split('.'); const field = segments.pop()
  if (!field) throw new Error('A fixture path is required.')
  let parent: unknown = collection
  for (const segment of segments) parent = (parent as Record<string, unknown>)[segment]
  ;(parent as Record<string, unknown>)[field] = value
  return collection
}

describe('study collection storage integrity', () => {
  it.each([
    ['subjects.0', null], ['subjects.0.milestone', null], ['subjects.1.milestone.medicalReviews.0', null],
    ['subjects.1.milestone.medicalReviews', {}], ['subjects.1.milestone.medicalReviews.0.status', 'PRIVATE-INVALID-STATE'],
    ['subjects.1.milestone.medicalReviews.0.outcome', 'approved'], ['subjects.1.milestone.medicalReviews.0.assigneeId', 42],
    ['subjects.1.milestone.medicalReviews.0.sourceRevision', -1], ['subjects.0.milestone.revision', 0.5],
    ['subjects.0.milestone.activeProtocolVersion', '4'], ['subjects.0.milestone.nextVisitAuthorized', 'false'],
    ['subjects.1.milestone.history.0', null], ['subjects.1.milestone.history.0.source', false],
    ['subjects.0.archived', null], ['studies.0', null], ['studies.0.subjectIds.0', false],
    ['subjects.0.studyId', 'missing'], ['studies.0.subjectIds', []], ['audit', [null]],
  ])('rejects malformed %s without changing saved text', (path, value) => {
    const raw = JSON.stringify(changed(path, value)); const port = storage([[key, raw]])
    expect(() => readStudyCollection(port)).toThrow(StoredDataError)
    expect(() => readStudyCollection(port)).not.toThrow('PRIVATE-INVALID-STATE')
    expect(port.values.get(key)).toBe(raw); expect(port.setItem).not.toHaveBeenCalled()
  })

  it('rejects duplicate subject, study, membership and review identities', () => {
    const seed = seedStudyCollection()
    const candidates = [
      { ...seed, subjects: [...seed.subjects, seed.subjects[0]] },
      { ...seed, studies: [...seed.studies, seed.studies[0]] },
      changed('studies.0.subjectIds', ['S-014', 'S-014']),
      changed('subjects.1.milestone.medicalReviews', Array(2).fill(seed.subjects[1]?.milestone.medicalReviews?.[0])),
    ]
    for (const value of candidates) expect(() => readStudyCollection(storage([[key, JSON.stringify(value)]]))).toThrow('duplicate')
  })

  it.each(['', '{private damaged data'])('preserves unreadable primary text instead of seeding: %j', raw => {
    const port = storage([[key, raw]])
    expect(() => readStudyCollection(port)).toThrow(StoredDataError)
    expect(port.values.get(key)).toBe(raw); expect(port.setItem).not.toHaveBeenCalled()
  })

  it('roundtrips valid data, optional legacy fields and unknown metadata unchanged', () => {
    const value = changed('subjects.0.milestone.medicalReviews', undefined)
    Object.assign(value, { importMetadata: { source: 'research archive', version: 7 } })
    Object.assign(subjectById(value, 'S-015').milestone, { sourceNote: ['retained', 123] })
    const raw = JSON.stringify(value); const port = storage([[key, raw]])
    const loaded = readStudyCollection(port)
    expect(studyCollectionRule(loaded)).toBe(loaded)
    expect(saveStudyCollection(port, loaded)).toBe(loaded)
    expect(port.values.get(key)).toBe(raw)
  })

  it('validates legacy migration output while retaining supported normalization', () => {
    const legacy = { visitAt: null, protocolVersion: null, revision: 0, nextVisitAuthorized: false, history: [], sourceNote: 'kept' }
    const raw = JSON.stringify(legacy); const port = storage([[legacyKey, raw]])
    expect(subjectById(readStudyCollection(port), 'S-014').milestone).toEqual({ ...legacy,
      activeProtocolVersion: 4, amendmentAuthor: null, certifiedProtocolVersion: 4, medicalReviews: [] })
    expect(port.values.get(legacyKey)).toBe(raw); expect(port.setItem).not.toHaveBeenCalled()
    const malformed = JSON.stringify({ ...initialMilestone, history: [null] })
    const damaged = storage([[legacyKey, malformed]])
    expect(() => readStudyCollection(damaged)).toThrow(expect.objectContaining({ key: legacyKey, operation: 'read' }))
    expect(damaged.values.get(legacyKey)).toBe(malformed); expect(damaged.setItem).not.toHaveBeenCalled()
  })

  it.each(['', '{private legacy data'])('reports the legacy recovery key for unreadable legacy text: %j', raw => {
    const port = storage([[legacyKey, raw]])
    expect(() => readStudyCollection(port)).toThrow(expect.objectContaining({ key: legacyKey, operation: 'read' }))
    expect(port.values.get(legacyKey)).toBe(raw); expect(port.setItem).not.toHaveBeenCalled()
  })

  it('rejects unchecked runtime saves before writing, including non-finite revisions', () => {
    const raw = JSON.stringify(seedStudyCollection()); const port = storage([[key, raw]])
    for (const value of [changed('subjects.0', null), changed('subjects.0.milestone.revision', Infinity)]) {
      expect(() => saveStudyCollection(port, value)).toThrow(expect.objectContaining({ key, operation: 'write' }))
      expect(port.values.get(key)).toBe(raw); expect(port.setItem).not.toHaveBeenCalled()
    }
  })

  it('accepts real stale, superseded, certified and archived transitions without flattening history', () => {
    const stale = amendStudy(seedStudyCollection(), 'TF-201', 1).collection
    expect(subjectById(stale, 'S-015').milestone.medicalReviews?.[0]?.status).toBe('stale')
    expect(studyCollectionRule(stale)).toBe(stale)
    const renewed = requestSubjectReviews(stale, ['S-015']).collection
    const review = subjectById(renewed, 'S-015').milestone
    expect(review.medicalReviews?.map(item => item.status)).toEqual(['superseded', 'open'])
    const certified = transitionMilestone(review, { type: 'certify-amendment', actor: 'medical reviewer', reason: 'Safety evidence reviewed independently.' })
    const completed = { ...renewed, subjects: renewed.subjects.map(item => item.id === 'S-015' ? { ...item, milestone: certified } : item) }
    const archived = archiveSubject(createSubject(completed, 'S-018', 'TF-201'), 'S-018')
    const port = storage(); saveStudyCollection(port, archived)
    expect(readStudyCollection(port)).toEqual(archived)
    expect(subjectById(archived, 'S-015').milestone.protocolVersion).not.toBe(certified.activeProtocolVersion)
  })
})
