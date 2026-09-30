import { recordDetailPath, recordDecisionPath } from './recordLinks'
import { Link } from 'react-router-dom'
import { saveCurrentCollection } from '../../workspace/recordStorage'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { protocolReviewers } from './protocolWorkload'
import { amendStudy, archiveSubject, claimSubjectReview, createSubject, readStudyCollection,
  requestSubjectReviews, saveStudyCollection, subjectInbox, subjectRows } from './studyCollection'

export function StudyCollectionPage() {
  const [collection, setCollection] = useState(() => readStudyCollection(window.localStorage))
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('active')
  const [reviewer, setReviewer] = useState('med-elaine'); const [checked, setChecked] = useState<string[]>([])
  const [newId, setNewId] = useState(''); const [notice, setNotice] = useState('')
  const selectedId = params.get('subject') ?? 'S-015'
  const selected = collection.subjects.find(item => item.id === selectedId)
  function choose(id: string) { setParams(current => { const next = new URLSearchParams(current); next.set('subject', id); return next }) }
  function persist(next: typeof collection, message: string) { try { setCollection(saveCurrentCollection(window.localStorage, collection, next, readStudyCollection, saveStudyCollection)); setNotice(message); return true } catch (error) { setNotice(error instanceof Error ? error.message : 'Save failed. Your input is preserved.'); return false } }
  function run(action: () => typeof collection, success: string) {
    try { return persist(action(), success) } catch (error) { setNotice(error instanceof Error ? error.message : 'Study operation failed.'); return false }
  }
  return <main className="suite-page"><header className="suite-title"><div><small>STUDIES / PROTOCOL RESPONSIBILITY</small>
    <h1>Subject protocol workspace</h1><p>Independent subject milestones connected to study-wide amendments and medical review.</p></div></header>
    <section className="metrics" aria-label="Study summary">
      <article><small>Active subjects</small><strong>{collection.subjects.filter(item => !item.archived).length}</strong></article>
      <article><small>Medical reviews</small><strong>{subjectInbox(collection).length}</strong></article>
      <article><small>Studies</small><strong>{collection.studies.length}</strong></article>
    </section>
    <section className="suite-card" aria-label="Medical review queue"><h2>Medical review queue</h2>
      {subjectInbox(collection).length ? <ul>{subjectInbox(collection).map(item => <li key={item.subjectId + item.requestId}>
        <button onClick={() => { choose(item.subjectId) }}>{item.subjectId}</button> · {item.studyId} · protocol v{item.protocolVersion} ·
        {item.assigneeId ?? 'team queue'} · {item.actionable ? 'actionable' : 'stale'}</li>)}</ul> : <p>No open medical reviews.</p>}
      <label>Medical reviewer <select value={reviewer} onChange={event => { setReviewer(event.target.value) }}>
        {protocolReviewers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    </section>
    <section className="suite-card" aria-label="Subject collection"><h2>Subjects</h2>
      <label>Search subjects <input value={query} onChange={event => { setQuery(event.target.value) }} /></label>
      <label>Show <select value={filter} onChange={event => { setFilter(event.target.value) }}><option value="active">Active</option>
        <option value="archived">Archived</option><option value="all">All</option></select></label>
      {subjectRows(collection, query, filter).length ? <ul>{subjectRows(collection, query, filter).map(record => <li key={record.id}>
        <label><input type="checkbox" checked={checked.includes(record.id)} onChange={event => {
          setChecked(current => event.target.checked ? [...current, record.id] : current.filter(id => id !== record.id))
        }} /> Select {record.id}</label>
        <button aria-current={selectedId === record.id ? 'true' : undefined} onClick={() => { choose(record.id) }}>
          {record.id} · {record.studyId}</button> · milestone r{record.milestone.revision} · active v{record.milestone.activeProtocolVersion}
        {record.archived ? ' · archived' : ''}</li>)}</ul> : <p>No subjects match this view.</p>}
      <button disabled={!checked.length} onClick={() => { const result = requestSubjectReviews(collection, checked)
        persist(result.collection, `${String(result.updated.length)} requested; ${String(result.skipped.length)} skipped; ${String(result.blocked.length)} blocked.`)
      }}>Request selected medical reviews</button>
      <form onSubmit={event => { event.preventDefault(); if (run(() => createSubject(collection, newId, 'TF-201'), 'Subject created.')) setNewId('') }}>
        <label>New subject ID <input value={newId} onChange={event => { setNewId(event.target.value) }} required pattern="S-[0-9]{3}" /></label>
        <button type="submit">Add TF-201 subject</button></form>
    </section>
    <section className="suite-card" aria-label="Selected subject"><h2>{selected?.id ?? 'Select a subject'}</h2>{selected && <>
      <p>{selected.studyId} · milestone r{selected.milestone.revision} · protocol v{selected.milestone.activeProtocolVersion}</p>
      <p>Visit {selected.milestone.visitAt ?? 'not recorded'} · certified v{selected.milestone.certifiedProtocolVersion} ·
        reviewer {selected.milestone.medicalReviews?.find(item => item.status === 'open')?.assigneeId ?? 'unclaimed'}</p>
      <button onClick={() => { run(() => claimSubjectReview(collection, selected.id, reviewer, selected.milestone.revision), 'Medical review claimed.') }}>Claim selected medical review</button>
      <button onClick={() => { const study = collection.studies.find(item => item.id === selected.studyId)
        if (!study) return
        try { const result = amendStudy(collection, study.id, study.revision)
          persist(result.collection, `${String(result.updated.length)} related subjects amended; ${String(result.blocked.length)} blocked.`)
        } catch (error) { setNotice(error instanceof Error ? error.message : 'Study amendment failed.') }
      }}>Amend linked study protocol</button>
      <button onClick={() => { run(() => archiveSubject(collection, selected.id), 'Subject archived.') }}>Archive subject</button>
      <details><summary>Milestone history</summary><ol>{selected.milestone.history.map(item =>
        <li key={item.revision}>{item.action} · r{item.revision} · {item.source}</li>)}</ol></details>
    </>}</section>
    <section className="suite-card" aria-label="Study audit"><h2>Collection audit</h2><ol>{collection.audit.toReversed().slice(0, 8).map((item, index) =>
      <li key={index}>{item.action} · {item.id} · {item.related.join(', ') || 'none'}</li>)}</ol></section>
    <nav aria-label="Selected record workflows">{selected && !selected.archived && <><Link to={recordDetailPath(selected)}>Open record details</Link>{' · '}<Link to={recordDecisionPath(selected)}>Open decision workflow</Link></>} <button onClick={() => { try { setCollection(readStudyCollection(window.localStorage)); setNotice('Workspace refreshed; selection preserved.') } catch (error) { setNotice(error instanceof Error ? error.message : 'Refresh failed.') } }}>Refresh workspace</button></nav>
    <p role="status">{notice}</p>
  </main>
}
