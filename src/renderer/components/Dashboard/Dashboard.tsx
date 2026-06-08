import { useBorgesStore } from '../../store/borgesStore'

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

export function Dashboard(): JSX.Element {
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

  // Stories ready to submit: no active pending, never submitted or last status rejected
  const readyToSubmit = stories.filter((story) => {
    const storySubs = submissions.filter((s) => s.storyId === story.id)
    const hasActive = storySubs.some((s) => s.status === 'pending' || s.status === 'pending-revision')
    if (hasActive) return false
    if (storySubs.length === 0) return true
    const last = storySubs.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0]
    return last.status === 'rejected' || last.status === 'withdrawn'
  })

  // Pending submissions
  const pending = submissions
    .filter((s) => s.status === 'pending' || s.status === 'pending-revision')
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))

  // Recent activity (last 10 non-pending changes)
  const recent = submissions
    .filter((s) => s.status === 'accepted' || s.status === 'rejected')
    .sort((a, b) => b.statusUpdatedAt.localeCompare(a.statusUpdatedAt))
    .slice(0, 10)

  const totalWords = stories.reduce((s, story) => s + story.wordCount, 0)

  return (
    <div className="dashboard">
      <div className="dashboard-greeting">
        {stories.length === 0
          ? 'Welcome to Borges. Create your first story to get started.'
          : `${stories.length} ${stories.length === 1 ? 'story' : 'stories'} · ${totalWords.toLocaleString()} words total`}
      </div>

      <div className="dashboard-grid">
        {/* Ready to submit */}
        <div className="dashboard-card">
          <div className="dashboard-card-title">Ready to submit ({readyToSubmit.length})</div>
          {readyToSubmit.length === 0 && <div className="dashboard-empty">All stories are out or in progress.</div>}
          {readyToSubmit.slice(0, 8).map((story) => (
            <div key={story.id} className="dashboard-row" onClick={() => openStory(story.path, story.id)}>
              <span className="dashboard-row-title">{story.meta.title || story.id}</span>
              <span className="dashboard-row-meta">{story.wordCount.toLocaleString()}w</span>
            </div>
          ))}
        </div>

        {/* Pending submissions */}
        <div className="dashboard-card">
          <div className="dashboard-card-title">Out ({pending.length})</div>
          {pending.length === 0 && <div className="dashboard-empty">Nothing currently submitted.</div>}
          {pending.map((sub) => {
            const story = stories.find((s) => s.id === sub.storyId)
            const market = markets.find((m) => m.id === sub.marketId)
            const days = daysSince(sub.submittedAt)
            const isOverdue = market?.responseTimeWeeks && days > market.responseTimeWeeks * 7
            return (
              <div key={sub.id} className="dashboard-row" onClick={() => story && openStory(story.path, story.id)}>
                <span className="dashboard-row-title">{story?.meta.title || sub.storyId} → {market?.name ?? sub.marketId}</span>
                <span className={`dashboard-row-meta${isOverdue ? ' dashboard-row-flag' : ''}`}>{days}d{isOverdue ? ' ⚠' : ''}</span>
              </div>
            )
          })}
        </div>

        {/* Recent activity */}
        <div className="dashboard-card">
          <div className="dashboard-card-title">Recent activity</div>
          {recent.length === 0 && <div className="dashboard-empty">No acceptances or rejections yet.</div>}
          {recent.map((sub) => {
            const story = stories.find((s) => s.id === sub.storyId)
            const market = markets.find((m) => m.id === sub.marketId)
            return (
              <div key={sub.id} className="dashboard-row" onClick={() => story && openStory(story.path, story.id)}>
                <span className="dashboard-row-title">{story?.meta.title || sub.storyId}</span>
                <span className={`dashboard-row-meta`} style={{ color: sub.status === 'accepted' ? 'var(--success)' : 'var(--text3)' }}>
                  {sub.status === 'accepted' ? '✓' : '✗'} {market?.name ?? sub.marketId}
                </span>
              </div>
            )
          })}
        </div>

        {/* Word count overview */}
        <div className="dashboard-card">
          <div className="dashboard-card-title">Word counts</div>
          {stories.length === 0 && <div className="dashboard-empty">No stories yet.</div>}
          {[...stories].sort((a, b) => b.wordCount - a.wordCount).slice(0, 10).map((story) => {
            const target = story.meta.wordCountTarget
            return (
              <div key={story.id} className="dashboard-row" onClick={() => openStory(story.path, story.id)}>
                <span className="dashboard-row-title">{story.meta.title || story.id}</span>
                <span className="dashboard-row-meta">
                  {story.wordCount.toLocaleString()}{target ? `/${target.toLocaleString()}` : ''}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
