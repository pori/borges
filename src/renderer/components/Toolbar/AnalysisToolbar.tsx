import { useBorgesStore } from '../../store/borgesStore'

type AnalysisModeAI = 'compression' | 'ending' | 'tone' | 'market_fit' | 'chat'

const MODES: { mode: AnalysisModeAI; label: string; title: string }[] = [
  { mode: 'compression', label: 'Compression', title: 'Find redundancy, hedging, and low-yield content' },
  { mode: 'ending', label: 'Ending', title: 'Evaluate the final paragraph' },
  { mode: 'tone', label: 'Tone', title: 'Map tonal register and flag outliers' },
  { mode: 'market_fit', label: 'Market fit', title: 'Evaluate fit against selected market' },
]

export function AnalysisToolbar(): JSX.Element {
  const { analysisMode, setAnalysisMode, clearAnnotations, activeStoryId,
    useCollectionContext, toggleCollectionContext, useMarketBrief, toggleMarketBrief, selectedMarketId,
    isAILoading, activeStoryContent, activeStoryPath, addUserMessage, startAssistantMessage,
    appendToLastMessage, setAILoading, setAIError, setAnnotations, setChatOpen, markets
  } = useBorgesStore()

  const selectedMarket = markets.find((m) => m.id === selectedMarketId)

  const runAnalysis = async (mode: AnalysisModeAI): Promise<void> => {
    if (!activeStoryId || !activeStoryPath || isAILoading) return

    const story = useBorgesStore.getState().stories.find((s) => s.id === activeStoryId)
    const cfg = await window.api.getCollectionConfig()

    if (analysisMode === mode) {
      clearAnnotations()
      return
    }

    setAnalysisMode(mode)
    clearAnnotations()
    setChatOpen(true)

    const modeLabels: Record<AnalysisModeAI | 'none', string> = {
      compression: 'Run compression analysis',
      ending: 'Evaluate the ending',
      tone: 'Map tonal register',
      market_fit: 'Evaluate market fit',
      chat: 'Chat',
      none: ''
    }

    addUserMessage(modeLabels[mode])
    startAssistantMessage()
    setAILoading(true)
    setAIError(null)

    try {
      let fullResponse = ''
      await window.api.streamAIMessage(
        {
          mode,
          storyContent: activeStoryContent,
          storyId: activeStoryId,
          wordCountTarget: story?.meta.wordCountTarget,
          targetMarket: selectedMarket ?? undefined,
          collectionContext: cfg.collectionContext,
          useCollectionContext: useCollectionContext && !!cfg.collectionContext,
          useMarketBrief: useMarketBrief && !!selectedMarket,
          conversationHistory: [],
          userMessage: modeLabels[mode]
        },
        (chunk) => {
          appendToLastMessage(chunk)
          fullResponse += chunk
        }
      )
      // Parse annotations from compression/tone responses
      if (mode === 'compression' || mode === 'tone') {
        const parsed = parseAnnotations(fullResponse, activeStoryContent)
        if (parsed.length > 0) setAnnotations(parsed)
      }
    } catch (err) {
      setAIError(err instanceof Error ? err.message : 'Error')
    } finally {
      setAILoading(false)
    }
  }

  return (
    <div className="analysis-toolbar">
      {MODES.map(({ mode, label, title }) => (
        <button
          key={mode}
          className={`analysis-toolbar-btn${analysisMode === mode ? ' active' : ''}`}
          title={title}
          onClick={() => runAnalysis(mode)}
          disabled={isAILoading || !activeStoryId || (mode === 'market_fit' && !selectedMarketId)}
        >
          {label}
        </button>
      ))}
      <div className="analysis-toolbar-sep" />
      <button
        className={`analysis-toolbar-toggle${useCollectionContext ? ' on' : ''}`}
        onClick={toggleCollectionContext}
        title="Inject collection context into AI prompt"
      >
        <span className="toggle-dot" />
        Collection
      </button>
      <button
        className={`analysis-toolbar-toggle${useMarketBrief && selectedMarketId ? ' on' : ''}`}
        onClick={toggleMarketBrief}
        title="Inject market brief into AI prompt"
        disabled={!selectedMarketId}
      >
        <span className="toggle-dot" />
        Market brief
      </button>
    </div>
  )
}

function parseAnnotations(text: string, doc: string): import('../../types/borges').TextAnnotation[] {
  const annotations: import('../../types/borges').TextAnnotation[] = []
  const blockRe = /ISSUE:[^\n]*\nPASSAGE:\s*"([^"]+)"\nPROBLEM:\s*([^\n]+)(?:\nSUGGESTION:\s*"([^"]*)")?/g
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(text)) !== null) {
    const passage = m[1]?.trim()
    const problem = m[2]?.trim()
    const suggestion = m[3]?.trim()
    if (!passage || !problem) continue
    if (!doc.includes(passage)) continue
    annotations.push({
      id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      passage,
      problem,
      suggestion: suggestion || undefined
    })
  }
  return annotations
}
