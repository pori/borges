import { useRef, useEffect, useState } from 'react'
import { useBorgesStore } from '../../store/borgesStore'
import type { ChatMessage, TextAnnotation } from '../../types/borges'
import { marked } from 'marked'

function renderMarkdown(text: string): string {
  try {
    return marked(text) as string
  } catch {
    return text
  }
}

function MessageBubble({ msg }: { msg: ChatMessage }): JSX.Element {
  const isUser = msg.role === 'user'
  return (
    <div className={`chat-message chat-message-${isUser ? 'user' : 'assistant'}`}>
      <div
        className="chat-bubble"
        dangerouslySetInnerHTML={isUser ? undefined : { __html: renderMarkdown(msg.content) }}
      >
        {isUser ? msg.content : undefined}
      </div>
    </div>
  )
}

function parseAnnotationsFromText(text: string, doc: string): TextAnnotation[] {
  const anns: TextAnnotation[] = []
  const re = /ISSUE:[^\n]*\nPASSAGE:\s*"([^"]+)"\nPROBLEM:\s*([^\n]+)(?:\nSUGGESTION:\s*"([^"]*)")?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const passage = m[1]?.trim()
    const problem = m[2]?.trim()
    if (!passage || !problem || !doc.includes(passage)) continue
    anns.push({ id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, passage, problem, suggestion: m[3]?.trim() || undefined })
  }
  return anns
}

export function ChatPanel(): JSX.Element {
  const {
    chatHistory, isAILoading, aiError, activeStoryId, activeStoryContent,
    analysisMode, useCollectionContext, useMarketBrief, selectedMarketId, markets, stories,
    addUserMessage, startAssistantMessage, appendToLastMessage, setAILoading, setAIError,
    newChat, setAnnotations
  } = useBorgesStore()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chatHistory])

  const send = async (): Promise<void> => {
    const text = input.trim()
    if (!text || !activeStoryId || isAILoading) return
    setInput('')

    const story = stories.find((s) => s.id === activeStoryId)
    const selectedMarket = markets.find((m) => m.id === selectedMarketId)
    const cfg = await window.api.getCollectionConfig()

    setAIError(null)
    addUserMessage(text)
    startAssistantMessage()
    setAILoading(true)

    try {
      let full = ''
      await window.api.streamAIMessage(
        {
          mode: analysisMode === 'none' ? 'chat' : analysisMode,
          storyContent: activeStoryContent,
          storyId: activeStoryId,
          wordCountTarget: story?.meta.wordCountTarget,
          targetMarket: selectedMarket ?? undefined,
          collectionContext: cfg.collectionContext,
          useCollectionContext: useCollectionContext && !!cfg.collectionContext,
          useMarketBrief: useMarketBrief && !!selectedMarket,
          conversationHistory: chatHistory.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          userMessage: text
        },
        (chunk) => {
          appendToLastMessage(chunk)
          full += chunk
        }
      )
      if (full.includes('PASSAGE:')) {
        const parsed = parseAnnotationsFromText(full, activeStoryContent)
        if (parsed.length > 0) setAnnotations(parsed)
      }
    } catch (err) {
      setAIError(err instanceof Error ? err.message : 'Error')
    } finally {
      setAILoading(false)
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span className="chat-header-title">AI Chat</span>
        {chatHistory.length > 0 && (
          <button className="chat-new-btn" onClick={newChat} title="New conversation">+ New</button>
        )}
      </div>
      <div className="chat-messages" ref={scrollRef}>
        {!activeStoryId && <p className="chat-placeholder">Open a story to start a conversation.</p>}
        {activeStoryId && chatHistory.length === 0 && (
          <p className="chat-placeholder">Ask anything about this story — craft, compression, character, market fit…</p>
        )}
        {chatHistory.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
        {isAILoading && chatHistory[chatHistory.length - 1]?.content === '' && (
          <div className="chat-typing"><span /><span /><span /></div>
        )}
        {aiError && <div className="chat-error">{aiError}</div>}
      </div>
      <div className="chat-input-area">
        <div className="chat-input-row">
          <textarea
            className="chat-input"
            value={input}
            placeholder={activeStoryId ? 'Message…' : ''}
            disabled={!activeStoryId || isAILoading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
            }}
            rows={1}
          /><button className="chat-send-btn" onClick={send} disabled={!input.trim() || !activeStoryId || isAILoading}>↑</button>
        </div>
      </div>
    </div>
  )
}
