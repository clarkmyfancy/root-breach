export type WalkthroughAction = 'typedCommand' | 'compiled';

export interface WalkthroughCompletionState {
  terminalInput: boolean;
  compileButton: boolean;
}

export interface WalkthroughSlice {
  walkthroughActive: boolean;
  walkthroughStep: number;
  walkthroughCompletion: WalkthroughCompletionState;
}

const LAST_WALKTHROUGH_STEP = 3;

const emptyWalkthroughCompletion: WalkthroughCompletionState = {
  terminalInput: false,
  compileButton: false,
};

export const defaultWalkthroughSlice: WalkthroughSlice = {
  walkthroughActive: false,
  walkthroughStep: 0,
  walkthroughCompletion: emptyWalkthroughCompletion,
};

function isStepAutoCompleted(step: number, completion: WalkthroughCompletionState): boolean {
  if (step === 1) {
    return completion.terminalInput;
  }
  if (step === 2) {
    return completion.compileButton;
  }
  return false;
}

function getNextWalkthroughStep(step: number, completion: WalkthroughCompletionState): number {
  let next = step + 1;
  while (next <= LAST_WALKTHROUGH_STEP && isStepAutoCompleted(next, completion)) {
    next += 1;
  }
  return next;
}

export function createWalkthroughForLevel(levelId: string, seenLevel1Walkthrough: boolean): WalkthroughSlice {
  if (levelId !== 'level1' || seenLevel1Walkthrough) {
    return defaultWalkthroughSlice;
  }
  return {
    walkthroughActive: true,
    walkthroughStep: 0,
    walkthroughCompletion: emptyWalkthroughCompletion,
  };
}

export function advanceWalkthrough(slice: WalkthroughSlice): WalkthroughSlice | null {
  if (!slice.walkthroughActive) {
    return slice;
  }

  if (slice.walkthroughStep >= LAST_WALKTHROUGH_STEP) {
    return null;
  }

  const nextStep = getNextWalkthroughStep(slice.walkthroughStep, slice.walkthroughCompletion);
  if (nextStep > LAST_WALKTHROUGH_STEP) {
    return null;
  }

  return {
    ...slice,
    walkthroughStep: nextStep,
  };
}

export function retreatWalkthrough(slice: WalkthroughSlice): WalkthroughSlice {
  if (!slice.walkthroughActive) {
    return slice;
  }

  let prev = Math.max(0, slice.walkthroughStep - 1);
  while (prev > 0 && isStepAutoCompleted(prev, slice.walkthroughCompletion)) {
    prev -= 1;
  }

  return {
    ...slice,
    walkthroughStep: prev,
  };
}

export function applyWalkthroughAction(slice: WalkthroughSlice, action: WalkthroughAction): WalkthroughSlice | null {
  if (!slice.walkthroughActive) {
    return slice;
  }

  const nextCompletion: WalkthroughCompletionState = {
    terminalInput: slice.walkthroughCompletion.terminalInput || action === 'typedCommand',
    compileButton: slice.walkthroughCompletion.compileButton || action === 'compiled',
  };

  let nextStep = slice.walkthroughStep;
  const actionStep = action === 'typedCommand' ? 1 : 2;
  if (slice.walkthroughStep === actionStep && isStepAutoCompleted(actionStep, nextCompletion)) {
    nextStep = getNextWalkthroughStep(slice.walkthroughStep, nextCompletion);
  }

  if (nextStep > LAST_WALKTHROUGH_STEP) {
    return null;
  }

  return {
    walkthroughActive: true,
    walkthroughStep: nextStep,
    walkthroughCompletion: nextCompletion,
  };
}
