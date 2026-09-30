import { collectionBackPath } from '../../workspace/collectionExplorer'
import type { ReactNode } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { RecordScope } from '../../workspace/RecordScope'
import { openSelectedRecord } from './selectedRecord'

export function SelectedRecordRoute({ children }: { children: ReactNode }) {
  const [params] = useSearchParams()
  const route = useParams()
  const id = params.get('record') ?? route['subjectId'] ?? 'S-014'
  return <RecordScope id={id} back={collectionBackPath('/trial/subject-workspace', 'subject', id, params)}
    open={target => openSelectedRecord(window.localStorage, target)}>{children}</RecordScope>
}
