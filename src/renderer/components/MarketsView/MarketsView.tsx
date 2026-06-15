import { useState } from 'react'
import { useBorgesStore } from '../../store/borgesStore'
import type { Market } from '../../types/borges'

const EMPTY_MARKET: Omit<Market, 'id'> = {
  name: '',
  url: '',
  wordCountMax: 1000,
  wordCountMin: undefined,
  simultaneousSubs: false,
  responseTimeWeeks: undefined,
  genres: [],
  notes: '',
  active: true
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

interface MarketFormProps {
  market: Market
  isNew: boolean
  onSave: (m: Market) => void
  onCancel: () => void
  onDelete?: () => void
}

function MarketForm({ market, isNew, onSave, onCancel, onDelete }: MarketFormProps): JSX.Element {
  const [form, setForm] = useState<Market>({ ...market })
  const [genresRaw, setGenresRaw] = useState<string>(market.genres.join(', '))
  const update = <K extends keyof Market>(key: K, value: Market[K]): void => setForm((f) => ({ ...f, [key]: value }))

  const handleSave = (): void => {
    if (!form.name.trim()) return
    const id = form.id || slug(form.name)
    onSave({ ...form, id })
  }

  return (
    <div className="mv-form market-form">
      <div className="mv-form-title market-form-title">{isNew ? 'Add market' : 'Edit market'}</div>
      <div className="form-field">
        <label className="form-label">Name *</label>
        <input value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Smokelong Quarterly" />
      </div>
      <div className="form-field">
        <label className="form-label">Submission URL</label>
        <input value={form.url ?? ''} onChange={(e) => update('url', e.target.value)} placeholder="https://…" />
      </div>
      <div className="form-row">
        <div className="form-field">
          <label className="form-label">Min words</label>
          <input type="number" value={form.wordCountMin ?? ''} onChange={(e) => update('wordCountMin', e.target.value ? parseInt(e.target.value) : undefined)} placeholder="0" />
        </div>
        <div className="form-field">
          <label className="form-label">Max words *</label>
          <input type="number" value={form.wordCountMax} onChange={(e) => update('wordCountMax', parseInt(e.target.value) || 1000)} />
        </div>
      </div>
      <div className="form-row">
        <div className="form-field">
          <label className="form-label">Response (weeks)</label>
          <input type="number" value={form.responseTimeWeeks ?? ''} onChange={(e) => update('responseTimeWeeks', e.target.value ? parseInt(e.target.value) : undefined)} />
        </div>
        <div className="form-field">
          <label className="form-label">Sim-subs</label>
          <select value={form.simultaneousSubs ? 'yes' : 'no'} onChange={(e) => update('simultaneousSubs', e.target.value === 'yes')}>
            <option value="yes">Allowed</option>
            <option value="no">Not allowed</option>
          </select>
        </div>
      </div>
      <div className="form-field">
        <label className="form-label">Genres (comma-separated)</label>
        <input
          value={genresRaw}
          onChange={(e) => setGenresRaw(e.target.value)}
          onBlur={(e) => update('genres', e.target.value.split(',').map((g) => g.trim()).filter(Boolean))}
          placeholder="flash, micro, speculative"
        />
      </div>
      <div className="form-field">
        <label className="form-label">Notes / editor preferences</label>
        <textarea value={form.notes ?? ''} onChange={(e) => update('notes', e.target.value)} rows={3} placeholder="Editor preferences, submission history, tone…" />
      </div>
      <label className="form-checkbox">
        <input type="checkbox" checked={form.active} onChange={(e) => update('active', e.target.checked)} />
        <span>Active (open for submissions)</span>
      </label>
      <div className="form-actions">
        <button className="btn-primary" onClick={handleSave}>Save</button>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        {onDelete && <button className="btn-danger" onClick={onDelete}>Delete</button>}
      </div>
    </div>
  )
}

export function MarketsView(): JSX.Element {
  const { markets, setMarkets, submissions, activeStoryId, stories, selectedMarketId, setSelectedMarketId } = useBorgesStore()
  const [editingMarket, setEditingMarket] = useState<Market | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [showInactive, setShowInactive] = useState(false)

  const activeStory = stories.find((s) => s.id === activeStoryId)

  const visible = markets.filter((m) => showInactive || m.active)

  const save = async (market: Market): Promise<void> => {
    await window.api.upsertMarket(market)
    const refreshed = await window.api.listMarkets()
    setMarkets(refreshed)
    setEditingMarket(null)
    setIsNew(false)
  }

  const del = async (id: string): Promise<void> => {
    await window.api.deleteMarket(id)
    const refreshed = await window.api.listMarkets()
    setMarkets(refreshed)
  }

  const getMarketSubmissionCount = (marketId: string): number =>
    submissions.filter((s) => s.marketId === marketId).length

  const getMarketActiveCount = (marketId: string): number =>
    submissions.filter((s) => s.marketId === marketId && (s.status === 'pending' || s.status === 'pending-revision')).length

  return (
    <div className="mv-layout">
      <div className="mv-header">
        <h1 className="mv-title">Markets</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer', fontSize: '12px', color: 'var(--text3)' }}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Show inactive
          </label>
          <button
            className="btn-primary mv-add-btn"
            onClick={() => { setIsNew(true); setEditingMarket({ ...EMPTY_MARKET, id: '' }) }}
          >
            + Add market
          </button>
        </div>
      </div>

      <div className="mv-body">
        {editingMarket ? (
          <div className="mv-form-wrap">
            <MarketForm
              market={editingMarket}
              isNew={isNew}
              onSave={save}
              onCancel={() => { setEditingMarket(null); setIsNew(false) }}
              onDelete={isNew ? undefined : () => del(editingMarket.id).then(() => { setEditingMarket(null); setIsNew(false) })}
            />
          </div>
        ) : visible.length === 0 ? (
          <div className="mv-empty">
            No markets yet. Add one to start tracking submissions.
          </div>
        ) : (
          <div className="mv-grid">
            {visible.map((market) => {
              const storyWc = activeStory?.wordCount ?? 0
              const fits = storyWc > 0 && storyWc <= market.wordCountMax && (!market.wordCountMin || storyWc >= market.wordCountMin)
              const activeSubs = getMarketActiveCount(market.id)
              const totalSubs = getMarketSubmissionCount(market.id)
              return (
                <div key={market.id} className={`mv-card${!market.active ? ' mv-card--inactive' : ''}`}>
                  <div className="mv-card-top">
                    <div className="mv-card-name">
                      {market.name}
                      {fits && activeStory && <span className="market-match-badge" style={{ marginLeft: '8px' }}>fits</span>}
                      {selectedMarketId === market.id && <span className="mv-badge-selected">selected</span>}
                      {!market.active && <span className="mv-badge-inactive">closed</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button className="mv-card-edit" onClick={() => setSelectedMarketId(selectedMarketId === market.id ? null : market.id)}>
                        {selectedMarketId === market.id ? 'Deselect' : 'Select'}
                      </button>
                      <button className="mv-card-edit" onClick={() => setEditingMarket(market)}>Edit</button>
                    </div>
                  </div>
                  <div className="mv-card-meta">
                    {market.wordCountMin ? `${market.wordCountMin}–` : 'Up to '}{market.wordCountMax} words
                    {' · '}{market.simultaneousSubs ? 'sim-subs ok' : 'no sim-subs'}
                    {market.responseTimeWeeks ? ` · ~${market.responseTimeWeeks}wk response` : ''}
                  </div>
                  {market.genres.length > 0 && (
                    <div className="mv-card-genres">{market.genres.join(', ')}</div>
                  )}
                  {market.url && (
                    <a className="mv-card-url" href={market.url} target="_blank" rel="noreferrer">{market.url}</a>
                  )}
                  {market.notes && <div className="mv-card-notes">{market.notes}</div>}
                  {totalSubs > 0 && (
                    <div className="mv-card-subs">
                      {activeSubs > 0 ? `${activeSubs} active` : 'no active'} · {totalSubs} total submission{totalSubs !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
