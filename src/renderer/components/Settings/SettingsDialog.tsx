import { useState, useEffect } from 'react'
import { useBorgesStore } from '../../store/borgesStore'

interface Props {
  onClose: () => void
}

type Tab = 'general' | 'editor' | 'collection'

export function SettingsDialog({ onClose }: Props): JSX.Element {
  const { theme, fontSize, setFontSize } = useBorgesStore()
  const [tab, setTab] = useState<Tab>('general')
  const [collectionPath, setCollectionPath] = useState('')
  const [defaultTarget, setDefaultTarget] = useState('')
  const [collectionContext, setCollectionContext] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.api.readConfig().then((cfg) => {
      setCollectionPath(cfg.collectionPath ?? '')
      setDefaultTarget(String(cfg.defaultWordCountTarget ?? ''))
    })
    window.api.getCollectionConfig().then((cfg) => {
      setCollectionContext(cfg.collectionContext ?? '')
    })
  }, [])

  const save = async (): Promise<void> => {
    setSaving(true)
    await window.api.writeConfig({
      collectionPath: collectionPath || undefined,
      defaultWordCountTarget: defaultTarget ? parseInt(defaultTarget) : undefined,
      theme
    })
    if (tab === 'collection') {
      await window.api.setCollectionContext(collectionContext)
    }
    setSaving(false)
    onClose()
  }

  const pickFolder = async (): Promise<void> => {
    const folder = await window.api.pickFolder()
    if (folder) setCollectionPath(folder)
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <span className="settings-title">Preferences</span>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>
        <div className="settings-body">
          <nav className="settings-nav">
            {(['general', 'editor', 'collection'] as Tab[]).map((t) => (
              <button key={t} className={`settings-nav-item${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </nav>
          <div className="settings-content">
            {tab === 'general' && (
              <div>
                <div className="settings-section-title">General</div>
                <div className="settings-field">
                  <label className="settings-label">Collection folder</label>
                  <div className="settings-field-row">
                    <input value={collectionPath} onChange={(e) => setCollectionPath(e.target.value)} placeholder="~/Documents/my-collection" />
                    <button className="settings-pick-btn" onClick={pickFolder}>Browse…</button>
                  </div>
                  <div className="settings-hint">The directory containing your .md files and .borges/ folder.</div>
                </div>
              </div>
            )}
            {tab === 'editor' && (
              <div>
                <div className="settings-section-title">Editor</div>
                <div className="settings-field">
                  <label className="settings-label">Font size ({fontSize}px)</label>
                  <input
                    type="range"
                    min="11"
                    max="24"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
                <div className="settings-field">
                  <label className="settings-label">Default word count target</label>
                  <input
                    type="number"
                    value={defaultTarget}
                    onChange={(e) => setDefaultTarget(e.target.value)}
                    placeholder="e.g. 1000"
                  />
                  <div className="settings-hint">Applied to new stories. Per-story target overrides this.</div>
                </div>
              </div>
            )}
            {tab === 'collection' && (
              <div>
                <div className="settings-section-title">Collection</div>
                <div className="settings-field">
                  <label className="settings-label">Collection context</label>
                  <textarea
                    className="context-textarea"
                    value={collectionContext}
                    onChange={(e) => setCollectionContext(e.target.value)}
                    placeholder="Describe the themes, aesthetic, and goals of your collection."
                    rows={8}
                  />
                  <div className="settings-hint">Used when the 'Collection' context toggle is enabled.</div>
                </div>
              </div>
            )}
            <div style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
