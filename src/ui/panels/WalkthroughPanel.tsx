interface WalkthroughPanelProps {
  step: number;
  totalSteps: number;
  title: string;
  body: string;
  canGoBack: boolean;
  isLastStep: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}

export function WalkthroughPanel({
  step,
  totalSteps,
  title,
  body,
  canGoBack,
  isLastStep,
  onBack,
  onNext,
  onSkip,
}: WalkthroughPanelProps): JSX.Element {
  return (
    <aside className="walkthrough-card">
      <div className="walkthrough-card__step">
        Walkthrough {step + 1}/{totalSteps}
      </div>
      <h3 className="walkthrough-card__title">{title}</h3>
      <p className="walkthrough-card__body">{body}</p>
      <div className="walkthrough-card__actions">
        <button className="btn" onClick={onSkip}>
          Skip
        </button>
        <button className="btn" onClick={onBack} disabled={!canGoBack}>
          Back
        </button>
        <button className="btn btn-primary" onClick={onNext}>
          {isLastStep ? 'Done' : 'Next'}
        </button>
      </div>
    </aside>
  );
}
