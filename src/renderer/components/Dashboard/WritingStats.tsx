import { useEffect, useState } from 'react'
import type { TelemetrySession } from '../../types/borges'
import type { StoryFile } from '../../types/borges'

interface StoryStats {
  storyId: string
  title: string
  sessions: number
  wordsWritten: number
}

interface Stats {
  totalSessions: number
  totalWordsWritten: number
  totalWritingDays: number
  currentStreak: number
  longestStreak: number
  avgWpm: number
  bestWpm: number
  byStory: StoryStats[]
}

function computeStats(sessions: TelemetrySession[], stories: StoryFile[]): Stats {
  if (sessions.length === 0) {
    return { totalSessions: 0, totalWordsWritten: 0, totalWritingDays: 0, currentStreak: 0, longestStreak: 0, avgWpm: 0, bestWpm: 0, byStory: [] }
  }

  const titleMap = new Map(stories.map((s) => [s.id, s.meta.title || s.id]))

  const writingDaySet = new Set(sessions.map((s) => s.date))
  const writingDays = [...writingDaySet].sort()

  // Streak calculation (calendar days)
  let currentStreak = 0
  let longestStreak = 0
  let streak = 1
  const today = localDate(Date.now())
  const yesterday = localDate(Date.now() - 86_400_000)

  for (let i = 1; i < writingDays.length; i++) {
    const prev = new Date(writingDays[i - 1])
    const curr = new Date(writingDays[i])
    const diff = (curr.getTime() - prev.getTime()) / 86_400_000
    if (diff === 1) {
      streak++
    } else {
      longestStreak = Math.max(longestStreak, streak)
      streak = 1
    }
  }
  longestStreak = Math.max(longestStreak, streak)

  const lastDay = writingDays[writingDays.length - 1]
  if (lastDay === today || lastDay === yesterday) {
    // Walk back to find current streak length
    currentStreak = 1
    for (let i = writingDays.length - 2; i >= 0; i--) {
      const next = new Date(writingDays[i + 1])
      const curr = new Date(writingDays[i])
      if ((next.getTime() - curr.getTime()) / 86_400_000 === 1) {
        currentStreak++
      } else {
        break
      }
    }
  }

  const totalWordsWritten = sessions.reduce((sum, s) => sum + Math.max(0, s.wordsEnd - s.wordsStart), 0)
  const wpmSessions = sessions.filter((s) => s.wpm > 0)
  const avgWpm = wpmSessions.length > 0 ? Math.round(wpmSessions.reduce((sum, s) => sum + s.wpm, 0) / wpmSessions.length) : 0
  const bestWpm = wpmSessions.length > 0 ? Math.max(...wpmSessions.map((s) => s.wpm)) : 0

  // Per-story aggregation
  const storyMap = new Map<string, StoryStats>()
  for (const s of sessions) {
    if (!storyMap.has(s.storyId)) {
      storyMap.set(s.storyId, { storyId: s.storyId, title: titleMap.get(s.storyId) || s.storyId, sessions: 0, wordsWritten: 0 })
    }
    const entry = storyMap.get(s.storyId)!
    entry.sessions++
    entry.wordsWritten += Math.max(0, s.wordsEnd - s.wordsStart)
  }
  const byStory = [...storyMap.values()].sort((a, b) => b.wordsWritten - a.wordsWritten)

  return {
    totalSessions: sessions.length,
    totalWordsWritten,
    totalWritingDays: writingDaySet.size,
    currentStreak,
    longestStreak,
    avgWpm,
    bestWpm,
    byStory,
  }
}

function localDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface WritingStatsProps {
  stories: StoryFile[]
}

export function WritingStats({ stories }: WritingStatsProps): JSX.Element {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    window.api.readTelemetry().then((sessions) => {
      setStats(computeStats(sessions, stories))
    }).catch(() => setStats(computeStats([], stories)))
  }, [stories])

  if (!stats) return <div className="dashboard-card"><div className="dashboard-card-title">Writing stats</div><div className="dashboard-empty">Loading…</div></div>

  if (stats.totalSessions === 0) {
    return (
      <div className="dashboard-card">
        <div className="dashboard-card-title">Writing stats</div>
        <div className="dashboard-empty">No writing sessions yet. Start typing to begin tracking.</div>
      </div>
    )
  }

  return (
    <div className="dashboard-card writing-stats-card">
      <div className="dashboard-card-title">Writing stats</div>

      <div className="writing-stats-grid">
        <div className="writing-stat">
          <div className="writing-stat-value">{stats.totalWordsWritten.toLocaleString()}</div>
          <div className="writing-stat-label">words written</div>
        </div>
        <div className="writing-stat">
          <div className="writing-stat-value">{stats.totalSessions}</div>
          <div className="writing-stat-label">sessions</div>
        </div>
        <div className="writing-stat">
          <div className="writing-stat-value">{stats.currentStreak}</div>
          <div className="writing-stat-label">day streak</div>
        </div>
        <div className="writing-stat">
          <div className="writing-stat-value">{stats.longestStreak}</div>
          <div className="writing-stat-label">longest streak</div>
        </div>
        {stats.avgWpm > 0 && (
          <div className="writing-stat">
            <div className="writing-stat-value">{stats.avgWpm}</div>
            <div className="writing-stat-label">avg wpm</div>
          </div>
        )}
        {stats.bestWpm > 0 && (
          <div className="writing-stat">
            <div className="writing-stat-value">{stats.bestWpm}</div>
            <div className="writing-stat-label">best wpm</div>
          </div>
        )}
      </div>

      {stats.byStory.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          {stats.byStory.slice(0, 6).map((s) => (
            <div key={s.storyId} className="dashboard-row" style={{ cursor: 'default' }}>
              <span className="dashboard-row-title">{s.title}</span>
              <span className="dashboard-row-meta">{s.wordsWritten.toLocaleString()}w · {s.sessions} {s.sessions === 1 ? 'session' : 'sessions'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
