import type { ExplorerPolicy } from '../../workspace/collectionExplorer'
import type { SubjectRecord } from './studyCollection'

export const subjectTriage: ExplorerPolicy<SubjectRecord> = {
  searchText: record => `${record.id} ${record.studyId}`,
  revision: record => record.milestone.revision,
  state(record) {
    const milestone = record.milestone
    const requests = milestone.medicalReviews ?? []
    const current = requests.find(item => item.status === 'open' && item.sourceRevision === milestone.revision &&
      item.protocolVersion === milestone.activeProtocolVersion)
    if (current) return current.assigneeId ? 'claimed' : 'unclaimed'
    if (requests.some(item => item.status === 'stale' || item.status === 'open')) return 'stale'
    if (milestone.certifiedProtocolVersion !== milestone.activeProtocolVersion) return 'needs-review'
    if (milestone.visitAt && milestone.protocolVersion !== milestone.activeProtocolVersion) return 'revalidate'
    return 'current'
  },
  states: [
    { value: 'unclaimed', label: 'Current review · unclaimed' },
    { value: 'claimed', label: 'Current review · claimed' },
    { value: 'stale', label: 'Stale medical review' },
    { value: 'needs-review', label: 'Protocol needs review' },
    { value: 'revalidate', label: 'Visit needs revalidation' },
    { value: 'current', label: 'Protocol current' },
  ],
}
