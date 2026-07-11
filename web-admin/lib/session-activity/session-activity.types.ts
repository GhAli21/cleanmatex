/**
 * Session Activity — client-side UX recovery log types.
 * Not an audit trail; browser-session scoped only.
 */

export type SessionActivityMessageType = 'error' | 'warning' | 'info'

export type SessionActivityDisplayMethod = 'toast' | 'alert'

export interface SessionActivityEntry {
  id: string
  type: SessionActivityMessageType
  title: string
  description?: string
  method: SessionActivityDisplayMethod
  route: string
  source?: string
  createdAt: string
  read: boolean
}

export interface SessionActivityState {
  entries: SessionActivityEntry[]
}

export interface RecordSessionMessageInput {
  type: string
  title: string
  description?: string
  method?: string
  source?: string
  skipSessionLog?: boolean
  forceSessionLog?: boolean
}

export type SessionActivityListener = () => void
