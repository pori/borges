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

export function MarketsTab(): JSX.Element {
  const { markets, setMarkets, activeStoryId, stories, selectedMarketId, setSelectedMarketId } = useBorgesStore()
  const [editingMarket, setEditingMarket] = useState<Market | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [filterMatch, setFilterMatch] = useState(false)

  const activeStory = stories.find((s) => s.id === activeStoryId)

  const visible = markets.filter((m) => {
    if (!showInactive && !m.active) return false
    if (filterMatch && activeStory) {
      const wc = activeStory.wordCount
      if (wc > m.wordCountMax) return false
      if (m.wordCountMin && wc < m.wordCountMin) return false
    }
    return true
  })

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
    if (selectedMarketId === id) setSelectedMarketId(null)
  }

  if (editingMarket) {
    return <MarketForm market={editingMarket} isNew={isNew} onSave={save} onCancel={() => { setEditingMarket(null); setIsNew(false) }} onDelete={isNew ? undefined : () => del(editingMarket.id).then(() => { setEditingMarket(null); setIsNew(false) })} />
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <button
          className="btn-primary"
          style={{ flex: 1, fontSize: '12px' }}
          onClick={() => { setIsNew(true); setEditingMarket({ ...EMPTY_MARKET, id: '' }) }}
        >
          + Add market
        </button>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', fontSize: '11px', color: 'var(--text3)' }}>
        <label style={{ display: 'flex', gap: '4px', alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={filterMatch} onChange={(e) => setFilterMatch(e.target.checked)} />
          Match story
        </label>
        <label style={{ display: 'flex', gap: '4px', alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
      </div>
      {visible.length === 0 && <div className="dashboard-empty">No markets yet. Add one to start tracking submissions.</div>}
      {visible.map((market) => {
        const isSelected = market.id === selectedMarketId
        const storyWc = activeStory?.wordCount ?? 0
        const fits = storyWc > 0 && storyWc <= market.wordCountMax && (!market.wordCountMin || storyWc >= market.wordCountMin)
        return (
          <div key={market.id} className={`market-item${!market.active ? ' inactive' : ''}`} style={{ borderColor: isSelected ? 'var(--accent)' : undefined }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="market-item-name">{market.name}</span>
                  {fits && activeStory && <span className="market-match-badge">fits</span>}
                </div>
                <div className="market-item-wc">
                  {market.wordCountMin ? `${market.wordCountMin}–` : 'up to '}{market.wordCountMax} words · {market.simultaneousSubs ? 'sim-subs ok' : 'no sim-subs'}
                  {market.responseTimeWeeks ? ` · ~${market.responseTimeWeeks}wk` : ''}
                </div>
                {market.genres.length > 0 && <div className="market-item-tags">{market.genres.join(', ')}</div>}
              </div>
            </div>
            <div className="market-actions">
              <button onClick={() => {
                setSelectedMarketId(isSelected ? null : market.id)
              }}>{isSelected ? 'Deselect' : 'Select'}</button>
              <button onClick={() => setEditingMarket(market)}>Edit</button>
            </div>
          </div>
        )
      })}
    </div>
  )
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

  const update = <K extends keyof Market>(key: K, value: Market[K]): void => setForm((f) => ({ ...f, [key]: value }))

  const handleSave = (): void => {
    if (!form.name.trim()) return
    const id = form.id || slug(form.name)
    onSave({ ...form, id })
  }

  return (
    <div className="market-form">
      <div className="market-form-title">{isNew ? 'Add market' : 'Edit market'}</div>
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
        <input value={form.genres.join(', ')} onChange={(e) => update('genres', e.target.value.split(',').map((g) => g.trim()).filter(Boolean))} placeholder="flash, micro, speculative" />
      </div>
      <div className="form-field">
        <label className="form-label">Notes / editor preferences</label>
        <textarea value={form.notes ?? ''} onChange={(e) => update('notes', e.target.value)} rows={3} placeholder="Editor preferences, submission history, tone…" />
      </div>
      <div className="form-field">
        <label style={{ display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" checked={form.active} onChange={(e) => update('active', e.target.checked)} />
          <span className="form-label" style={{ margin: 0 }}>Active (open for submissions)</span>
        </label>
      </div>
      <div className="form-actions">
        <button className="btn-primary" onClick={handleSave}>Save</button>
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        {onDelete && <button className="btn-danger" onClick={onDelete}>Delete</button>}
      </div>
    </div>
  )
}
