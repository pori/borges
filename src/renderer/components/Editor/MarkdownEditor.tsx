import { useEffect, useRef, useState } from 'react'
import { EditorView, keymap, Decoration, type DecorationSet, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { EditorState, StateField, StateEffect, RangeSetBuilder, Compartment } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { history, defaultKeymap, historyKeymap } from '@codemirror/commands'
import { search, searchKeymap } from '@codemirror/search'
import { useBorgesStore } from '../../store/borgesStore'
import type { TextAnnotation } from '../../types/borges'
import { WordCountBar } from './WordCountBar'

export const setAnnotationsEffect = StateEffect.define<TextAnnotation[]>()

const annField = StateField.define<TextAnnotation[]>({
  create: () => [],
  update(anns, tr) {
    for (const e of tr.effects) if (e.is(setAnnotationsEffect)) return e.value
    return anns
  }
})

function annDecorations(anns: TextAnnotation[], doc: { toString(): string }): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const text = doc.toString()
  const sorted = anns
    .filter((a) => a.passage)
    .map((a) => {
      const from = text.indexOf(a.passage!)
      return from !== -1 ? { from, to: from + a.passage!.length, id: a.id } : null
    })
    .filter(Boolean)
    .sort((a, b) => a!.from - b!.from) as { from: number; to: number; id: string }[]

  for (const { from, to, id } of sorted) {
    if (from < to) builder.add(from, to, Decoration.mark({ class: 'ann-highlight', attributes: { 'data-ann-id': id } }))
  }
  return builder.finish()
}


const annPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet
  constructor(view: EditorView) { this.decorations = annDecorations(view.state.field(annField), view.state.doc) }
  update(update: ViewUpdate): void {
    if (update.docChanged || update.transactions.some(t => t.effects.some(e => e.is(setAnnotationsEffect)))) {
      this.decorations = annDecorations(update.state.field(annField), update.state.doc)
    }
  }
}, { decorations: v => v.decorations })


const themeCompartment = new Compartment()
const fontSizeCompartment = new Compartment()

function buildTheme(fontSize: number, isDark: boolean, hasPrompt = false): ReturnType<typeof EditorView.theme> {
  return EditorView.theme({
    '&': { height: '100%', background: 'transparent' },
    '.cm-scroller': { fontFamily: 'Georgia, "Times New Roman", serif', fontSize: `${fontSize}px`, lineHeight: '1.85', overflow: 'auto' },
    '.cm-content': { maxWidth: '680px', margin: '0 auto', padding: `${hasPrompt ? '24px' : '48px'} 24px 24px`, caretColor: 'var(--accent)' },
    '.cm-line': { padding: '0' },
    '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
    '.cm-selectionBackground': { background: 'rgba(200,169,110,0.25)' },
    '&.cm-focused .cm-selectionBackground': { background: 'rgba(200,169,110,0.35)' },
    '.cm-gutters': { display: 'none' },
    '.cm-placeholder': { color: 'var(--text3)', fontStyle: 'italic' },
  }, { dark: isDark })
}

const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: '700', fontSize: '1.3em' },
  { tag: tags.heading2, fontWeight: '700', fontSize: '1.15em' },
  { tag: tags.heading3, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.link, color: 'var(--accent)' },
  { tag: tags.url, color: 'var(--accent)', opacity: 0.7 },
  { tag: tags.comment, color: 'var(--text3)' },
])

