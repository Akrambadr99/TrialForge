import { describe, expect, it } from 'vitest'
import { effectiveProtocol, protocolVersions, subject, visitFindings, visitWindow } from './protocol'
describe('subject protocol projection', () => {
  it('selects the effective protocol without leaking future amendments', () => {
    expect(effectiveProtocol(protocolVersions, '2026-05-31')?.version).toBe(3)
    expect(effectiveProtocol(protocolVersions, '2026-06-01')?.version).toBe(4)
  })
  it('computes a deterministic visit window', () => {
    expect(visitWindow(subject, protocolVersions[1]!)).toEqual({ opens: '2026-09-11', closes: '2026-09-17' })
  })
  it('distinguishes timing and consent findings', () => {
    expect(visitFindings(subject, '2026-09-14')).toEqual([])
    expect(visitFindings({ ...subject, consentVersion: 3 }, '2026-09-20')).toHaveLength(2)
  })
  it('rejects a withdrawn subject even inside the window', () => {
    expect(visitFindings({ ...subject, withdrawnAt: '2026-09-13' }, '2026-09-14')).toContain('Subject withdrew before this visit.')
  })
})
