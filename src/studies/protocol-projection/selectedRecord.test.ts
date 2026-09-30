import { describe, expect, it } from 'vitest'
import type { StoragePort } from '../../workspace/repository'
import { saveCurrentCollection } from '../../workspace/recordStorage'
import { openSelectedRecord } from './selectedRecord'
import { readStudyCollection, saveStudyCollection } from './studyCollection'
import { readMilestone, saveMilestone, transitionMilestone } from './subjectLedger'

class MemoryStorage implements StoragePort {
  data = new Map<string, string>()
  fail = false
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, raw: string) { if (this.fail) throw new Error('Storage full'); this.data.set(key, raw) }
}
const edit: (state: ReturnType<typeof readMilestone>) => ReturnType<typeof readMilestone> = state => transitionMilestone(state, { type: 'amend-protocol', version: state.activeProtocolVersion + 1, actor: 'protocol author', reason: 'Safety monitoring amendment verified.' })
const key = 'trialforge:subject:S-014:milestones:v1'
describe('selected subject persistence', () => {
  it('imports legacy history once and retains its original backup', () => {
    const storage = new MemoryStorage()
    const legacy = edit(readMilestone(storage))
    saveMilestone(storage, legacy)
    const backup = storage.getItem(key)
    const bound = openSelectedRecord(storage)
    expect(readMilestone(bound)).toEqual(legacy)
    saveMilestone(bound, legacy)
    expect(readStudyCollection(storage).subjects[0]?.milestone).toEqual(legacy)
    expect(storage.getItem(key)).toBe(backup)
    saveMilestone(storage, readMilestone(new MemoryStorage()))
    expect(readMilestone(openSelectedRecord(storage))).toEqual(legacy)
  })
  it('persists a domain action and preserves every unrelated record', () => {
    const storage = new MemoryStorage(), before = readStudyCollection(storage)
    const bound = openSelectedRecord(storage), changed = edit(readMilestone(bound))
    saveMilestone(bound, changed)
    const after = readStudyCollection(storage)
    expect(after.subjects[0]?.milestone).toEqual(changed)
    expect(after.subjects.slice(1)).toEqual(before.subjects.slice(1))
    expect(readMilestone(openSelectedRecord(storage))).toEqual(changed)
    expect(after.audit.at(-1)).toMatchObject({ action: 'detail-updated', id: 'S-014' })
  })
  it('rejects stale edits without replacing the newer domain state', () => {
    const storage = new MemoryStorage()
    const first = openSelectedRecord(storage), stale = openSelectedRecord(storage)
    const changed = edit(readMilestone(first))
    saveMilestone(first, changed)
    expect(() => saveMilestone(stale, edit(readMilestone(stale)))).toThrow('changed in another view')
    expect(readMilestone(openSelectedRecord(storage))).toEqual(changed)
  })
  it('merges with an unrelated record archive without losing that edit', () => {
    const storage = new MemoryStorage(), bound = openSelectedRecord(storage)
    const before = readStudyCollection(storage), peer = before.subjects[1]
    if (!peer) throw new Error('Peer fixture missing')
    const newer = { ...before, subjects: before.subjects.map(item => item.id === peer.id ? { ...item, archived: true } : item) }
    saveStudyCollection(storage, newer)
    saveMilestone(bound, edit(readMilestone(bound)))
    expect(readStudyCollection(storage).subjects[1]).toEqual(newer.subjects[1])
  })
  it('rejects missing and archived targets without writing', () => {
    const storage = new MemoryStorage()
    expect(() => openSelectedRecord(storage, 'missing')).toThrow('not found')
    expect(storage.data.size).toBe(0)
    const before = readStudyCollection(storage)
    saveStudyCollection(storage, { ...before, subjects: before.subjects.map(item => ({ ...item, archived: true })) })
    const snapshot = [...storage.data]
    expect(() => openSelectedRecord(storage)).toThrow('archived')
    expect([...storage.data]).toEqual(snapshot)
  })
  it('rejects a record archived after the editor opened', () => {
    const storage = new MemoryStorage(), bound = openSelectedRecord(storage)
    const before = readStudyCollection(storage)
    saveStudyCollection(storage, { ...before, subjects: before.subjects.map(item => ({ ...item, archived: true })) })
    expect(() => saveMilestone(bound, edit(readMilestone(bound)))).toThrow('changed in another view')
  })
  it('preserves retryability after a recoverable storage failure', () => {
    const storage = new MemoryStorage(), bound = openSelectedRecord(storage)
    const changed = edit(readMilestone(bound))
    storage.fail = true
    expect(() => saveMilestone(bound, changed)).toThrow('Storage full')
    storage.fail = false
    saveMilestone(bound, changed)
    expect(readMilestone(openSelectedRecord(storage))).toEqual(changed)
  })
  it('protects a detail edit against a stale whole-workspace save', () => {
    const storage = new MemoryStorage(), stale = readStudyCollection(storage)
    const bound = openSelectedRecord(storage)
    saveMilestone(bound, edit(readMilestone(bound)))
    expect(() => saveCurrentCollection(storage, stale, stale, readStudyCollection, saveStudyCollection)).toThrow('Workspace changed')
    expect(readStudyCollection(storage).subjects[0]?.milestone).not.toEqual(stale.subjects[0]?.milestone)
  })
})
