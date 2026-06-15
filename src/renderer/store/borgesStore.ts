import { create } from 'zustand'
import type { StoryFile, Market, Submission, ChatMessage, AnalysisMode, TextAnnotation, RevisionMeta } from '../types/borges'

interface BorgesState {
  // Stories
  stories: StoryFile[]
  setStories: (stories: StoryFile[]) => void
  moveStory: (fromIdx: number, toIdx: number) => void

  // Active story
  activeStoryPath: string | null
  activeStoryId: string | null
  activeStoryContent: string
  isDirty: boolean
  setActiveStory: (path: string, id: string, content: string) => void
  setContent: (content: string) => void
  markSaved: () => void
  clearActiveStory: () => void

  // Markets & Submissions
  markets: Market[]
  setMarkets: (markets: Market[]) => void
  submissions: Submission[]
  setSubmissions: (submissions: Submission[]) => void
  selectedMarketId: string | null
  setSelectedMarketId: (id: string | null) => void

  // AI chat
  chatHistory: ChatMessage[]
  chatHistoryByStory: Record<string, ChatMessage[]>
  isAILoading: boolean
  aiError: string | null
  addUserMessage: (text: string) => void
  startAssistantMessage: () => void
  appendToLastMessage: (chunk: string) => void
  setAILoading: (v: boolean) => void
  setAIError: (e: string | null) => void
  newChat: () => void

  // Analysis
  analysisMode: AnalysisMode
  setAnalysisMode: (mode: AnalysisMode) => void
  annotations: TextAnnotation[]
  setAnnotations: (anns: TextAnnotation[]) => void
  removeAnnotation: (id: string) => void
  clearAnnotations: () => void
  useCollectionContext: boolean
  toggleCollectionContext: () => void
  useMarketBrief: boolean
  toggleMarketBrief: () => void

  // Revisions
  revisionPanelOpen: boolean
  toggleRevisionPanel: () => void
  revisions: RevisionMeta[]
  setRevisions: (revisions: RevisionMeta[]) => void

  // UI layout
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
  submissionPanelOpen: boolean
  setSubmissionPanelOpen: (v: boolean) => void
  chatOpen: boolean
  setChatOpen: (v: boolean) => void
  focusMode: boolean
  toggleFocusMode: () => void
  mainView: 'editor' | 'markets'
  setMainView: (view: 'editor' | 'markets') => void

  // Theme & font
  theme: 'dark' | 'light'
  toggleTheme: () => void
  fontSize: number
  setFontSize: (size: number) => void
  initPrefs: () => Promise<void>

  // Session
  loadSession: () => Promise<void>
}

let _sessionTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSave(getData: () => Record<string, unknown>): void {
  if (_sessionTimer) clearTimeout(_sessionTimer)
  _sessionTimer = setTimeout(() => {
    const api = (window as Window).api
    api?.writeSession(getData()).catch(console.error)
  }, 1500)
}

let _autoSaveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleAutoSave(getData: () => { path: string; content: string } | null): void {
  if (_autoSaveTimer) clearTimeout(_autoSaveTimer)
  _autoSaveTimer = setTimeout(() => {
    const d = getData()
    if (!d) return
    const api = (window as Window).api
    api?.writeStory(d.path, d.content).catch(console.error)
  }, 10_000)
}

