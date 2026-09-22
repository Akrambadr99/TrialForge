import { describe, expect, it } from 'vitest'
import { amendStudy, archiveSubject, claimSubjectReview, createSubject, readStudyCollection,
  requestSubjectReviews, saveStudyCollection, seedStudyCollection, subjectById, subjectInbox } from './studyCollection'

function storage() { const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } } }
describe('persisted study and subject collection', () => {
  it('holds independent milestones and a real multi-study review queue', () => {
    const state = seedStudyCollection()
    expect(state.subjects).toHaveLength(6)
    expect(subjectInbox(state).map(item => item.subjectId)).toEqual(['S-015', 'S-016', 'S-301'])
  })
  it('claims a named reviewer only for the selected subject and persists it', () => {
    const port = storage(); const state = seedStudyCollection()
    const next = claimSubjectReview(state, 'S-015', 'med-elaine', subjectById(state, 'S-015').milestone.revision)
    saveStudyCollection(port, next)
    expect(subjectInbox(readStudyCollection(port)).find(item => item.subjectId === 'S-015')?.assigneeId).toBe('med-elaine')
    expect(subjectInbox(readStudyCollection(port)).find(item => item.subjectId === 'S-016')?.assigneeId).toBeNull()
    expect(() => claimSubjectReview(next, 'S-301', 'med-elaine', subjectById(next, 'S-301').milestone.revision)).toThrow('not qualified')
  })
  it('propagates protocol amendment only inside the linked study', () => {
    const state = seedStudyCollection(); const result = amendStudy(state, 'TF-201', 1)
    expect(result.updated).toEqual(['S-014', 'S-015', 'S-016'])
    expect(subjectById(result.collection, 'S-301').milestone.revision).toBe(subjectById(state, 'S-301').milestone.revision)
    expect(subjectById(result.collection, 'S-015').milestone.medicalReviews?.at(-1)?.status).toBe('stale')
    expect(() => amendStudy(result.collection, 'TF-201', 1)).toThrow('revision changed')
  })
  it('reports selected review outcomes and protects open references', () => {
    const state = seedStudyCollection()
    const result = requestSubjectReviews(state, ['S-015', 'S-017', 'S-302', 'missing'])
    expect(result.skipped).toEqual(['S-017', 'S-302'])
    expect(result.blocked.map(item => item.id)).toEqual(['S-015', 'missing'])
    expect(() => archiveSubject(state, 'S-015')).toThrow('open medical review')
    const created = createSubject(state, 'S-018', 'TF-201')
    expect(created.studies.find(item => item.id === 'TF-201')?.subjectIds).toContain('S-018')
    expect(archiveSubject(created, 'S-018').subjects.find(item => item.id === 'S-018')?.archived).toBe(true)
  })
})
