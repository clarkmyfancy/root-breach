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

const LAST_WALKTHROUGH_STEP = 6;

const emptyWalkthroughCompletion: WalkthroughCompletionState = {
  terminalInput: false,
  compileButton: false,
};

export const defaultWalkthroughSlice: WalkthroughSlice = {
  walkthroughActive: false,
  walkthroughStep: 0,
  walkthroughCompletion: emptyWalkthroughCompletion,
};

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

  return {
    ...slice,
    walkthroughStep: slice.walkthroughStep + 1,
  };
}

export function retreatWalkthrough(slice: WalkthroughSlice): WalkthroughSlice {
  if (!slice.walkthroughActive) {
    return slice;
  }

  return {
    ...slice,
    walkthroughStep: Math.max(0, slice.walkthroughStep - 1),
  };
}

export function applyWalkthroughAction(slice: WalkthroughSlice, action: WalkthroughAction): WalkthroughSlice | null {
  if (!slice.walkthroughActive) {
    return slice;
  }

  return {
    ...slice,
    walkthroughCompletion: {
      terminalInput: slice.walkthroughCompletion.terminalInput || action === 'typedCommand',
      compileButton: slice.walkthroughCompletion.compileButton || action === 'compiled',
    },
  };
}
