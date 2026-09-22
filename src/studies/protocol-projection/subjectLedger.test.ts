import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../../data/memory-storage'
import { amendmentReviewPolicy, commitMilestone, nextVisitBlockers, readMilestone } from './subjectLedger'
describe('subject milestone across workflows', () => {
  it('persists a protocol-pinned visit and unblocks the next milestone', () => {
    const storage = new MemoryStorage()
    expect(nextVisitBlockers(readMilestone(storage))).toHaveLength(1)
    commitMilestone(storage, { type: 'record-visit', date: '2026-09-14', protocolVersion: 4, findings: [] })
    expect(readMilestone(storage).protocolVersion).toBe(4)
    expect(nextVisitBlockers(readMilestone(storage))).toEqual([])
  })
  it('refuses invalid evidence and protects downstream authorization', () => {
    const storage = new MemoryStorage()
    expect(() => commitMilestone(storage, { type: 'record-visit', date: '2026-09-14', protocolVersion: 4, findings: ['consent'] })).toThrow()
    commitMilestone(storage, { type: 'record-visit', date: '2026-09-14', protocolVersion: 4, findings: [] })
    commitMilestone(storage, { type: 'authorize-next' })
    expect(() => commitMilestone(storage, { type: 'reopen-visit' })).toThrow(/depends/)
    expect(readMilestone(storage).history.map(item => item.source)).toEqual(['protocol-timeline', 'subject-readiness'])
  })
  it('invalidates an authorized visit after protocol amendment and permits reviewed recovery', () => {
    const storage = new MemoryStorage()
    commitMilestone(storage, { type: 'record-visit', date: '2026-09-14', protocolVersion: 4, findings: [] })
    commitMilestone(storage, { type: 'authorize-next' })
    const amended = commitMilestone(storage, { type: 'amend-protocol', version: 5, reason: 'New monitoring requirements apply.', actor: 'protocol author' })
    expect(amended.nextVisitAuthorized).toBe(false)
    expect(nextVisitBlockers(amended)).toEqual([expect.stringMatching(/superseded/)] as string[])
    expect(() => commitMilestone(storage, { type: 'authorize-next' })).toThrow(/superseded/)
    expect(amendmentReviewPolicy(amended, 'protocol author')).toMatchObject({ allowed: false, queue: 'medical-review' })
    expect(() => commitMilestone(storage, { type: 'revalidate-visit', reason: 'Source evidence reviewed for v5.', actor: 'medical reviewer' })).toThrow(/certification/)
    commitMilestone(storage, { type: 'certify-amendment', actor: 'medical reviewer', reason: 'Independent medical review supports protocol v5.' })
    commitMilestone(storage, { type: 'revalidate-visit', reason: 'Source evidence reviewed for v5.', actor: 'medical reviewer' })
    expect(nextVisitBlockers(readMilestone(storage))).toEqual([])
  })
})
