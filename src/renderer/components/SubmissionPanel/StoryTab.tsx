import { useState } from 'react'
import { useBorgesStore } from '../../store/borgesStore'
import type { Submission } from '../../types/borges'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}


export function StoryTab(): JSX.Element {
  const { activeStoryId, submissions, setSubmissions, markets } = useBorgesStore()
  const [showPicker, setShowPicker] = useState(false)
  const [marketFilter, setMarketFilter] = useState('')
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesValue, setNotesValue] = useState('')

  if (!activeStoryId) {
    return <div style={{ color: 'var(--text3)', fontSize: '13px', padding: '8px 0' }}>Open a story to see submissions.</div>
  }

  const storySubmissions = submissions
    .filter((s) => s.storyId === activeStoryId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))

  const pendingElsewhere = storySubmissions.filter((s) => s.status === 'pending')
  const activeSubs = storySubmissions.filter((s) => s.status === 'pending' || s.status === 'pending-revision')

  const simSubWarning = (marketId: string): string | null => {
    const market = markets.find((m) => m.id === marketId)
    if (!market) return null
    if (!market.simultaneousSubs && activeSubs.length > 0) {
      return `${market.name} does not allow simultaneous submissions. This story is already out elsewhere.`
    }
    if (activeSubs.length > 0) {
      const nonSimMarkets = activeSubs.map((s) => markets.find((m) => m.id === s.marketId)).filter((m) => m && !m.simultaneousSubs)
      if (nonSimMarkets.length > 0) {
        return `${nonSimMarkets[0]?.name} (pending) does not allow simultaneous submissions.`
      }
    }
    return null
  }

  const submitTo = async (marketId: string): Promise<void> => {
    const market = markets.find((m) => m.id === marketId)
    if (!market) return
    const now = new Date().toISOString()
    const sub: Submission = {
      id: `sub-${Date.now()}`,
      storyId: activeStoryId,
      marketId,
      submittedAt: now,
      status: 'pending',
      statusUpdatedAt: now,
      simultaneous: activeSubs.length > 0
    }
    await window.api.addSubmission(sub)
    const refreshed = await window.api.listSubmissions()
    setSubmissions(refreshed)
    setShowPicker(false)
  }

  const updateStatus = async (id: string, status: Submission['status']): Promise<void> => {
    await window.api.updateSubmission(id, { status, statusUpdatedAt: new Date().toISOString() })
    const refreshed = await window.api.listSubmissions()
    setSubmissions(refreshed)
  }

  const saveNotes = async (id: string, notes: string): Promise<void> => {
    await window.api.updateSubmission(id, { notes })
    const refreshed = await window.api.listSubmissions()
    setSubmissions(refreshed)
    setEditingNotes(null)
  }

  const filteredMarkets = markets.filter((m) => m.active && m.name.toLowerCase().includes(marketFilter.toLowerCase()))

  return (
    <div>
      {activeSubs.length === 0 && pendingElsewhere.length === 0 && (
        <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '10px' }}>
          No active submissions.
        </div>
      )}

      <button className="sub-btn" onClick={() => setShowPicker(true)} disabled={markets.filter((m) => m.active).length === 0}>
        Submit to market…
      </button>

      {storySubmissions.length > 0 && (
        <>
          <div className="sub-list-title">Submission history</div>
          {storySubmissions.map((sub) => {
            const market = markets.find((m) => m.id === sub.marketId)
            return (
              <div key={sub.id} className="sub-item">
                <div className="sub-item-header">
                  <span className="sub-item-market">{market?.name ?? sub.marketId}</span>
                  <span className="sub-item-date">{formatDate(sub.submittedAt)}</span>
                </div>
                <div className="sub-item-status">
                  <select
                    value={sub.status}
                    onChange={(e) => updateStatus(sub.id, e.target.value as Submission['status'])}
                  >
                    <option value="pending">Pending</option>
                    <option value="pending-revision">Pending revision</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                    <option value="withdrawn">Withdrawn</option>
                  </select>
                </div>
                {editingNotes === sub.id ? (
                  <div className="sub-item-notes">
                    <textarea
                      autoFocus
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.target.value)}
                      onBlur={() => saveNotes(sub.id, notesValue)}
                      onKeyDown={(e) => { if (e.key === 'Escape') setEditingNotes(null) }}
                      placeholder="Editor feedback, notes…"
                    />
                  </div>
                ) : (
                  <div
                    style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text3)', cursor: 'pointer' }}
                    onClick={() => { setEditingNotes(sub.id); setNotesValue(sub.notes ?? '') }}
                  >
                    {sub.notes ? sub.notes : '+ add note'}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {showPicker && (
        <div className="modal-overlay" onClick={() => setShowPicker(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Submit to market</div>
            <div className="modal-search">
              <input
                autoFocus
                type="text"
                placeholder="Search markets…"
                value={marketFilter}
                onChange={(e) => setMarketFilter(e.target.value)}
              />
            </div>
            <div className="modal-list">
              {filteredMarkets.length === 0 && (
                <div style={{ color: 'var(--text3)', fontSize: '13px' }}>No markets. Add some in the Markets tab.</div>
              )}
              {filteredMarkets.map((market) => {
                const warn = simSubWarning(market.id)
                return (
                  <button key={market.id} className="modal-market-btn" onClick={() => submitTo(market.id)}>
                    <div className="modal-market-btn-name">{market.name}</div>
                    <div className="modal-market-btn-wc">{market.wordCountMin ? `${market.wordCountMin}–` : 'up to '}{market.wordCountMax} words · {market.simultaneousSubs ? 'sim-subs ok' : 'no sim-subs'}</div>
                    {warn && <div style={{ fontSize: '11px', color: 'var(--warn)', marginTop: '3px' }}>⚠ {warn}</div>}
                  </button>
                )
              })}
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowPicker(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
