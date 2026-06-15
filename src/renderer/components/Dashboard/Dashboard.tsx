import { useBorgesStore } from '../../store/borgesStore'
import { PromptHero } from './PromptHero'
import { WritingStats } from './WritingStats'

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

type StoryRow =
  | { kind: 'out'; storyId: string; storyTitle: string; storyPath: string; marketName: string; days: number; overdue: boolean }
  | { kind: 'ready'; storyId: string; storyTitle: string; storyPath: string; wordCount: number }
  | { kind: 'accepted' | 'rejected'; storyId: string; storyTitle: string; storyPath: string; marketName: string }

export function Dashboard({ aiEnabled }: { aiEnabled: boolean }): JSX.Element {
  const { stories, submissions, markets, setActiveStory, markSaved, isDirty, activeStoryPath, activeStoryContent } = useBorgesStore()

  const openStory = async (path: string, id: string): Promise<void> => {
    if (isDirty && activeStoryPath) {
      await window.api.writeStory(activeStoryPath, activeStoryContent)
      await window.api.saveRevision(activeStoryPath, activeStoryContent)
      markSaved()
    }
    const content = await window.api.readStory(path)
    setActiveStory(path, id, content)
  }

  const rows: StoryRow[] = []

  // Out: stories with active pending submissions
  const pendingSubs = submissions
    .filter((s) => s.status === 'pending' || s.status === 'pending-revision')
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
  for (const sub of pendingSubs) {
    const story = stories.find((s) => s.id === sub.storyId)
    const market = markets.find((m) => m.id === sub.marketId)
    if (!story) continue
    const days = daysSince(sub.submittedAt)
    const overdue = !!(market?.responseTimeWeeks && days > market.responseTimeWeeks * 7)
    rows.push({ kind: 'out', storyId: story.id, storyTitle: story.meta.title || story.id, storyPath: story.path, marketName: market?.name ?? sub.marketId, days, overdue })
  }

  // Ready: no active pending
  const outIds = new Set(pendingSubs.map((s) => s.storyId))
  const readyStories = stories.filter((story) => {
    if (outIds.has(story.id)) return false
    const storySubs = submissions.filter((s) => s.storyId === story.id)
    if (storySubs.length === 0) return true
    const last = storySubs.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0]
    return last.status === 'rejected' || last.status === 'withdrawn'
  })
  for (const story of readyStories) {
    rows.push({ kind: 'ready', storyId: story.id, storyTitle: story.meta.title || story.id, storyPath: story.path, wordCount: story.wordCount })
  }

  // Recent activity
  const recentSubs = submissions
    .filter((s) => s.status === 'accepted' || s.status === 'rejected')
    .sort((a, b) => b.statusUpdatedAt.localeCompare(a.statusUpdatedAt))
    .slice(0, 8)
  for (const sub of recentSubs) {
    const story = stories.find((s) => s.id === sub.storyId)
    const market = markets.find((m) => m.id === sub.marketId)
    if (!story) continue
    rows.push({ kind: sub.status as 'accepted' | 'rejected', storyId: story.id, storyTitle: story.meta.title || story.id, storyPath: story.path, marketName: market?.name ?? sub.marketId })
  }

  const totalWords = stories.reduce((s, story) => s + story.wordCount, 0)

  return (
    <div className="dashboard">
      {aiEnabled && <PromptHero />}
      <div className="dashboard-greeting">
        {stories.length === 0
          ? 'Welcome to Borges. Create your first story to get started.'
          : `${stories.length} ${stories.length === 1 ? 'story' : 'stories'} · ${totalWords.toLocaleString()} words total`}
      </div>

      <div className="dashboard-grid">
        {/* Stories — all statuses in one card */}
        <div className="dashboard-card">
          <div className="dashboard-card-title">Stories</div>
          {rows.length === 0 && <div className="dashboard-empty">No stories yet.</div>}
          {rows.map((row, i) => (
            <div key={i} className="dashboard-row" onClick={() => openStory(row.storyPath, row.storyId)}>
              <span className="dashboard-row-title">{row.storyTitle}</span>
              {row.kind === 'out' && (
                <>
                  <span className="dashboard-row-meta" style={{ color: 'var(--text2)' }}>{row.marketName}</span>
                  <span className={row.overdue ? 'dashboard-row-flag' : 'dashboard-row-meta'}>{row.days}d{row.overdue ? ' ⚠' : ''}</span>
                  <span className="dashboard-status-badge dashboard-status-out">out</span>
                </>
              )}
              {row.kind === 'ready' && (
                <>
                  <span className="dashboard-row-meta">{row.wordCount.toLocaleString()}w</span>
                  <span className="dashboard-status-badge dashboard-status-ready">ready</span>
                </>
              )}
              {row.kind === 'accepted' && (
                <>
                  <span className="dashboard-row-meta" style={{ color: 'var(--text2)' }}>{row.marketName}</span>
                  <span className="dashboard-status-badge dashboard-status-accepted">accepted</span>
                </>
              )}
              {row.kind === 'rejected' && (
                <>
                  <span className="dashboard-row-meta" style={{ color: 'var(--text3)' }}>{row.marketName}</span>
                  <span className="dashboard-status-badge dashboard-status-rejected">rejected</span>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Writing stats */}
        <WritingStats stories={stories} />
      </div>
    </div>
  )
}
