import { requireThat } from '../workspace/values'
export const workflowKey = "protocol-deviation"
export const workflowLabel = "Protocol deviation review"
export const ruleKind = "sequence"
export interface ProtocolDeviationRecord { measured: number; limit: number; evidence: string; revision: number }
export function validateAuthorization(record: ProtocolDeviationRecord) {
  requireThat(Number.isSafeInteger(record.measured) && Number.isSafeInteger(record.limit), 'Workflow measurements must be safe integers.')
  requireThat(record.measured >= 0 && record.limit >= 0, 'Workflow measurements cannot be negative.')
  requireThat(record.measured >= record.limit, 'Completed review stage have not reached Required review stage.')
  requireThat(record.evidence.trim().length >= 8, 'Protocol deviation review require traceable evidence.')
  requireThat(record.revision > 0, 'Protocol deviation review require a current record revision.')
  return { authorized: true as const, fingerprint: [workflowKey, record.measured, record.limit, record.revision].join(':') }
}
export function canRoleAdvance(role: string, phase: string) {
  const matrix: Record<string, readonly string[]> = { draft: ['coordinator'], review: ['reviewer'], authorized: ['operator'], active: ['owner'], blocked: ['reviewer'] }
  return (matrix[phase] ?? []).includes(role)
}
