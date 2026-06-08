export interface StoryMeta {
  title?: string
  wordCountTarget?: number
  tags?: string[]
  notes?: string
  prompt?: string
}

export interface StoryFile {
  id: string
  path: string
  wordCount: number
  meta: StoryMeta
}

export interface Market {
  id: string
  name: string
  url?: string
  wordCountMin?: number
  wordCountMax: number
  simultaneousSubs: boolean
  responseTimeWeeks?: number
  genres: string[]
  notes?: string
  active: boolean
}

export interface Submission {
  id: string
  storyId: string
  marketId: string
  submittedAt: string
  status: 'pending' | 'withdrawn' | 'rejected' | 'accepted' | 'pending-revision'
  statusUpdatedAt: string
  notes?: string
  simultaneous: boolean
}

export interface RevisionMeta {
  id: string
  timestamp: number
  wordCount: number
}

export interface TelemetrySession {
  id: string
  storyId: string
  date: string
  startedAt: number
  endedAt: number
  wordsStart: number
  wordsEnd: number
  activeMs: number
  wpm: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export type AnalysisMode = 'compression' | 'ending' | 'tone' | 'market_fit' | 'chat' | 'none'

export interface TextAnnotation {
  id: string
  passage: string
  problem: string
  suggestion?: string
  from?: number
  to?: number
  applied?: boolean
  dismissed?: boolean
}
