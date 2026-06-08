import { readdir, readFile, writeFile, mkdir, unlink, rename as fsRename, rm } from 'fs/promises'
import { join, basename } from 'path'
import { getCollectionRoot } from './globalConfig'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StoryMeta {
  title?: string
  wordCountTarget?: number
  tags?: string[]
  notes?: string
}

export interface Market {
  id: string
  name: string
  url?: string
  wordCountMin?: number
  wordCountMax: number
  simultaneousSubs: boolean
  responseTimeWeeks?: number
  genres: string[]
  notes?: string
  active: boolean
}

export interface Submission {
  id: string
  storyId: string
  marketId: string
  submittedAt: string
  status: 'pending' | 'withdrawn' | 'rejected' | 'accepted' | 'pending-revision'
  statusUpdatedAt: string
  notes?: string
  simultaneous: boolean
}

export interface CollectionConfig {
  stories: Record<string, StoryMeta>
  collectionContext?: string
}

export interface RevisionMeta {
  id: string
  timestamp: number
  wordCount: number
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

const borgesDir = (): string => join(getCollectionRoot(), '.borges')
const configFile = (): string => join(borgesDir(), 'config.json')
const orderFile = (): string => join(borgesDir(), 'order.json')
const sessionFile = (): string => join(borgesDir(), 'session.json')
const marketsFile = (): string => join(borgesDir(), 'markets.json')
const submissionsFile = (): string => join(borgesDir(), 'submissions.json')
const revisionsDir = (): string => join(borgesDir(), 'revisions')

const MAX_REVISIONS = 50

function assertInCollection(filePath: string): void {
  const root = getCollectionRoot()
  const resolved = filePath.startsWith('/') ? filePath : join(root, filePath)
  if (!resolved.startsWith(root)) throw new Error('Access denied: path outside collection')
}

// ─── Collection config ────────────────────────────────────────────────────────

async function readConfig(): Promise<CollectionConfig> {
  try {
    return JSON.parse(await readFile(configFile(), 'utf-8'))
  } catch {
    return { stories: {} }
  }
}

async function writeConfig(cfg: CollectionConfig): Promise<void> {
  await mkdir(borgesDir(), { recursive: true })
  await writeFile(configFile(), JSON.stringify(cfg, null, 2), 'utf-8')
}

export async function getStoryMeta(storyId: string): Promise<StoryMeta> {
  const cfg = await readConfig()
  return cfg.stories[storyId] ?? {}
}

export async function setStoryMeta(storyId: string, meta: StoryMeta): Promise<void> {
  const cfg = await readConfig()
  cfg.stories[storyId] = { ...cfg.stories[storyId], ...meta }
  await writeConfig(cfg)
}

export async function getCollectionConfig(): Promise<CollectionConfig> {
  return readConfig()
}

export async function setCollectionContext(context: string): Promise<void> {
  const cfg = await readConfig()
  cfg.collectionContext = context
  await writeConfig(cfg)
}

// ─── Story listing ────────────────────────────────────────────────────────────

export interface StoryFile {
  id: string
  path: string
  wordCount: number
  meta: StoryMeta
}

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

async function readOrderList(): Promise<string[]> {
  try {
    return JSON.parse(await readFile(orderFile(), 'utf-8'))
  } catch {
    return []
  }
}

export async function saveOrderList(order: string[]): Promise<void> {
  await mkdir(borgesDir(), { recursive: true })
  await writeFile(orderFile(), JSON.stringify(order, null, 2), 'utf-8')
}

export async function listStories(): Promise<StoryFile[]> {
  await mkdir(getCollectionRoot(), { recursive: true })
  const [entries, order, cfg] = await Promise.all([
    readdir(getCollectionRoot(), { withFileTypes: true }),
    readOrderList(),
    readConfig()
  ])

  const mdFiles = entries.filter(
    (e) => e.isFile() && e.name.endsWith('.md') && !e.name.startsWith('.')
  )

  const stories: StoryFile[] = await Promise.all(
    mdFiles.map(async (e) => {
      const id = e.name.replace(/\.md$/, '')
      const path = join(getCollectionRoot(), e.name)
      const content = await readFile(path, 'utf-8').catch(() => '')
      return { id, path, wordCount: countWords(content), meta: cfg.stories[id] ?? {} }
    })
  )

  const map = new Map(stories.map((s) => [s.id, s]))
  const ordered = order.filter((id) => map.has(id)).map((id) => map.get(id)!)
  const rest = stories.filter((s) => !order.includes(s.id)).sort((a, b) => a.id.localeCompare(b.id))
  return [...ordered, ...rest]
}

// ─── Story CRUD ───────────────────────────────────────────────────────────────

export async function readStory(filePath: string): Promise<string> {
  assertInCollection(filePath)
  return readFile(filePath, 'utf-8')
}

export async function writeStory(filePath: string, content: string): Promise<void> {
  assertInCollection(filePath)
  await writeFile(filePath, content, 'utf-8')
}

export async function createStory(name: string): Promise<{ id: string; path: string }> {
  const id = name
  const path = join(getCollectionRoot(), `${name}.md`)
  assertInCollection(path)
  await writeFile(path, '', 'utf-8')
  return { id, path }
}

export async function renameStory(oldPath: string, newName: string): Promise<string> {
  assertInCollection(oldPath)
  const newPath = join(getCollectionRoot(), `${newName}.md`)
  assertInCollection(newPath)
  await fsRename(oldPath, newPath)
  // Update meta key
  const cfg = await readConfig()
  const oldId = basename(oldPath, '.md')
  if (cfg.stories[oldId]) {
    cfg.stories[newName] = cfg.stories[oldId]
    delete cfg.stories[oldId]
    await writeConfig(cfg)
  }
  return newPath
}

export async function deleteStory(filePath: string): Promise<void> {
  assertInCollection(filePath)
  await rm(filePath, { force: true })
  const id = basename(filePath, '.md')
  const cfg = await readConfig()
  delete cfg.stories[id]
  await writeConfig(cfg)
}

// ─── Session ──────────────────────────────────────────────────────────────────

export async function readSession(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(sessionFile(), 'utf-8'))
  } catch {
    return {}
  }
}

