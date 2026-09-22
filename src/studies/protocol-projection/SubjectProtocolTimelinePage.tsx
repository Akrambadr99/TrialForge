import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { effectiveProtocol, protocolVersions, subject, visit, visitFindings, visitWindow } from './protocol'
import { amendmentReviewPolicy, commitMilestone, medicalReviewInbox, readMilestone, requestMedicalReview, saveMilestone } from './subjectLedger'
import { claimMedicalReview, protocolInbox, protocolReviewers, releaseMedicalClaim } from './protocolWorkload'
export function SubjectProtocolTimelinePage() {
  const { studyId, subjectId } = useParams()
  const [appointment, setAppointment] = useState('2026-09-14')
  const [consentVersion, setConsentVersion] = useState(subject.consentVersion)
  const [withdrawn, setWithdrawn] = useState(false)
  const [milestone, setMilestone] = useState(() => readMilestone(window.localStorage))
  const [notice, setNotice] = useState('')
  const [actor, setActor] = useState('protocol author')
  const [reviewerId, setReviewerId] = useState('med-elaine')
  const review = amendmentReviewPolicy(milestone, actor)
  const person = { ...subject, consentVersion, withdrawnAt: withdrawn ? '2026-09-13' : undefined }
  const protocol = effectiveProtocol(protocolVersions, appointment)
  const findings = visitFindings(person, appointment)
  const eligibilityWindow = protocol ? visitWindow(person, protocol) : undefined
  function record() {
    if (findings.length) { setNotice('Visit cannot be recorded while protocol findings remain.'); return }
    setMilestone(commitMilestone(window.localStorage, { type: 'record-visit', date: appointment, protocolVersion: protocol?.version ?? 0, findings }))
    setNotice(`${visit.id} recorded against protocol v${String(protocol?.version ?? 'none')}.`)
  }
  function reopen() {
    try { setMilestone(commitMilestone(window.localStorage, { type: 'reopen-visit' })); setNotice('Visit 6 reopened for review.') }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Reopen failed.') }
  }
  function amend() {
    try { setMilestone(commitMilestone(window.localStorage, { type: 'amend-protocol', version: milestone.activeProtocolVersion + 1, reason: 'Study amendment changes visit review requirements.', actor })); setNotice('Protocol amended; independent certification required.') }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Amendment failed.') }
  }
  function certify() {
    try { setMilestone(commitMilestone(window.localStorage, { type: 'certify-amendment', actor, reviewerId, reason: 'Independent medical review confirms current protocol.' })); setNotice('Current protocol independently certified.') }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Certification failed.') }
  }
  function claim() {
    try {
      const current = readMilestone(window.localStorage)
      const next = claimMedicalReview(current, studyId ?? 'TF-201', reviewerId,
        [{ subjectId: subjectId ?? 'S-014', studyId: studyId ?? 'TF-201', milestone: current }], current.revision)
      setMilestone(saveMilestone(window.localStorage, next))
      setNotice('Medical review claimed by ' + reviewerId + '.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Claim failed.') }
  }
  function releaseClaim() {
    try { setMilestone(saveMilestone(window.localStorage, releaseMedicalClaim(readMilestone(window.localStorage), reviewerId))); setNotice('Medical review returned to team queue.') }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Claim release failed.') }
  }
  function handoff() {
    try {
      const next = saveMilestone(window.localStorage, requestMedicalReview(milestone, actor))
      setMilestone(next)
      setNotice('Medical review request assigned.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Review request failed.') }
  }
  function revalidate() {
    try { setMilestone(commitMilestone(window.localStorage, { type: 'revalidate-visit', reason: 'Recorded evidence reviewed under active protocol.', actor })); setNotice('Visit evidence revalidated.') }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Revalidation failed.') }
  }
  return <div className="suite-page">
    <header className="suite-title"><div><small>STUDY / EFFECTIVE PROTOCOL</small>
      <h1>Subject protocol timeline</h1>
      <p>Study {studyId ?? 'TF-201'} · Subject {subjectId ?? person.id} · Consent v{consentVersion}</p>
    </div></header>
    <section className="suite-card" aria-label="Protocol evidence">
      <h2>Visit {visit.number}</h2>
      <p>Enrollment {person.enrolledAt} · Effective protocol v{protocol?.version ?? 'none'}</p>
      <p>Window: day 82 to 88 · {eligibilityWindow?.opens}–{eligibilityWindow?.closes} · blinded review</p>
      <label>Appointment date <input type="date" value={appointment} onChange={event => { setAppointment(event.target.value) }} /></label>
      <label>Consent version <select value={consentVersion} onChange={event => { setConsentVersion(Number(event.target.value)) }}>
        <option value={3}>v3</option><option value={4}>v4</option>
      </select></label>
      <label><input type="checkbox" checked={withdrawn} onChange={event => { setWithdrawn(event.target.checked) }} /> Withdrawal recorded</label>
    </section>
    <section className="suite-card" aria-label="Visit decision">
      <h2>Eligibility at appointment</h2>
      {findings.length ? <ul>{findings.map(item => <li key={item}>{item}</li>)}</ul> : <p>Protocol and consent gates pass.</p>}
      <button disabled={findings.length > 0 || Boolean(milestone.visitAt)} onClick={record}>Record visit</button>
      {milestone.visitAt && <button onClick={reopen}>Reopen Visit 6</button>}
      <p>Visit record: {milestone.visitAt ?? 'pending'} · Revision {milestone.revision}</p>
      <p>Active protocol v{milestone.activeProtocolVersion}</p>
      <p>Certified protocol v{milestone.certifiedProtocolVersion} · Review queue: {review.queue}</p>
      <label>Protocol actor <select value={actor} onChange={event => { setActor(event.target.value) }}><option>protocol author</option><option>medical reviewer</option></select></label>
      <label>Named medical reviewer <select value={reviewerId} onChange={event => { setReviewerId(event.target.value) }}>
        {protocolReviewers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      {milestone.visitAt && <button onClick={amend}>Record protocol amendment</button>}
      {milestone.certifiedProtocolVersion !== milestone.activeProtocolVersion && <button onClick={handoff}>Request medical review</button>}
      {milestone.medicalReviews?.some(item => item.status === 'open' && !item.assigneeId) && <button onClick={claim}>Claim medical review</button>}
      {milestone.medicalReviews?.some(item => item.status === 'open' && item.assigneeId === reviewerId) && <button onClick={releaseClaim}>Release claim</button>}
      {milestone.certifiedProtocolVersion !== milestone.activeProtocolVersion && <button disabled={!review.allowed} onClick={certify}>Certify amendment</button>}
      {(milestone.medicalReviews ?? []).length > 0 && <div aria-label="Medical review inbox">
        <h3>Protocol review requests</h3>
        {(milestone.medicalReviews ?? []).map(item => <p key={item.id}>{item.id} · {item.assignee} · {item.status} · protocol v{item.protocolVersion}</p>)}
        <p>{medicalReviewInbox(milestone, actor).length} assigned to current actor</p>
        <p>{protocolInbox([{ subjectId: subjectId ?? 'S-014', studyId: studyId ?? 'TF-201', milestone }], reviewerId).length} named work item(s)</p>
      </div>}
      {milestone.visitAt && milestone.protocolVersion !== milestone.activeProtocolVersion && <button disabled={milestone.certifiedProtocolVersion !== milestone.activeProtocolVersion || actor !== 'medical reviewer'} onClick={revalidate}>Revalidate Visit 6</button>}
      {milestone.certifiedProtocolVersion !== milestone.activeProtocolVersion && review.blockers.map(item => <p key={item}>{item}</p>)}
      <p role="status">{notice || (milestone.visitAt ? 'Visit recorded.' : 'Review blinded evidence before recording.')}</p>
    </section>
  </div>
}
