export interface ProtocolVersion { version: number; effectiveFrom: string; visitDay: number; windowBefore: number; windowAfter: number; requiredConsent: number }
export interface Subject { id: string; enrolledAt: string; consentVersion: number; consentAt: string; withdrawnAt?: string | undefined }
export interface Visit { id: string; subjectId: string; number: number; performedAt?: string }
export const protocolVersions: readonly ProtocolVersion[] = [
  { version: 3, effectiveFrom: '2026-01-01', visitDay: 84, windowBefore: 3, windowAfter: 3, requiredConsent: 3 },
  { version: 4, effectiveFrom: '2026-06-01', visitDay: 85, windowBefore: 3, windowAfter: 3, requiredConsent: 4 },
]
export const subject: Subject = { id: 'S-014', enrolledAt: '2026-06-21', consentVersion: 4, consentAt: '2026-06-20' }
export const visit: Visit = { id: 'VIS-6', subjectId: 'S-014', number: 6 }
export function effectiveProtocol(versions: readonly ProtocolVersion[], date: string): ProtocolVersion | undefined {
  return versions.filter(item => item.effectiveFrom <= date).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0]
}
function addDays(date: string, days: number): string {
  const next = new Date(date + 'T00:00:00Z')
  next.setUTCDate(next.getUTCDate() + days)
  return next.toISOString().slice(0, 10)
}
export function visitWindow(person: Subject, protocol: ProtocolVersion) {
  return { opens: addDays(person.enrolledAt, protocol.visitDay - protocol.windowBefore), closes: addDays(person.enrolledAt, protocol.visitDay + protocol.windowAfter) }
}
export function visitFindings(person: Subject, appointment: string, versions = protocolVersions): string[] {
  const findings: string[] = []
  const protocol = effectiveProtocol(versions, appointment)
  if (!protocol) return ['No effective protocol is available.']
  const window = visitWindow(person, protocol)
  if (appointment < window.opens || appointment > window.closes) findings.push(`Visit is outside protocol v${String(protocol.version)} window ${window.opens}–${window.closes}.`)
  if (person.consentVersion < protocol.requiredConsent || person.consentAt > appointment) findings.push(`Consent v${String(protocol.requiredConsent)} must precede the visit.`)
  if (person.withdrawnAt && appointment >= person.withdrawnAt) findings.push('Subject withdrew before this visit.')
  return findings
}
