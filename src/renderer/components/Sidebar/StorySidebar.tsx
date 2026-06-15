import { useState, useRef } from 'react'
import { useBorgesStore } from '../../store/borgesStore'
import type { StoryFile, Submission } from '../../types/borges'

function getSubmissionBadge(storyId: string, submissions: Submission[]): { label: string; cls: string } {
  const storySubmissions = submissions.filter((s) => s.storyId === storyId)
  if (storySubmissions.length === 0) return { label: 'unsent', cls: 'badge-unsent' }
  const active = storySubmissions.find((s) => s.status === 'pending' || s.status === 'pending-revision')
  if (active) return { label: active.status === 'pending' ? 'out' : 'revision', cls: active.status === 'pending' ? 'badge-pending' : 'badge-pending-revision' }
  const last = storySubmissions.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0]
  return { label: last.status, cls: `badge-${last.status}` }
}

interface StoryItemProps {
  story: StoryFile
  index: number
  isActive: boolean
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDragStart: (index: number) => void
  onDragOver: (index: number) => void
  onDrop: () => void
}

function StoryItem({ story, index, isActive, onClick, onContextMenu, onDragStart, onDragOver, onDrop }: StoryItemProps): JSX.Element {
  const submissions = useBorgesStore((s) => s.submissions)
  const badge = getSubmissionBadge(story.id, submissions)
  return (
    <div
      className={`story-item${isActive ? ' active' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(index) }}
      onDrop={onDrop}
    >
      <div className="story-item-main">
        <div className="story-item-title">{story.meta.title || story.id}</div>
        <div className="story-item-wc">{story.wordCount.toLocaleString()} words</div>
      </div>
      <span className={`story-item-badge ${badge.cls}`}>{badge.label}</span>
    </div>
  )
}

export function StorySidebar(): JSX.Element {
  const { stories, activeStoryPath, activeStoryId, activeStoryContent, isDirty, setStories, moveStory, markSaved, clearActiveStory, mainView, setMainView } = useBorgesStore()
  const [search, setSearch] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const dragFrom = useRef<number>(-1)

  const filtered = search
    ? stories.filter((s) => (s.meta.title || s.id).toLowerCase().includes(search.toLowerCase()))
    : stories

  const openStory = async (story: StoryFile): Promise<void> => {
    if (isDirty && activeStoryPath) {
      await window.api.writeStory(activeStoryPath, activeStoryContent)
      await window.api.saveRevision(activeStoryPath, activeStoryContent)
      markSaved()
    }
    const content = await window.api.readStory(story.path)
    useBorgesStore.getState().setActiveStory(story.path, story.id, content)
    setMainView('editor')
  }

  const handleNew = async (): Promise<void> => {
    const name = `Story ${stories.length + 1}`
    const created = await window.api.createStory(name)
    const refreshed = await window.api.listStories()
    setStories(refreshed)
    const newStory = refreshed.find((s) => s.path === created.path)
    if (newStory) openStory(newStory)
  }

  const handleRename = async (story: StoryFile, newName: string): Promise<void> => {
    if (!newName.trim() || newName === story.id) { setRenaming(null); return }
    const newPath = await window.api.renameStory(story.path, newName.trim())
    const refreshed = await window.api.listStories()
    setStories(refreshed)
    // if this was the active story, reopen it
    if (story.path === activeStoryPath) {
      const updated = refreshed.find((s) => s.path === newPath)
      if (updated) openStory(updated)
    }
    setRenaming(null)
  }

  const handleDelete = async (story: StoryFile): Promise<void> => {
    await window.api.deleteStory(story.path)
    if (story.path === activeStoryPath) useBorgesStore.getState().clearActiveStory()
    const refreshed = await window.api.listStories()
    setStories(refreshed)
  }

  const handleStoryContextMenu = async (e: React.MouseEvent, story: StoryFile): Promise<void> => {
    e.preventDefault()
    const action = await window.api.showStoryContextMenu(story.id)
    if (action === 'rename') {
      setRenaming(story.id)
      setRenameValue(story.id)
    } else if (action === 'delete') {
      handleDelete(story)
    }
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <button
          className={`sidebar-btn${mainView === 'editor' && !activeStoryId ? ' active' : ''}`}
          onClick={() => { setMainView('editor'); clearActiveStory() }}
          title="Home"
        >⌂</button>
        <span className="sidebar-title">Stories</span>
        <button className="sidebar-btn" onClick={handleNew} title="New story">+</button>
      </div>
      <div className="sidebar-nav">
        <button
          className={`sidebar-nav-btn${mainView === 'markets' ? ' active' : ''}`}
          onClick={() => { setMainView('markets'); clearActiveStory() }}
        >
          Markets
        </button>
      </div>
      <div className="sidebar-search">
        <input
          type="text"
          placeholder="Filter stories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="sidebar-list">
        {filtered.map((story, idx) => (
          <div key={story.id}>
            {renaming === story.id ? (
              <div style={{ padding: '6px 12px' }}>
                <input
                  className="inline-edit"
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => handleRename(story, renameValue)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(story, renameValue)
                    if (e.key === 'Escape') setRenaming(null)
                  }}
                />
              </div>
            ) : (
              <StoryItem
                story={story}
                index={idx}
                isActive={story.id === activeStoryId}
                onClick={() => openStory(story)}
                onContextMenu={(e) => handleStoryContextMenu(e, story)}
                onDragStart={(i) => { dragFrom.current = i }}
                onDragOver={(i) => { if (dragFrom.current !== -1 && dragFrom.current !== i) moveStory(dragFrom.current, i) }}
                onDrop={() => { dragFrom.current = -1 }}
              />
            )}
          </div>
        ))}
      </div>

    </div>
  )
}
