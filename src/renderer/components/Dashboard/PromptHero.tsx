import { useEffect, useRef, useState } from 'react'
import { useBorgesStore } from '../../store/borgesStore'

const CACHE_KEY = 'borges:dailyPrompt'

interface CachedPrompt {
  date: string
  text: string
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function PromptHero(): JSX.Element {
  const { stories, setStories, setActiveStory, isDirty, activeStoryPath, activeStoryContent, markSaved } = useBorgesStore()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef(false)

  const fetchPrompt = async (): Promise<void> => {
    abortRef.current = false
    setLoading(true)
    setError(null)
    setPrompt('')
    try {
      await window.api.generatePrompt((chunk) => {
        if (!abortRef.current) setPrompt((p) => p + chunk)
      })
      setLoading(false)
    } catch (err) {
      if (!abortRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to generate prompt.')
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      try {
        const parsed: CachedPrompt = JSON.parse(cached)
        if (parsed.date === todayISO() && parsed.text) {
          setPrompt(parsed.text)
          return
        }
      } catch { /* invalid cache */ }
    }
    fetchPrompt()
    return () => { abortRef.current = true }
  }, [])

  // Persist completed prompt to localStorage
  useEffect(() => {
    if (!loading && prompt && !error) {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ date: todayISO(), text: prompt }))
    }
  }, [loading, prompt, error])

  const handleRegenerate = (): void => {
    localStorage.removeItem(CACHE_KEY)
    fetchPrompt()
  }

  const handleWrite = async (): Promise<void> => {
    if (isDirty && activeStoryPath) {
      await window.api.writeStory(activeStoryPath, activeStoryContent)
      await window.api.saveRevision(activeStoryPath, activeStoryContent)
      markSaved()
    }
    const name = `Story ${stories.length + 1}`
    const created = await window.api.createStory(name)
    const refreshed = await window.api.listStories()
    setStories(refreshed)
    const story = refreshed.find((s) => s.path === created.path)
    if (story) {
      const initial = `> ${prompt}\n\n`
      await window.api.writeStory(story.path, initial)
      setActiveStory(story.path, story.id, initial)
    }
  }

  return (
    <div className="prompt-hero">
      <div className="prompt-hero-label">Today's prompt</div>
      <div className={`prompt-hero-text${loading ? ' prompt-hero-text--loading' : ''}`}>
        {error
          ? <span className="prompt-hero-error">{error}</span>
          : prompt || <span className="prompt-hero-placeholder"> </span>
        }
      </div>
      <div className="prompt-hero-actions">
        <button
          className="prompt-hero-btn prompt-hero-btn--primary"
          onClick={handleWrite}
          disabled={loading || !prompt || !!error}
        >
          Write this
        </button>
        <button
          className="prompt-hero-btn"
          onClick={handleRegenerate}
          disabled={loading}
        >
          {loading ? 'Generating…' : 'New prompt'}
        </button>
      </div>
    </div>
  )
}
