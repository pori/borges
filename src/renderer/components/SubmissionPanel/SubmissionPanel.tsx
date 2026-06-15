import { StoryTab } from './StoryTab'

export function SubmissionPanel(): JSX.Element {
  return (
    <div className="sub-panel">
      <div className="sub-panel-header">
        <span className="sub-panel-title">Submissions</span>
      </div>
      <div className="sub-panel-body">
        <StoryTab />
      </div>
    </div>
  )
}
