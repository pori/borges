import { join } from 'path'
import { homedir } from 'os'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

export interface GlobalConfig {
  apiKey?: string
  collectionPath?: string
  fontSize?: number
  theme?: 'dark' | 'light'
  defaultWordCountTarget?: number
}

const CONFIG_DIR = join(homedir(), '.borges')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

let _config: GlobalConfig = {}

try {
  _config = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
} catch {
  // first run
}

export const getCollectionRoot = (): string =>
  _config.collectionPath ?? join(homedir(), 'Documents', 'borges-collection')

export const getApiKey = (): string | undefined =>
  _config.apiKey ?? process.env.ANTHROPIC_API_KEY

export function readGlobalConfig(): GlobalConfig {
  return { ..._config }
}

export function writeGlobalConfig(updates: Partial<GlobalConfig>): void {
  _config = { ..._config, ...updates }
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(_config, null, 2), 'utf-8')
}
