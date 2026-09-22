import { describe, expect, it } from 'vitest'
import { initialMilestone, requestMedicalReview, transitionMilestone } from './subjectLedger'
import { claimMedicalReview, protocolInbox, releaseMedicalClaim, reviewerIneligibility, reviewerWorkload, transferMedicalReview } from './protocolWorkload'

function pending(version: number) {
  return requestMedicalReview(transitionMilestone(initialMilestone, {
    type: 'amend-protocol', version, actor: 'protocol author', reason: 'Protocol amendment requires independent review.',
  }), 'protocol author')
}

describe('named medical-review work coordination', () => {
  it('claims from a subject collection and prevents double claim and capacity overflow', () => {
    const first = pending(5)
    const second = pending(6)
    const firstClaimed = claimMedicalReview(first, 'TF-201', 'med-noor', [
      { subjectId: 'S-014', studyId: 'TF-201', milestone: first },
      { subjectId: 'S-015', studyId: 'TF-201', milestone: second },
    ], first.revision)
    const records = [
      { subjectId: 'S-014', studyId: 'TF-201', milestone: firstClaimed },
      { subjectId: 'S-015', studyId: 'TF-201', milestone: second },
    ]
    expect(reviewerWorkload(records, 'med-noor')).toBe(1)
    expect(protocolInbox(records, 'med-noor')[0]?.subjectId).toBe('S-014')
    expect(reviewerIneligibility(second, 'TF-201', 'med-noor', records)).toContain('Reviewer is at capacity.')
    expect(() => claimMedicalReview(firstClaimed, 'TF-201', 'med-elaine', records, firstClaimed.revision)).toThrow(/already claimed/)
    expect(() => claimMedicalReview(second, 'TF-201', 'med-noor', records, second.revision)).toThrow(/at capacity/)
    expect(() => transitionMilestone(firstClaimed, { type: 'certify-amendment', actor: 'medical reviewer',
      reviewerId: 'med-elaine', reason: 'Independent certification of protocol evidence.' })).toThrow(/another named reviewer/)
    const certified = transitionMilestone(firstClaimed, { type: 'certify-amendment', actor: 'medical reviewer',
      reviewerId: 'med-noor', reason: 'Independent certification of protocol evidence.' })
    expect(certified.certifiedProtocolVersion).toBe(5)
  })

  it('allows reasoned supervisor transfer, voluntary release, and rejects stale claims', () => {
    const first = pending(5)
    const claimed = claimMedicalReview(first, 'TF-201', 'med-elaine', [], first.revision)
    expect(() => transferMedicalReview(claimed, 'TF-201', 'protocol author', 'med-noor',
      'Reviewer unavailable for this study.', [])).toThrow(/supervisor/)
    const transferred = transferMedicalReview(claimed, 'TF-201', 'medical supervisor', 'med-noor',
      'Qualified reviewer takes this study handoff.', [])
    expect(transferred.medicalReviews?.[0]?.assigneeId).toBe('med-noor')
    const released = releaseMedicalClaim(transferred, 'med-noor')
    expect(released.medicalReviews?.[0]?.assigneeId).toBeNull()
    const stale = transitionMilestone(released, { type: 'amend-protocol', version: 6,
      actor: 'protocol author', reason: 'New amendment supersedes earlier review.' })
    expect(() => claimMedicalReview(stale, 'TF-201', 'med-elaine', [], stale.revision)).toThrow(/No current/)
  })
})