export async function writeSession(data: Record<string, unknown>): Promise<void> {
  await mkdir(borgesDir(), { recursive: true })
  await writeFile(sessionFile(), JSON.stringify(data), 'utf-8')
}

// ─── Markets ──────────────────────────────────────────────────────────────────

export async function listMarkets(): Promise<Market[]> {
  try {
    return JSON.parse(await readFile(marketsFile(), 'utf-8'))
  } catch {
    return []
  }
}

export async function saveMarkets(markets: Market[]): Promise<void> {
  await mkdir(borgesDir(), { recursive: true })
  await writeFile(marketsFile(), JSON.stringify(markets, null, 2), 'utf-8')
}

export async function upsertMarket(market: Market): Promise<void> {
  const markets = await listMarkets()
  const idx = markets.findIndex((m) => m.id === market.id)
  if (idx === -1) markets.push(market)
  else markets[idx] = market
  await saveMarkets(markets)
}

export async function deleteMarket(id: string): Promise<void> {
  const markets = await listMarkets()
  await saveMarkets(markets.filter((m) => m.id !== id))
}

// ─── Submissions ──────────────────────────────────────────────────────────────

export async function listSubmissions(): Promise<Submission[]> {
  try {
    return JSON.parse(await readFile(submissionsFile(), 'utf-8'))
  } catch {
    return []
  }
}

export async function saveSubmissions(subs: Submission[]): Promise<void> {
  await mkdir(borgesDir(), { recursive: true })
  await writeFile(submissionsFile(), JSON.stringify(subs, null, 2), 'utf-8')
}

export async function addSubmission(sub: Submission): Promise<void> {
  const subs = await listSubmissions()
  subs.push(sub)
  await saveSubmissions(subs)
}

export async function updateSubmission(id: string, updates: Partial<Submission>): Promise<void> {
  const subs = await listSubmissions()
  const idx = subs.findIndex((s) => s.id === id)
  if (idx === -1) throw new Error('Submission not found')
  subs[idx] = { ...subs[idx], ...updates }
  await saveSubmissions(subs)
}

// ─── Revisions ────────────────────────────────────────────────────────────────

function storySlug(filePath: string): string {
  return basename(filePath, '.md').replace(/[^a-zA-Z0-9_-]/g, '_')
}

function shortId(): string {
  return Math.random().toString(36).slice(2, 7)
}

export async function saveRevision(filePath: string, content: string): Promise<void> {
  assertInCollection(filePath)
  const slug = storySlug(filePath)
  const dir = join(revisionsDir(), slug)
  await mkdir(dir, { recursive: true })
  const timestamp = Date.now()
  const id = `${timestamp}_${shortId()}`
  await writeFile(join(dir, `${id}.json`), JSON.stringify({ id, timestamp, wordCount: countWords(content), content }), 'utf-8')
  const entries = (await readdir(dir)).filter((e) => e.endsWith('.json')).sort()
  if (entries.length > MAX_REVISIONS) {
    await Promise.all(entries.slice(0, entries.length - MAX_REVISIONS).map((f) => unlink(join(dir, f))))
  }
}

export async function listRevisions(filePath: string): Promise<RevisionMeta[]> {
  assertInCollection(filePath)
  const slug = storySlug(filePath)
  const dir = join(revisionsDir(), slug)
  try {
    const entries = (await readdir(dir)).filter((e) => e.endsWith('.json')).sort().reverse()
    return Promise.all(
      entries.map(async (f) => {
        const raw = JSON.parse(await readFile(join(dir, f), 'utf-8'))
        return { id: raw.id, timestamp: raw.timestamp, wordCount: raw.wordCount }
      })
    )
  } catch {
    return []
  }
}

export async function loadRevision(filePath: string, revisionId: string): Promise<string> {
  assertInCollection(filePath)
  if (!/^[\w-]+$/.test(revisionId)) throw new Error('Invalid revision ID')
  const slug = storySlug(filePath)
  const revPath = join(revisionsDir(), slug, `${revisionId}.json`)
  const raw = JSON.parse(await readFile(revPath, 'utf-8'))
  return raw.content
}
