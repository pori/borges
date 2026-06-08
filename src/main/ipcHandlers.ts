import { ipcMain, dialog, BrowserWindow } from 'electron'
import {
  listStories, readStory, writeStory, createStory, renameStory, deleteStory,
  getStoryMeta, setStoryMeta, getCollectionConfig, setCollectionContext,
  saveOrderList, readSession, writeSession,
  listMarkets, upsertMarket, deleteMarket,
  listSubmissions, addSubmission, updateSubmission,
  saveRevision, listRevisions, loadRevision
} from './fileSystem'
import type { Market, Submission, StoryMeta } from './fileSystem'
import { streamMessage, resetClient } from './aiService'
import type { AIPayload } from './aiService'
import { readGlobalConfig, writeGlobalConfig } from './globalConfig'
import type { GlobalConfig } from './globalConfig'

export function registerIpcHandlers(): void {
  // ── Stories ──────────────────────────────────────────────────────────────────
  ipcMain.handle('stories:list', async () => listStories())
  ipcMain.handle('stories:read', async (_e, path: string) => readStory(path))
  ipcMain.handle('stories:write', async (_e, path: string, content: string) => writeStory(path, content))
  ipcMain.handle('stories:create', async (_e, name: string) => createStory(name))
  ipcMain.handle('stories:rename', async (_e, oldPath: string, newName: string) => renameStory(oldPath, newName))
  ipcMain.handle('stories:delete', async (_e, path: string) => deleteStory(path))
  ipcMain.handle('stories:getMeta', async (_e, storyId: string) => getStoryMeta(storyId))
  ipcMain.handle('stories:setMeta', async (_e, storyId: string, meta: StoryMeta) => setStoryMeta(storyId, meta))
  ipcMain.handle('stories:saveOrder', async (_e, order: string[]) => saveOrderList(order))

  // ── Collection config ─────────────────────────────────────────────────────────
  ipcMain.handle('collection:getConfig', async () => getCollectionConfig())
  ipcMain.handle('collection:setContext', async (_e, context: string) => setCollectionContext(context))

  // ── Session ──────────────────────────────────────────────────────────────────
  ipcMain.handle('session:read', async () => readSession())
  ipcMain.handle('session:write', async (_e, data: Record<string, unknown>) => writeSession(data))

  // ── Markets ──────────────────────────────────────────────────────────────────
  ipcMain.handle('markets:list', async () => listMarkets())
  ipcMain.handle('markets:upsert', async (_e, market: Market) => upsertMarket(market))
  ipcMain.handle('markets:delete', async (_e, id: string) => deleteMarket(id))

  // ── Submissions ──────────────────────────────────────────────────────────────
  ipcMain.handle('submissions:list', async () => listSubmissions())
  ipcMain.handle('submissions:add', async (_e, sub: Submission) => addSubmission(sub))
  ipcMain.handle('submissions:update', async (_e, id: string, updates: Partial<Submission>) => updateSubmission(id, updates))

  // ── Revisions ─────────────────────────────────────────────────────────────────
  ipcMain.handle('revisions:save', async (_e, path: string, content: string) => saveRevision(path, content))
  ipcMain.handle('revisions:list', async (_e, path: string) => listRevisions(path))
  ipcMain.handle('revisions:load', async (_e, path: string, id: string) => loadRevision(path, id))

  // ── Config ────────────────────────────────────────────────────────────────────
  ipcMain.handle('config:read', async () => readGlobalConfig())
  ipcMain.handle('config:write', async (_e, updates: Partial<GlobalConfig>) => {
    writeGlobalConfig(updates)
    if (updates.apiKey !== undefined) resetClient()
  })
  ipcMain.handle('config:pickFolder', async (event): Promise<string | null> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(win!, { properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  // ── AI streaming ──────────────────────────────────────────────────────────────
  ipcMain.handle('ai:streamMessage', async (event, payload: AIPayload) => {
    try {
      let pending = ''
      let flushTimer: ReturnType<typeof setTimeout> | null = null

      const flush = (): void => {
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
        if (pending && !event.sender.isDestroyed()) {
          event.sender.send('ai:chunk', pending)
          pending = ''
        }
      }

      await streamMessage(payload, (chunk: string) => {
        pending += chunk
        if (!flushTimer) flushTimer = setTimeout(flush, 30)
      })

      flush()
      if (!event.sender.isDestroyed()) event.sender.send('ai:done')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!event.sender.isDestroyed()) event.sender.send('ai:error', message)
    }
  })
}
