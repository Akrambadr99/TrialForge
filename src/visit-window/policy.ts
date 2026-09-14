import { requireThat } from '../workspace/values'
export const workflowKey = "visit-window"
export const workflowLabel = "Protocol visit windows"
export const ruleKind = "window"
export interface VisitWindowRecord { measured: number; limit: number; evidence: string; revision: number }
export function validateAuthorization(record: VisitWindowRecord) {
  requireThat(Number.isSafeInteger(record.measured) && Number.isSafeInteger(record.limit), 'Workflow measurements must be safe integers.')
  requireThat(record.measured >= 0 && record.limit >= 0, 'Workflow measurements cannot be negative.')
  requireThat(record.measured <= record.limit, 'Visit day falls outside Latest permitted day.')
  requireThat(record.evidence.trim().length >= 8, 'Protocol visit windows require traceable evidence.')
  requireThat(record.revision > 0, 'Protocol visit windows require a current record revision.')
  return { authorized: true as const, fingerprint: [workflowKey, record.measured, record.limit, record.revision].join(':') }
}
export function canRoleAdvance(role: string, phase: string) {
  const matrix: Record<string, readonly string[]> = { draft: ['coordinator'], review: ['reviewer'], authorized: ['operator'], active: ['owner'], blocked: ['reviewer'] }
  return (matrix[phase] ?? []).includes(role)
}
