import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { effectiveProtocol, protocolVersions, subject, visit, visitFindings, visitWindow } from './protocol'
export function SubjectProtocolTimelinePage() {
  const { studyId, subjectId } = useParams()
  const [appointment, setAppointment] = useState('2026-09-14')
  const [consentVersion, setConsentVersion] = useState(subject.consentVersion)
  const [withdrawn, setWithdrawn] = useState(false)
  const [recorded, setRecorded] = useState(false)
  const [notice, setNotice] = useState('')
  const person = { ...subject, consentVersion, withdrawnAt: withdrawn ? '2026-09-13' : undefined }
  const protocol = effectiveProtocol(protocolVersions, appointment)
  const findings = visitFindings(person, appointment)
  const window = protocol ? visitWindow(person, protocol) : undefined
  function record() {
    if (findings.length) { setNotice('Visit cannot be recorded while protocol findings remain.'); return }
    setRecorded(true)
    setNotice(`${visit.id} recorded against protocol v${String(protocol?.version ?? 'none')}.`)
  }
  return <div className="suite-page">
    <header className="suite-title"><div><small>STUDY / EFFECTIVE PROTOCOL</small>
      <h1>Subject protocol timeline</h1>
      <p>Study {studyId ?? 'TF-201'} · Subject {subjectId ?? person.id} · Consent v{consentVersion}</p>
    </div></header>
    <section className="suite-card" aria-label="Protocol evidence">
      <h2>Visit {visit.number}</h2>
      <p>Enrollment {person.enrolledAt} · Effective protocol v{protocol?.version ?? 'none'}</p>
      <p>Window: day 82 to 88 · {window?.opens}–{window?.closes} · blinded review</p>
      <label>Appointment date <input type="date" value={appointment} onChange={event => { setAppointment(event.target.value); setRecorded(false) }} /></label>
      <label>Consent version <select value={consentVersion} onChange={event => { setConsentVersion(Number(event.target.value)); setRecorded(false) }}>
        <option value={3}>v3</option><option value={4}>v4</option>
      </select></label>
      <label><input type="checkbox" checked={withdrawn} onChange={event => { setWithdrawn(event.target.checked); setRecorded(false) }} /> Withdrawal recorded</label>
    </section>
    <section className="suite-card" aria-label="Visit decision">
      <h2>Eligibility at appointment</h2>
      {findings.length ? <ul>{findings.map(item => <li key={item}>{item}</li>)}</ul> : <p>Protocol and consent gates pass.</p>}
      <button disabled={findings.length > 0 || recorded} onClick={record}>Record visit</button>
      <p role="status">{notice || (recorded ? 'Visit recorded.' : 'Review blinded evidence before recording.')}</p>
    </section>
  </div>
}