export function MarkdownEditor(): JSX.Element {
  const { activeStoryPath, activeStoryContent, activeStoryId,
    annotations, theme, fontSize, revisionPanelOpen, toggleRevisionPanel, revisions, setRevisions } = useBorgesStore()
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const lastPathRef = useRef<string | null>(null)
  const storeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [storyPrompt, setStoryPrompt] = useState<string | null>(null)


  // Initialize editor
  useEffect(() => {
    if (!editorRef.current) return
    const isDark = theme === 'dark'
    const { activeStoryContent, activeStoryPath } = useBorgesStore.getState()
    lastPathRef.current = activeStoryPath

    const view = new EditorView({
      state: EditorState.create({
        doc: activeStoryContent,
        extensions: [
          history(),
          markdown(),
          syntaxHighlighting(markdownHighlight),
          search({ top: true }),
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
          annField,
          annPlugin,
          themeCompartment.of(buildTheme(fontSize, isDark)),
          fontSizeCompartment.of([]),
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const content = update.state.doc.toString()
              if (storeTimerRef.current) clearTimeout(storeTimerRef.current)
              storeTimerRef.current = setTimeout(() => {
                useBorgesStore.getState().setContent(content)
              }, 300)
            }
          }),
          EditorView.domEventHandlers({
            contextmenu: (e) => {
              e.preventDefault()
              window.api.showEditorContextMenu()
            },
            keydown: (e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault()
                useBorgesStore.getState().markSaved()
                const { activeStoryPath, activeStoryContent } = useBorgesStore.getState()
                if (activeStoryPath) {
                  window.api.writeStory(activeStoryPath, activeStoryContent).then(() =>
                    window.api.saveRevision(activeStoryPath, activeStoryContent)
                  ).then(async () => {
                    const revs = await window.api.listRevisions(activeStoryPath)
                    useBorgesStore.getState().setRevisions(revs)
                  })
                }
              }
            }
          })
        ]
      }),
      parent: editorRef.current
    })
    viewRef.current = view
    return () => { view.destroy(); viewRef.current = null }
  }, [])

  // Sync content when active story changes
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (activeStoryPath !== lastPathRef.current) {
      lastPathRef.current = activeStoryPath
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: activeStoryContent } })
      view.dispatch({ effects: setAnnotationsEffect.of([]) })
      // Load revisions
      if (activeStoryPath) {
        window.api.listRevisions(activeStoryPath).then(setRevisions)
      }
    }
  }, [activeStoryPath, activeStoryContent, setRevisions])

  // Load prompt from meta when story changes
  useEffect(() => {
    if (!activeStoryId) { setStoryPrompt(null); return }
    window.api.getStoryMeta(activeStoryId).then((meta) => {
      setStoryPrompt(meta.prompt ?? null)
    }).catch(() => setStoryPrompt(null))
  }, [activeStoryId])

  // Sync annotations into editor
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({ effects: setAnnotationsEffect.of(annotations) })
  }, [annotations])

  // Update theme
  useEffect(() => {
    viewRef.current?.dispatch({ effects: themeCompartment.reconfigure(buildTheme(fontSize, theme === 'dark', !!storyPrompt)) })
  }, [theme, fontSize, storyPrompt])

  if (!activeStoryId) {
    return <div className="no-story-placeholder">Select a story or create a new one</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <WordCountBar />
      {storyPrompt && (
        <div className="story-prompt-banner">
          <div className="story-prompt-banner-inner">
            <span className="story-prompt-banner-label">Prompt</span>
            {storyPrompt}
          </div>
        </div>
      )}
      <div
        style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
        onMouseDown={(e) => {
          const view = viewRef.current
          if (!view) return
          const target = e.target as Element
          // Let clicks directly on text content (inside a line) be handled natively
          if (target.closest('.cm-line')) return
          const pos = view.posAtCoords({ x: e.clientX, y: e.clientY }, false)
          if (pos !== null) {
            view.dispatch({ selection: { anchor: pos } })
            view.focus()
            e.preventDefault()
          }
        }}
      >
        <div ref={editorRef} style={{ height: '100%' }} />
        {revisionPanelOpen && activeStoryPath && (
          <RevisionPanel
            path={activeStoryPath}
            revisions={revisions}
            onClose={toggleRevisionPanel}
            onRestore={async (content) => {
              const view = viewRef.current
              if (view) {
                view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } })
              }
              useBorgesStore.getState().setContent(content)
            }}
          />
        )}
      </div>
    </div>
  )
}

// ─── Inline Revision Panel ────────────────────────────────────────────────────
import type { RevisionMeta } from '../../types/borges'

interface RevisionPanelProps {
  path: string
  revisions: RevisionMeta[]
  onClose: () => void
  onRestore: (content: string) => void
}

function RevisionPanel({ path, revisions, onClose, onRestore }: RevisionPanelProps): JSX.Element {
  const formatTime = (ts: number): string => {
    const d = new Date(ts)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="revision-panel">
      <div className="revision-header">
        <span className="revision-header-title">Revision History</span>
        <button className="revision-close" onClick={onClose}>✕</button>
      </div>
      <div className="revision-list">
        {revisions.length === 0 && <div style={{ padding: '12px', fontSize: '13px', color: 'var(--text3)' }}>No revisions yet. Save to create one.</div>}
        {revisions.map((rev) => (
          <div key={rev.id} className="revision-item" onClick={async () => {
            const content = await window.api.loadRevision(path, rev.id)
            onRestore(content)
          }}>
            <div className="revision-item-time">{formatTime(rev.timestamp)}</div>
            <div className="revision-item-wc">{rev.wordCount.toLocaleString()} words</div>
          </div>
        ))}
      </div>
    </div>
  )
}
