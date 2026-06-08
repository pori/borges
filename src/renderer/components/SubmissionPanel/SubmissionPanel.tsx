import { useBorgesStore } from '../../store/borgesStore'
import { StoryTab } from './StoryTab'
import { MarketsTab } from './MarketsTab'

export function SubmissionPanel(): JSX.Element {
  const { submissionPanelTab, setSubmissionPanelTab } = useBorgesStore()

  return (
    <div className="sub-panel">
      <div className="sub-panel-tabs">
        <button
          className={`sub-panel-tab${submissionPanelTab === 'story' ? ' active' : ''}`}
          onClick={() => setSubmissionPanelTab('story')}
        >
          Story
        </button>
        <button
          className={`sub-panel-tab${submissionPanelTab === 'markets' ? ' active' : ''}`}
          onClick={() => setSubmissionPanelTab('markets')}
        >
          Markets
        </button>
      </div>
      <div className="sub-panel-body">
        {submissionPanelTab === 'story' ? <StoryTab /> : <MarketsTab />}
      </div>
    </div>
  )
}
