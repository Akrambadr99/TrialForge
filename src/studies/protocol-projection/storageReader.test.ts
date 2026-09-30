import { describe, expect, it } from 'vitest'
import type { StorageReader } from '../../platform/storage-port'
import { collectionSignature, compareCollectionSnapshot, createCollectionSnapshot } from '../../workspace/collectionSnapshot'
import { StoredDataError } from '../../workspace/storageValidation'
import { collectionSnapshotAdapter as adapter } from './collectionSnapshot'
import { activeRecordWork, selectedRecordWork } from './recordWork'
import { initialMilestone, transitionMilestone } from './subjectLedger'

describe('TrialForge read-only collection capability', () => {
  const empty: StorageReader = Object.freeze({ getItem: () => null })

  it('exports and compares first-open seed projections using only getItem', () => {
    const raw = createCollectionSnapshot(adapter, empty, '2026-09-30T12:00:00.000Z')
    const result = compareCollectionSnapshot(raw, adapter, empty)
    expect(result.payloadChanged).toBe(false)
    expect(result.counts.unchanged).toBeGreaterThan(0)
    expect(result.counts.added + result.counts.changed + result.counts.removed).toBe(0)
    expect(result.currentSignature).toBe(collectionSignature(adapter, empty))
    expect(activeRecordWork(empty).length).toBeGreaterThan(0)
    expect(selectedRecordWork(empty, 'S-014')).toEqual(activeRecordWork(empty).find(record => record.subjectId === 'S-014'))
  })

  it('projects existing legacy history without materializing or replacing saved records', () => {
    const legacy = transitionMilestone(initialMilestone, { type: 'record-visit', date: '2026-09-15', protocolVersion: 4, findings: [] })
    expect(legacy.history.length).toBeGreaterThan(0)
    const saved = JSON.stringify(legacy)
    const reader: StorageReader = Object.freeze({ getItem: (key: string) => key === 'trialforge:subject:S-014:milestones:v1' ? saved : null })
    const projected = adapter.read(reader)
    expect(projected.subjects.find(record => record.id === 'S-014')?.milestone).toEqual(legacy)
    const raw = createCollectionSnapshot(adapter, reader)
    expect(compareCollectionSnapshot(raw, adapter, reader).payloadChanged).toBe(false)
    expect(reader.getItem('trialforge:study-collection:v1')).toBeNull()
    expect(reader.getItem('trialforge:subject:S-014:milestones:v1')).toBe(saved)
    expect('setItem' in reader).toBe(false)
  })

  it('preserves persisted domain data and history through a getItem-only store', () => {
    const saved = JSON.stringify(adapter.read(empty))
    const reader: StorageReader = Object.freeze({ getItem: (key: string) => key === 'trialforge:study-collection:v1' ? saved : null })
    const raw = createCollectionSnapshot(adapter, reader)
    expect(compareCollectionSnapshot(raw, adapter, reader).payloadChanged).toBe(false)
    expect(JSON.stringify(adapter.read(reader))).toBe(saved)
    expect('setItem' in reader).toBe(false)
  })

  it('reports read failures without exposing provider details', () => {
    const reader: StorageReader = { getItem: () => { throw new Error('private-provider-detail') } }
    expect(() => createCollectionSnapshot(adapter, reader)).toThrow(StoredDataError)
    expect(() => collectionSignature(adapter, reader)).toThrow('Browser storage could not be read')
    const compare = () => compareCollectionSnapshot(createCollectionSnapshot(adapter, empty), adapter, reader)
    expect(compare).toThrow(StoredDataError)
    expect(compare).not.toThrow('private-provider-detail')
  })

  it('refuses malformed saved records instead of replacing them with seeds', () => {
    const reader: StorageReader = Object.freeze({ getItem: () => '{broken-json' })
    expect(() => createCollectionSnapshot(adapter, reader)).toThrow(StoredDataError)
    expect(() => compareCollectionSnapshot(createCollectionSnapshot(adapter, empty), adapter, reader)).toThrow(StoredDataError)
    expect(reader.getItem('trialforge:study-collection:v1')).toBe('{broken-json')
  })
})
