import { join } from 'path'
import { homedir } from 'os'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

export interface AIProviderConfig {
  baseURL?: string
  model?: string
  promptModel?: string
}

export interface GlobalConfig {
  apiKey?: string
  collectionPath?: string
  fontSize?: number
  theme?: 'dark' | 'light'
  defaultWordCountTarget?: number
  ai?: AIProviderConfig
}

const CONFIG_DIR = join(homedir(), '.borges')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

function loadFromDisk(): GlobalConfig {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

let _config: GlobalConfig = loadFromDisk()

export const getCollectionRoot = (): string =>
  _config.collectionPath ?? join(homedir(), 'Documents', 'borges-collection')

export const getApiKey = (): string | undefined =>
  _config.apiKey ?? process.env.ANTHROPIC_API_KEY

export const getAIConfig = (): AIProviderConfig =>
  _config.ai ?? {}

export function readGlobalConfig(): GlobalConfig {
  return { ..._config }
}

export function writeGlobalConfig(updates: Partial<GlobalConfig>): void {
  _config = { ..._config, ...updates }
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(_config, null, 2), 'utf-8')
}
