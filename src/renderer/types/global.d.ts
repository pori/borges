import type { StoryFile, StoryMeta, Market, Submission, RevisionMeta } from './borges'

type AnalysisModeAI = 'compression' | 'ending' | 'tone' | 'market_fit' | 'chat'

interface AIPayload {
  mode: AnalysisModeAI
  storyContent: string
  storyId: string
  wordCountTarget?: number
  targetMarket?: Market
  collectionContext?: string
  useCollectionContext: boolean
  useMarketBrief: boolean
  conversationHistory: { role: 'user' | 'assistant'; content: string }[]
  userMessage: string
}

interface GlobalConfig {
  apiKey?: string
  collectionPath?: string
  fontSize?: number
  theme?: 'dark' | 'light'
  defaultWordCountTarget?: number
}

interface CollectionConfig {
  stories: Record<string, StoryMeta>
  collectionContext?: string
}

declare global {
  interface Window {
    api: {
      listStories(): Promise<StoryFile[]>
      readStory(path: string): Promise<string>
      writeStory(path: string, content: string): Promise<void>
      createStory(name: string): Promise<{ id: string; path: string }>
      renameStory(oldPath: string, newName: string): Promise<string>
      deleteStory(path: string): Promise<void>
      getStoryMeta(storyId: string): Promise<StoryMeta>
      setStoryMeta(storyId: string, meta: StoryMeta): Promise<void>
      saveOrder(order: string[]): Promise<void>
      getCollectionConfig(): Promise<CollectionConfig>
      setCollectionContext(context: string): Promise<void>
      readSession(): Promise<Record<string, unknown>>
      writeSession(data: Record<string, unknown>): Promise<void>
      listMarkets(): Promise<Market[]>
      upsertMarket(market: Market): Promise<void>
      deleteMarket(id: string): Promise<void>
      listSubmissions(): Promise<Submission[]>
      addSubmission(sub: Submission): Promise<void>
      updateSubmission(id: string, updates: Partial<Submission>): Promise<void>
      saveRevision(path: string, content: string): Promise<void>
      listRevisions(path: string): Promise<RevisionMeta[]>
      loadRevision(path: string, id: string): Promise<string>
      readConfig(): Promise<GlobalConfig>
      writeConfig(updates: Partial<GlobalConfig>): Promise<void>
      pickFolder(): Promise<string | null>
      streamAIMessage(payload: AIPayload, onChunk: (chunk: string) => void): Promise<void>
      showEditorContextMenu(): Promise<void>
      showStoryContextMenu(storyId: string): Promise<string | null>
      onMenuAction(handler: (action: string) => void): () => void
    }
  }
}

export {}
