import { describe, expect, it } from 'vitest'
import { subjectTriage } from './collectionTriage'
import { claimSubjectReview, seedStudyCollection, subjectById } from './studyCollection'

describe('subject collection triage', () => {
  it('distinguishes current review work from current protocols', () => {
    const state = seedStudyCollection()
    expect(subjectTriage.state(subjectById(state, 'S-015'))).toBe('unclaimed')
    expect(subjectTriage.state(subjectById(state, 'S-302'))).toBe('current')
    expect(subjectTriage.state(subjectById(state, 'S-017'))).toBe('needs-review')
  })
  it('updates responsibility after a real reviewer claim', () => {
    const state = seedStudyCollection()
    const next = claimSubjectReview(state, 'S-015', 'med-elaine', subjectById(state, 'S-015').milestone.revision)
    expect(subjectTriage.state(subjectById(next, 'S-015'))).toBe('claimed')
    expect(subjectTriage.state(subjectById(state, 'S-015'))).toBe('unclaimed')
  })
  it('does not label an outdated open review as actionable', () => {
    const record = subjectById(seedStudyCollection(), 'S-015')
    expect(subjectTriage.state({ ...record, milestone: { ...record.milestone, revision: 99 } })).toBe('stale')
  })
  it('separates visit revalidation from medical review', () => {
    const record = subjectById(seedStudyCollection(), 'S-015')
    expect(subjectTriage.state({ ...record, milestone: { ...record.milestone, medicalReviews: [], certifiedProtocolVersion: 5 } })).toBe('revalidate')
  })
  it('searches linked study identity and exposes deterministic revision metadata', () => {
    const record = subjectById(seedStudyCollection(), 'S-015')
    const before = JSON.stringify(record)
    expect(subjectTriage.searchText(record)).toBe('S-015 TF-201')
    expect(subjectTriage.revision(record)).toBe(record.milestone.revision)
    expect(subjectTriage.states.some(item => item.value === subjectTriage.state(record))).toBe(true)
    expect(JSON.stringify(record)).toBe(before)
  })
})
