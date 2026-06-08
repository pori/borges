import { useEffect, useState } from 'react'
import { useBorgesStore } from './store/borgesStore'
import { StorySidebar } from './components/Sidebar/StorySidebar'
import { MarkdownEditor } from './components/Editor/MarkdownEditor'
import { AnalysisToolbar } from './components/Toolbar/AnalysisToolbar'
import { SubmissionPanel } from './components/SubmissionPanel/SubmissionPanel'
import { ChatPanel } from './components/AIChat/ChatPanel'
import { Dashboard } from './components/Dashboard/Dashboard'
import { SettingsDialog } from './components/Settings/SettingsDialog'

export default function App(): JSX.Element {
  const {
    sidebarOpen, setSidebarOpen,
    submissionPanelOpen, setSubmissionPanelOpen,
    chatOpen, setChatOpen,
    focusMode, toggleFocusMode,
    theme, toggleTheme,
    fontSize, setFontSize,
    activeStoryId, isDirty, activeStoryPath, activeStoryContent, markSaved,
    stories, setStories,
    setMarkets,
    setSubmissions,
    revisionPanelOpen, toggleRevisionPanel,
    initPrefs, loadSession
  } = useBorgesStore()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [, setIsFirstRun] = useState(false)

  // Initialise app
  useEffect(() => {
    async function init(): Promise<void> {
      await initPrefs()
      const [storiesList, marketsList, subsList] = await Promise.all([
        window.api.listStories(),
        window.api.listMarkets(),
        window.api.listSubmissions()
      ])
      setStories(storiesList)
      setMarkets(marketsList)
      setSubmissions(subsList)
      await loadSession()
      const cfg = await window.api.readConfig()
      if (!cfg.apiKey) {
        setIsFirstRun(true)
        setSettingsOpen(true)
      }
    }
    init()
  }, [])

  // Menu actions
  useEffect(() => {
    return window.api.onMenuAction(async (action) => {
      if (action === 'save') {
        if (activeStoryPath && isDirty) {
          await window.api.writeStory(activeStoryPath, activeStoryContent)
          await window.api.saveRevision(activeStoryPath, activeStoryContent)
          markSaved()
        }
      } else if (action === 'newStory') {
        const name = `Story ${stories.length + 1}`
        const created = await window.api.createStory(name)
        const refreshed = await window.api.listStories()
        setStories(refreshed)
        const s = refreshed.find((x) => x.path === created.path)
        if (s) {
          const content = await window.api.readStory(s.path)
          useBorgesStore.getState().setActiveStory(s.path, s.id, content)
        }
      } else if (action === 'toggleSidebar') {
        setSidebarOpen(!sidebarOpen)
      } else if (action === 'toggleSubmissionPanel') {
        setSubmissionPanelOpen(!submissionPanelOpen)
      } else if (action === 'toggleChat') {
        setChatOpen(!chatOpen)
      } else if (action === 'toggleRevisions') {
        toggleRevisionPanel()
      } else if (action === 'toggleFocusMode') {
        toggleFocusMode()
      } else if (action === 'toggleTheme') {
        toggleTheme()
      } else if (action === 'fontIncrease') {
        setFontSize(fontSize + 1)
      } else if (action === 'fontDecrease') {
        setFontSize(fontSize - 1)
      } else if (action === 'fontReset') {
        setFontSize(15)
      } else if (action === 'openSettings') {
        setSettingsOpen(true)
      }
    })
  }, [activeStoryPath, isDirty, activeStoryContent, sidebarOpen, submissionPanelOpen, chatOpen, focusMode, fontSize, stories])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = async (e: KeyboardEvent): Promise<void> => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 's') {
        e.preventDefault()
        if (activeStoryPath && isDirty) {
          await window.api.writeStory(activeStoryPath, activeStoryContent)
          await window.api.saveRevision(activeStoryPath, activeStoryContent)
          markSaved()
        }
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'G') {
        e.preventDefault()
        toggleFocusMode()
      } else if (e.key === 'Escape' && focusMode) {
        toggleFocusMode()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeStoryPath, isDirty, activeStoryContent, focusMode])

  // Toggle layout segment counts
  const toggleSeg = (panel: 'sidebar' | 'sub' | 'chat'): void => {
    if (panel === 'sidebar') setSidebarOpen(!sidebarOpen)
    else if (panel === 'sub') setSubmissionPanelOpen(!submissionPanelOpen)
    else setChatOpen(!chatOpen)
  }

  return (
    <div
      className="app-layout"
      data-sidebar={sidebarOpen ? 'open' : 'closed'}
      data-sub={submissionPanelOpen ? 'open' : 'closed'}
      data-chat={chatOpen ? 'open' : 'closed'}
      data-focus={focusMode ? 'on' : 'off'}
    >
      {/* Titlebar */}
      <div className="app-titlebar">
        <span className="app-titlebar-title">
          Borges{activeStoryId ? ` — ${useBorgesStore.getState().stories.find(s => s.id === activeStoryId)?.meta.title || activeStoryId}${isDirty ? ' ●' : ''}` : ''}
        </span>
        <div className="app-titlebar-right">
          <div className="app-layout-toggle">
            <button
              className={`app-layout-toggle-seg${sidebarOpen ? ' active' : ''}`}
              onClick={() => toggleSeg('sidebar')}
              title={sidebarOpen ? 'Hide story list' : 'Show story list'}
            />
            <div className="app-layout-toggle-seg app-layout-toggle-seg--mid" />
            <button
              className={`app-layout-toggle-seg${submissionPanelOpen ? ' active' : ''}`}
              onClick={() => toggleSeg('sub')}
              title={submissionPanelOpen ? 'Hide submission panel' : 'Show submission panel'}
            />
            <div className="app-layout-toggle-seg app-layout-toggle-seg--mid" style={{ width: '4px' }} />
            <button
              className={`app-layout-toggle-seg${chatOpen ? ' active' : ''}`}
              onClick={() => toggleSeg('chat')}
              title={chatOpen ? 'Hide AI chat' : 'Show AI chat'}
            />
          </div>
          <button
            className={`app-titlebar-btn${revisionPanelOpen ? ' active' : ''}`}
            onClick={toggleRevisionPanel}
            title="Revision history"
            disabled={!activeStoryId}
          >⟳</button>
          <button
            className={`app-titlebar-btn${focusMode ? ' active' : ''}`}
            onClick={toggleFocusMode}
            title="Focus mode (⌘⇧G)"
          >⊡</button>
          <button
            className="app-titlebar-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button
            className="app-titlebar-btn"
            onClick={() => setSettingsOpen(true)}
            title="Preferences (⌘,)"
          >⚙</button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="sidebar" style={{ overflow: 'hidden' }}>
        <StorySidebar />
      </aside>

      {/* Editor area */}
      <main className="editor-area">
        {activeStoryId ? (
          <>
            <AnalysisToolbar />
            <MarkdownEditor />
          </>
        ) : (
          <Dashboard />
        )}
      </main>

      {/* Submission panel */}
      <aside style={{ gridArea: 'subpanel', overflow: 'hidden', minWidth: 0 }}>
        <SubmissionPanel />
      </aside>

      {/* Chat panel */}
      <aside className="chat-area">
        <ChatPanel />
      </aside>


{/* Settings */}
      {settingsOpen && (
        <SettingsDialog
          onClose={async () => {
            setSettingsOpen(false)
            setIsFirstRun(false)
            // Refresh stories in case collection path changed
            const refreshed = await window.api.listStories()
            setStories(refreshed)
          }}
        />
      )}
    </div>
  )
}
