import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { getApiKey, getAIConfig } from './globalConfig'
import type { Market } from './fileSystem'

export type AnalysisMode = 'compression' | 'ending' | 'tone' | 'market_fit' | 'chat'

export interface AIPayload {
  mode: AnalysisMode
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

const DEFAULT_MODEL = 'claude-sonnet-4-6'
const DEFAULT_PROMPT_MODEL = 'claude-haiku-4-5-20251001'

let _anthropic: Anthropic | null = null
let _openai: OpenAI | null = null

export function resetClient(): void {
  _anthropic = null
  _openai = null
}

function isCustomProvider(): boolean {
  return !!getAIConfig().baseURL
}

function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    const apiKey = getApiKey()
    if (!apiKey || apiKey === 'your-api-key-here') {
      throw new Error('API key not set. Open Borges → Preferences to configure it.')
    }
    console.log('[aiService] provider: Anthropic (default)')
    _anthropic = new Anthropic({ apiKey })
  }
  return _anthropic
}

function getOpenAIClient(): OpenAI {
  if (!_openai) {
    const apiKey = getApiKey()
    if (!apiKey || apiKey === 'your-api-key-here') {
      throw new Error('API key not set. Open Borges → Preferences to configure it.')
    }
    const { baseURL } = getAIConfig()
    console.log('[aiService] provider: OpenAI-compatible, baseURL:', baseURL)
    _openai = new OpenAI({ apiKey, baseURL })
  }
  return _openai
}

function buildSystemPrompt(payload: AIPayload): string {
  const wordConstraint = payload.wordCountTarget
    ? `The target word count is ${payload.wordCountTarget} words.`
    : ''

  const collectionSection =
    payload.useCollectionContext && payload.collectionContext
      ? `\n\n=== COLLECTION CONTEXT ===\n${payload.collectionContext}\n=== END COLLECTION CONTEXT ===`
      : ''

  const marketSection =
    payload.useMarketBrief && payload.targetMarket
      ? `\n\n=== MARKET BRIEF: ${payload.targetMarket.name} ===\nWord count range: ${payload.targetMarket.wordCountMin ?? 0}–${payload.targetMarket.wordCountMax}\nSimultaneous subs allowed: ${payload.targetMarket.simultaneousSubs}\nGenres: ${payload.targetMarket.genres.join(', ')}\n${payload.targetMarket.notes ? `Notes: ${payload.targetMarket.notes}` : ''}\n=== END MARKET BRIEF ===`
      : ''

  const storyBlock = `\n\n=== STORY ===\n${payload.storyContent}\n=== END STORY ===`

  const modeInstructions: Record<AnalysisMode, string> = {
    chat: 'You are a literary editor helping with flash fiction. Answer questions about the story — craft, compression, character, market fit, or anything else the writer asks. Be specific and cite exact passages.',

    compression: `You are a flash fiction editor specializing in compression. Identify every sentence, clause, or phrase carrying redundant or low-yield content. Flag passive constructions, hedging adverbs, and over-explained beats.

For each issue, use this EXACT format:
ISSUE: Compression
PASSAGE: "[exact verbatim text from the story]"
PROBLEM: [one sentence explaining what is bloated]
SUGGESTION: "[rewritten tighter version]"

Be rigorous — flash fiction tolerates no fat. List every instance, then give a brief summary.`,

    ending: `You are a flash fiction editor evaluating the story's ending. Look at the final paragraph (or final sentence for very short pieces).

Evaluate:
- Is the weight right? Does it carry the emotional/thematic load of everything before it?
- Is it earned? Does the story build toward this moment?
- Does it close, open, or pivot — and is that the right choice for this story?

Write a prose critique of 150–300 words. No annotation format — this is a direct assessment. Be honest about what isn't working and concrete about what would.`,

    tone: `You are a flash fiction editor mapping tonal register. First, identify the dominant tone of the piece (e.g., dread, irony, tenderness, menace, melancholy). Then find every sentence that drifts out of that tone.

For each outlier, use this EXACT format:
ISSUE: Tone drift
PASSAGE: "[exact verbatim text from the story]"
PROBLEM: [one sentence: how does this sentence break the tonal register?]
SUGGESTION: "[rewritten version that holds the dominant tone]"

List all outliers, then name the dominant tone in a single closing sentence.`,

    market_fit: `You are a literary submissions editor. Evaluate how well this flash fiction piece fits the target market described in the Market Brief above.

Provide:
1. A brief qualitative assessment (2–3 sentences): what aspects of the piece align with this market's aesthetic, and what works against it?
2. Two or three specific, actionable suggestions for bringing the piece closer to what this market publishes.

Be candid. If the fit is poor, say so plainly.`
  }

  return `You are an expert flash fiction editor. ${wordConstraint}${collectionSection}${marketSection}${storyBlock}\n\n${modeInstructions[payload.mode]}`
}

export async function streamPrompt(onChunk: (chunk: string) => void): Promise<void> {
  const { promptModel } = getAIConfig()
  const promptText = 'Generate a single flash fiction writing prompt in one sentence (under 25 words). Be specific and evocative — give a concrete situation, image, or constraint. No preamble, no label, just the prompt itself.'

  if (isCustomProvider()) {
    const client = getOpenAIClient()
    const stream = await client.chat.completions.create({
      model: promptModel ?? 'default',
      max_tokens: 120,
      stream: true,
      messages: [{ role: 'user', content: promptText }]
    })
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content
      if (text) onChunk(text)
    }
  } else {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: promptModel ?? DEFAULT_PROMPT_MODEL,
      max_tokens: 120,
      messages: [{ role: 'user', content: promptText }]
    })
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        onChunk(chunk.delta.text)
      }
    }
    await stream.finalMessage()
  }
}

export async function streamMessage(
  payload: AIPayload,
  onChunk: (chunk: string) => void
): Promise<void> {
  const { model } = getAIConfig()
  const system = buildSystemPrompt(payload)
  const messages = [
    ...payload.conversationHistory.slice(-10),
    { role: 'user' as const, content: payload.userMessage }
  ]

  if (isCustomProvider()) {
    const client = getOpenAIClient()
    const stream = await client.chat.completions.create({
      model: model ?? 'default',
      max_tokens: 4096,
      stream: true,
      messages: [{ role: 'system', content: system }, ...messages]
    })
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content
      if (text) onChunk(text)
    }
  } else {
    const client = getAnthropicClient()
    const stream = client.messages.stream({
      model: model ?? DEFAULT_MODEL,
      max_tokens: 4096,
      system,
      messages
    })
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        onChunk(chunk.delta.text)
      }
    }
    await stream.finalMessage()
  }
}
