import { describe, expect, it } from 'vitest'
import { initialMilestone, medicalReviewInbox, requestMedicalReview, transitionMilestone } from './subjectLedger'

describe('protocol review handoff', () => {
  it('supersedes stale versions and releases certification only to the current reviewer', () => {
    let state = transitionMilestone(initialMilestone, { type: 'amend-protocol', version: 5, actor: 'protocol author', reason: 'Amendment changes visit requirements.' })
    state = requestMedicalReview(state, 'protocol author')
    expect(medicalReviewInbox(state, 'medical reviewer')).toHaveLength(1)
    state = transitionMilestone(state, { type: 'amend-protocol', version: 6, actor: 'protocol author', reason: 'New amendment replaces prior review.' })
    expect(() => transitionMilestone(state, { type: 'certify-amendment', actor: 'medical reviewer', reason: 'Independent medical decision made.' })).toThrow(/current medical review/)
    state = requestMedicalReview(state, 'protocol author')
    expect(state.medicalReviews?.map(item => item.status)).toEqual(['superseded', 'open'])
    state = transitionMilestone(state, { type: 'certify-amendment', actor: 'medical reviewer', reason: 'Independent medical decision made.' })
    expect(state.certifiedProtocolVersion).toBe(6)
    expect(state.medicalReviews?.at(-1)?.status).toBe('completed')
  })
})
