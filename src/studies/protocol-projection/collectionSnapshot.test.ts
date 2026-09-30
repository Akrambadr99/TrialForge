import { describe, expect, it, vi } from 'vitest'
import { compareCollectionSnapshot, createCollectionSnapshot } from '../../workspace/collectionSnapshot'
import { collectionSnapshotAdapter as adapter } from './collectionSnapshot'
import { createSubject, seedStudyCollection } from './studyCollection'

const key = 'trialforge:study-collection:v1'
const createdAt = '2026-09-30T12:00:00.000Z'
function storage(raw: string | null = null) {
  const values = new Map<string, string>(raw === null ? [] : [[key, raw]])
  values.set('unrelated:workflow', 'preserve this value')
  return { values, getItem: (id: string) => values.get(id) ?? null,
    setItem: vi.fn((id: string, value: string) => { values.set(id, value) }) }
}
function snapshot(payload: unknown, extra: Record<string, unknown> = {}) {
  return JSON.stringify({ format: 'collection-snapshot', version: 1, product: adapter.product,
    scope: adapter.scope, createdAt, payload, ...extra })
}

describe('TrialForge primary collection snapshot adapter', () => {
  it('exports the complete primary collection, archived work and metadata without storage writes', () => {
    const collection = { ...seedStudyCollection(), sourceMetadata: { note: 'preserved evidence' } }
    const raw = JSON.stringify(collection); const port = storage(raw)
    expect(JSON.parse(createCollectionSnapshot(adapter, port, createdAt))).toEqual({
      format: 'collection-snapshot', version: 1, product: 'TrialForge', scope: 'study-collection', createdAt, payload: collection,
    })
    expect(collection.subjects.some(record => record.archived)).toBe(true)
    expect(port.values.get(key)).toBe(raw)
    expect(port.values.get('unrelated:workflow')).toBe('preserve this value')
    expect(port.setItem).not.toHaveBeenCalled()
  })

  it('reviews a seeded collection without materializing new saved data', () => {
    const port = storage()
    const result = compareCollectionSnapshot(createCollectionSnapshot(adapter, port, createdAt), adapter, port)
    expect(result.payloadChanged).toBe(false)
    expect(result.rows).toHaveLength(8)
    expect(result.rows.every(row => row.status === 'unchanged')).toBe(true)
    expect(port.values.has(key)).toBe(false)
    expect(port.setItem).not.toHaveBeenCalled()
  })

  it('includes independently keyed parent records rather than only the operational rows', () => {
    const groups = adapter.groups(seedStudyCollection())
    expect(groups.map(group => group.key)).toEqual(['subjects', 'studies'])
    expect(groups.flatMap(group => group.records).map(record => record.id)).toContain('TF-201')
    expect(groups.flatMap(group => group.records).map(record => record.id)).toContain('S-015')
  })

  it('detects nested history changes even when the operational revision is unchanged', () => {
    const seed = seedStudyCollection()
    const candidate = { ...seed, subjects: seed.subjects.map(record => record.id === 'S-015' ? {
      ...record, milestone: { ...record.milestone, history: record.milestone.history.map((event, index) =>
        index === 0 ? { ...event, source: 'Updated supporting evidence' } : event) },
    } : record) }
    const port = storage(JSON.stringify(seed))
    const result = compareCollectionSnapshot(snapshot(candidate), adapter, port)
    expect(result.rows.find(row => row.id === 'S-015')?.status).toBe('changed')
    expect(result.rows.filter(row => row.status === 'changed')).toHaveLength(1)
    expect(result.payloadChanged).toBe(true)
    expect(port.setItem).not.toHaveBeenCalled()
  })

  it('detects parent-only changes and additions with unchanged surrounding records', () => {
    const seed = seedStudyCollection(); const port = storage(JSON.stringify(seed))
    const parentOnly = { ...seed, studies: seed.studies.map(record => record.id === 'TF-201' ?
      { ...record, revision: record.revision + 1 } : record) }
    expect(compareCollectionSnapshot(snapshot(parentOnly), adapter, port).rows.find(row => row.id === 'TF-201')?.status).toBe('changed')
    const added = compareCollectionSnapshot(snapshot(createSubject(seed, 'S-018', 'TF-201')), adapter, port)
    expect(added.rows.filter(row => row.status === 'added')).toHaveLength(1)
    expect(added.rows.filter(row => row.status === 'changed')).toHaveLength(1)
    expect(port.setItem).not.toHaveBeenCalled()
  })

  it('reports audit and collection metadata differences without inventing repeating audit row identities', () => {
    const seed = seedStudyCollection(); const port = storage(JSON.stringify(seed))
    const candidate = { ...seed, audit: [
      { action: 'review-note', id: 'S-015', related: [] }, { action: 'review-note', id: 'S-015', related: [] },
    ], sourceMetadata: { reviewed: true } }
    const result = compareCollectionSnapshot(snapshot(candidate), adapter, port)
    expect(result.payloadChanged).toBe(true)
    expect(result.rows).toHaveLength(8)
    expect(result.rows.every(row => row.status === 'unchanged')).toBe(true)
    expect(port.setItem).not.toHaveBeenCalled()
  })

  it('rejects malformed nested data, duplicate identities and broken parent membership without writes', () => {
    const seed = seedStudyCollection(); const raw = JSON.stringify(seed); const port = storage(raw)
    for (const candidate of [{ ...seed, subjects: [null] }, { ...seed, subjects: [...seed.subjects, seed.subjects[0]] }, { ...seed, studies: seed.studies.map(record => ({ ...record, subjectIds: [] })) }]) {
      expect(() => compareCollectionSnapshot(snapshot(candidate), adapter, port)).toThrow()
    }
    expect(port.values.get(key)).toBe(raw)
    expect(port.setItem).not.toHaveBeenCalled()
  })

  it('rejects other products, scopes, versions and truncated text without writes', () => {
    const seed = seedStudyCollection(); const port = storage(JSON.stringify(seed))
    for (const raw of [snapshot(seed, { product: 'DifferentProduct' }), snapshot(seed, { scope: 'unrelated' }),
      snapshot(seed, { version: 99 }), '{private truncated JSON']) {
      expect(() => compareCollectionSnapshot(raw, adapter, port)).toThrow()
    }
    expect(port.setItem).not.toHaveBeenCalled()
    expect(port.values.get('unrelated:workflow')).toBe('preserve this value')
  })

  it('does not turn corrupt current storage into an apparently valid empty export', () => {
    const port = storage('{private damaged current collection')
    expect(() => createCollectionSnapshot(adapter, port, createdAt)).toThrow()
    expect(port.values.get(key)).toBe('{private damaged current collection')
    expect(port.setItem).not.toHaveBeenCalled()
  })
})
