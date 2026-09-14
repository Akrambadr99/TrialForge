import { requireThat } from '../workspace/values'
export const workflowKey = "protocol-amendment"
export const workflowLabel = "Protocol amendment control"
export const ruleKind = "dependency"
export interface ProtocolAmendmentRecord { measured: number; limit: number; evidence: string; revision: number }
export function validateAuthorization(record: ProtocolAmendmentRecord) {
  requireThat(Number.isSafeInteger(record.measured) && Number.isSafeInteger(record.limit), 'Workflow measurements must be safe integers.')
  requireThat(record.measured >= 0 && record.limit >= 0, 'Workflow measurements cannot be negative.')
  requireThat(record.measured === record.limit, 'Site protocol revision does not match Approved protocol revision.')
  requireThat(record.evidence.trim().length >= 8, 'Protocol amendment control require traceable evidence.')
  requireThat(record.revision > 0, 'Protocol amendment control require a current record revision.')
  return { authorized: true as const, fingerprint: [workflowKey, record.measured, record.limit, record.revision].join(':') }
}
export function canRoleAdvance(role: string, phase: string) {
  const matrix: Record<string, readonly string[]> = { draft: ['coordinator'], review: ['reviewer'], authorized: ['operator'], active: ['owner'], blocked: ['reviewer'] }
  return (matrix[phase] ?? []).includes(role)
}
