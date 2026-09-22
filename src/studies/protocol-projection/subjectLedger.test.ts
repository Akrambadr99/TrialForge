import { describe, expect, it } from 'vitest'
import { MemoryStorage } from '../../data/memory-storage'
import { commitMilestone, nextVisitBlockers, readMilestone } from './subjectLedger'
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
})
