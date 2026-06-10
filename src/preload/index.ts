import { contextBridge, ipcRenderer } from 'electron'
import type { Market, Submission, StoryFile, StoryMeta, RevisionMeta, CollectionConfig, TelemetrySession } from '../main/fileSystem'
import type { AIPayload } from '../main/aiService'
import type { GlobalConfig } from '../main/globalConfig'

contextBridge.exposeInMainWorld('api', {
  // Stories
  listStories: (): Promise<StoryFile[]> => ipcRenderer.invoke('stories:list'),
  readStory: (path: string): Promise<string> => ipcRenderer.invoke('stories:read', path),
  writeStory: (path: string, content: string): Promise<void> => ipcRenderer.invoke('stories:write', path, content),
  createStory: (name: string): Promise<{ id: string; path: string }> => ipcRenderer.invoke('stories:create', name),
  renameStory: (oldPath: string, newName: string): Promise<string> => ipcRenderer.invoke('stories:rename', oldPath, newName),
  deleteStory: (path: string): Promise<void> => ipcRenderer.invoke('stories:delete', path),
  getStoryMeta: (storyId: string): Promise<StoryMeta> => ipcRenderer.invoke('stories:getMeta', storyId),
  setStoryMeta: (storyId: string, meta: StoryMeta): Promise<void> => ipcRenderer.invoke('stories:setMeta', storyId, meta),
  saveOrder: (order: string[]): Promise<void> => ipcRenderer.invoke('stories:saveOrder', order),

  // Collection
  getCollectionConfig: (): Promise<CollectionConfig> => ipcRenderer.invoke('collection:getConfig'),
  setCollectionContext: (context: string): Promise<void> => ipcRenderer.invoke('collection:setContext', context),

  // Session
  readSession: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('session:read'),
  writeSession: (data: Record<string, unknown>): Promise<void> => ipcRenderer.invoke('session:write', data),

  // Markets
  listMarkets: (): Promise<Market[]> => ipcRenderer.invoke('markets:list'),
  upsertMarket: (market: Market): Promise<void> => ipcRenderer.invoke('markets:upsert', market),
  deleteMarket: (id: string): Promise<void> => ipcRenderer.invoke('markets:delete', id),

  // Submissions
  listSubmissions: (): Promise<Submission[]> => ipcRenderer.invoke('submissions:list'),
  addSubmission: (sub: Submission): Promise<void> => ipcRenderer.invoke('submissions:add', sub),
  updateSubmission: (id: string, updates: Partial<Submission>): Promise<void> => ipcRenderer.invoke('submissions:update', id, updates),

  // Revisions
  saveRevision: (path: string, content: string): Promise<void> => ipcRenderer.invoke('revisions:save', path, content),
  listRevisions: (path: string): Promise<RevisionMeta[]> => ipcRenderer.invoke('revisions:list', path),
  loadRevision: (path: string, id: string): Promise<string> => ipcRenderer.invoke('revisions:load', path, id),

  // Config
  readConfig: (): Promise<GlobalConfig> => ipcRenderer.invoke('config:read'),
  writeConfig: (updates: Partial<GlobalConfig>): Promise<void> => ipcRenderer.invoke('config:write', updates),
  pickFolder: (): Promise<string | null> => ipcRenderer.invoke('config:pickFolder'),

  // AI
  generatePrompt: (onChunk: (chunk: string) => void): Promise<void> => {
    return new Promise((resolve, reject) => {
      const chunkHandler = (_: Electron.IpcRendererEvent, chunk: string): void => onChunk(chunk)
      const doneHandler = (): void => {
        ipcRenderer.removeListener('ai:promptChunk', chunkHandler)
        ipcRenderer.removeListener('ai:promptDone', doneHandler)
        ipcRenderer.removeListener('ai:promptError', errorHandler)
        resolve()
      }
      const errorHandler = (_: Electron.IpcRendererEvent, message: string): void => {
        ipcRenderer.removeListener('ai:promptChunk', chunkHandler)
        ipcRenderer.removeListener('ai:promptDone', doneHandler)
        ipcRenderer.removeListener('ai:promptError', errorHandler)
        reject(new Error(message))
      }
      ipcRenderer.removeAllListeners('ai:promptChunk')
      ipcRenderer.removeAllListeners('ai:promptDone')
      ipcRenderer.removeAllListeners('ai:promptError')
      ipcRenderer.on('ai:promptChunk', chunkHandler)
      ipcRenderer.on('ai:promptDone', doneHandler)
      ipcRenderer.on('ai:promptError', errorHandler)
      ipcRenderer.invoke('ai:generatePrompt').catch(reject)
    })
  },
  streamAIMessage: (payload: AIPayload, onChunk: (chunk: string) => void): Promise<void> => {
    return new Promise((resolve, reject) => {
      const chunkHandler = (_: Electron.IpcRendererEvent, chunk: string): void => onChunk(chunk)
      const doneHandler = (): void => {
        ipcRenderer.removeListener('ai:chunk', chunkHandler)
        ipcRenderer.removeListener('ai:done', doneHandler)
        ipcRenderer.removeListener('ai:error', errorHandler)
        resolve()
      }
      const errorHandler = (_: Electron.IpcRendererEvent, message: string): void => {
        ipcRenderer.removeListener('ai:chunk', chunkHandler)
        ipcRenderer.removeListener('ai:done', doneHandler)
        ipcRenderer.removeListener('ai:error', errorHandler)
        reject(new Error(message))
      }
      ipcRenderer.on('ai:chunk', chunkHandler)
      ipcRenderer.on('ai:done', doneHandler)
      ipcRenderer.on('ai:error', errorHandler)
      ipcRenderer.invoke('ai:streamMessage', payload).catch(reject)
    })
  },

  // Telemetry
  appendTelemetrySession: (session: TelemetrySession): Promise<void> => ipcRenderer.invoke('telemetry:append', session),
  readTelemetry: (): Promise<TelemetrySession[]> => ipcRenderer.invoke('telemetry:read'),

  // Native context menus
  showEditorContextMenu: (): Promise<void> => ipcRenderer.invoke('menu:editorContext'),
  showStoryContextMenu: (storyId: string): Promise<string | null> => ipcRenderer.invoke('menu:storyContext', storyId),

  // Menu
  onMenuAction: (handler: (action: string) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, action: string): void => handler(action)
    ipcRenderer.on('menu:action', listener)
    return () => ipcRenderer.removeListener('menu:action', listener)
  }
})