export const useBorgesStore = create<BorgesState>((set, get) => ({
  stories: [],
  setStories: (stories) => set({ stories }),
  moveStory: (fromIdx, toIdx) => {
    set((s) => {
      const stories = [...s.stories]
      const [moved] = stories.splice(fromIdx, 1)
      stories.splice(toIdx, 0, moved)
      const order = stories.map((s) => s.id)
      window.api.saveOrder(order).catch(console.error)
      return { stories }
    })
  },

  activeStoryPath: null,
  activeStoryId: null,
  activeStoryContent: '',
  isDirty: false,
  setActiveStory: (path, id, content) => {
    const s = get()
    const history = s.chatHistoryByStory[id] ?? []
    set({ activeStoryPath: path, activeStoryId: id, activeStoryContent: content, isDirty: false, chatHistory: history, annotations: [], analysisMode: 'none' })
    scheduleSave(() => ({ activeStoryPath: get().activeStoryPath, chatHistoryByStory: get().chatHistoryByStory }))
  },
  setContent: (content) => {
    set({ activeStoryContent: content, isDirty: true })
    scheduleAutoSave(() => {
      const { activeStoryPath, activeStoryContent } = get()
      return activeStoryPath ? { path: activeStoryPath, content: activeStoryContent } : null
    })
  },
  markSaved: () => set({ isDirty: false }),
  clearActiveStory: () => set({ activeStoryPath: null, activeStoryId: null, activeStoryContent: '', isDirty: false, chatHistory: [], annotations: [], analysisMode: 'none' }),

  markets: [],
  setMarkets: (markets) => set({ markets }),
  submissions: [],
  setSubmissions: (submissions) => set({ submissions }),
  selectedMarketId: null,
  setSelectedMarketId: (id) => set({ selectedMarketId: id }),

  chatHistory: [],
  chatHistoryByStory: {},
  isAILoading: false,
  aiError: null,
  addUserMessage: (text) => {
    const msg: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: text }
    set((s) => {
      const history = [...s.chatHistory, msg]
      const chatHistoryByStory = s.activeStoryId
        ? { ...s.chatHistoryByStory, [s.activeStoryId]: history }
        : s.chatHistoryByStory
      return { chatHistory: history, chatHistoryByStory }
    })
    scheduleSave(() => ({ activeStoryPath: get().activeStoryPath, chatHistoryByStory: get().chatHistoryByStory }))
  },
  startAssistantMessage: () => {
    const msg: ChatMessage = { id: `asst-${Date.now()}`, role: 'assistant', content: '' }
    set((s) => ({ chatHistory: [...s.chatHistory, msg] }))
  },
  appendToLastMessage: (chunk) => {
    set((s) => {
      const history = [...s.chatHistory]
      const last = history[history.length - 1]
      if (last?.role === 'assistant') history[history.length - 1] = { ...last, content: last.content + chunk }
      return { chatHistory: history }
    })
  },
  setAILoading: (isAILoading) => {
    if (!isAILoading) {
      const s = get()
      if (s.activeStoryId) {
        const chatHistoryByStory = { ...s.chatHistoryByStory, [s.activeStoryId]: s.chatHistory }
        set({ isAILoading, chatHistoryByStory })
        scheduleSave(() => ({ activeStoryPath: get().activeStoryPath, chatHistoryByStory: get().chatHistoryByStory }))
        return
      }
    }
    set({ isAILoading })
  },
  setAIError: (aiError) => set({ aiError }),
  newChat: () => {
    set((s) => {
      const chatHistoryByStory = s.activeStoryId
        ? { ...s.chatHistoryByStory, [s.activeStoryId]: [] }
        : s.chatHistoryByStory
      return { chatHistory: [], chatHistoryByStory }
    })
  },

  analysisMode: 'none',
  setAnalysisMode: (analysisMode) => set({ analysisMode }),
  annotations: [],
  setAnnotations: (annotations) => set({ annotations }),
  removeAnnotation: (id) => set((s) => ({ annotations: s.annotations.filter((a) => a.id !== id) })),
  clearAnnotations: () => set({ annotations: [], analysisMode: 'none' }),
  useCollectionContext: false,
  toggleCollectionContext: () => set((s) => ({ useCollectionContext: !s.useCollectionContext })),
  useMarketBrief: false,
  toggleMarketBrief: () => set((s) => ({ useMarketBrief: !s.useMarketBrief })),

  revisionPanelOpen: false,
  toggleRevisionPanel: () => set((s) => ({ revisionPanelOpen: !s.revisionPanelOpen })),
  revisions: [],
  setRevisions: (revisions) => set({ revisions }),

  sidebarOpen: localStorage.getItem('sidebarOpen') !== 'false',
  setSidebarOpen: (v) => { localStorage.setItem('sidebarOpen', String(v)); set({ sidebarOpen: v }) },
  submissionPanelOpen: localStorage.getItem('submissionPanelOpen') !== 'false',
  setSubmissionPanelOpen: (v) => { localStorage.setItem('submissionPanelOpen', String(v)); set({ submissionPanelOpen: v }) },
  chatOpen: localStorage.getItem('chatOpen') !== 'false',
  setChatOpen: (v) => { localStorage.setItem('chatOpen', String(v)); set({ chatOpen: v }) },
  focusMode: false,
  toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
  mainView: 'editor',
  setMainView: (view) => set({ mainView: view }),

  theme: 'dark',
  toggleTheme: () => {
    set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark'
      window.api.writeConfig({ theme: next })
      document.documentElement.classList.toggle('light', next === 'light')
      return { theme: next }
    })
  },
  fontSize: 15,
  setFontSize: (size) => {
    const clamped = Math.max(11, Math.min(24, size))
    window.api.writeConfig({ fontSize: clamped })
    set({ fontSize: clamped })
  },
  initPrefs: async () => {
    const cfg = await window.api.readConfig()
    const fontSize = Math.max(11, Math.min(24, cfg.fontSize ?? 15))
    const theme = cfg.theme ?? 'dark'
    document.documentElement.classList.toggle('light', theme === 'light')
    set({ fontSize, theme })
  },

  loadSession: async () => {
    try {
      const data = await window.api.readSession()
      const patch: Partial<BorgesState> = {}
      if (data.chatHistoryByStory && typeof data.chatHistoryByStory === 'object') {
        patch.chatHistoryByStory = data.chatHistoryByStory as Record<string, ChatMessage[]>
      }
      set(patch)
      if (typeof data.activeStoryPath === 'string') {
        try {
          const content = await window.api.readStory(data.activeStoryPath)
          const id = data.activeStoryPath.split('/').pop()?.replace(/\.md$/, '') ?? ''
          get().setActiveStory(data.activeStoryPath, id, content)
        } catch {
          // file moved/deleted
        }
      }
    } catch {
      // no session
    }
  }
}))
