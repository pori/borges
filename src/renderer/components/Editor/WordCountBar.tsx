import { useState } from 'react'
import { useBorgesStore } from '../../store/borgesStore'

export function WordCountBar(): JSX.Element {
  const { activeStoryContent, activeStoryId, stories, markets, selectedMarketId } = useBorgesStore()
  const [editingTarget, setEditingTarget] = useState(false)
  const [targetInput, setTargetInput] = useState('')

  const story = stories.find((s) => s.id === activeStoryId)
  const selectedMarket = markets.find((m) => m.id === selectedMarketId)

  const wordCount = activeStoryContent.trim() === '' ? 0 : activeStoryContent.trim().split(/\s+/).length

  // Determine target: story's own target, or selected market's max
  const target = story?.meta.wordCountTarget ?? selectedMarket?.wordCountMax ?? null

  let pct = 0
  let colorClass = ''
  if (target) {
    pct = Math.min(wordCount / target, 1)
    if (wordCount > target) colorClass = 'red'
    else if (wordCount >= target * 0.9) colorClass = 'amber'
  }

  const saveTarget = async (val: string): Promise<void> => {
    setEditingTarget(false)
    const num = parseInt(val, 10)
    if (!activeStoryId) return
    if (isNaN(num) || num <= 0) {
      // Clear target
      const meta = story?.meta ?? {}
      await window.api.setStoryMeta(activeStoryId, { ...meta, wordCountTarget: undefined })
    } else {
      const meta = story?.meta ?? {}
      await window.api.setStoryMeta(activeStoryId, { ...meta, wordCountTarget: num })
    }
    const refreshed = await window.api.listStories()
    useBorgesStore.getState().setStories(refreshed)
  }

  return (
    <div className="wordcount-bar">
      <span className={`wordcount-number${colorClass ? ' ' + colorClass : ''}`}>
        {wordCount.toLocaleString()}
      </span>
      {target && (
        <>
          <span style={{ color: 'var(--text3)', fontSize: '11px' }}>/ {target.toLocaleString()}</span>
          <div className="wordcount-bar-track">
            <div className={`wordcount-bar-fill${colorClass ? ' ' + colorClass : ''}`} style={{ width: `${pct * 100}%` }} />
          </div>
        </>
      )}
      {editingTarget ? (
        <input
          autoFocus
          type="number"
          value={targetInput}
          onChange={(e) => setTargetInput(e.target.value)}
          onBlur={() => saveTarget(targetInput)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveTarget(targetInput)
            if (e.key === 'Escape') setEditingTarget(false)
          }}
          style={{ width: '80px', fontSize: '12px', padding: '1px 6px', height: '22px' }}
          placeholder="target"
        />
      ) : (
        <button
          className="wordcount-target-btn"
          onClick={() => { setTargetInput(String(target ?? '')); setEditingTarget(true) }}
        >
          {target ? 'edit target' : 'set target'}
        </button>
      )}
      {selectedMarket && (
        <span style={{ fontSize: '11px', color: 'var(--text3)', marginLeft: 'auto' }}>
          ↗ {selectedMarket.name}
        </span>
      )}
    </div>
  )
}
