const MIN_CURSOR = 0;
const MAX_CURSOR = 9;
const MAX_PROGRESS = 8;
const MIN_PROGRESS = 0;

function createFishingState(overrides = {}) {
  return {
    progress: overrides.progress ?? 4,
    fishIndex: overrides.fishIndex ?? 4,
    cursor: overrides.cursor ?? 4,
    triggered: overrides.triggered ?? false,
    caught: overrides.caught ?? false,
    escaped: overrides.escaped ?? false,
    turn: overrides.turn ?? 0,
    ...overrides
  };
}

function stepFishingState(state, input = {}, rng = Math.random) {
  const current = createFishingState(state);
  const action = String(input.action || '').toLowerCase();

  let nextCursor = current.cursor;
  if (action === 'move_right') nextCursor = Math.min(MAX_CURSOR, current.cursor + 1);
  if (action === 'move_left') nextCursor = Math.max(MIN_CURSOR, current.cursor - 1);

  let nextFishIndex = current.fishIndex;
  const roll = rng();
  let drift = 0;
  if (roll < 0.33) {
    drift = -1;
  } else if (roll < 0.66) {
    drift = 0;
  } else {
    drift = 1;
  }
  nextFishIndex = Math.max(MIN_CURSOR, Math.min(MAX_CURSOR, current.fishIndex + drift));

  let nextProgress = current.progress;
  let nextTriggered = current.triggered;
  let nextCaught = current.caught;
  let nextEscaped = current.escaped;

  if (!current.triggered) {
    nextTriggered = true;
    nextProgress = Math.min(MAX_PROGRESS, current.progress + 1);
  } else {
    const hit = nextCursor === nextFishIndex;
    if (hit) {
      nextProgress = Math.min(MAX_PROGRESS, current.progress + 1);
    } else {
      nextProgress = Math.max(MIN_PROGRESS, current.progress - 1);
    }
  }

  if (nextProgress <= MIN_PROGRESS) {
    nextEscaped = true;
  }

  if (nextProgress >= MAX_PROGRESS) {
    nextCaught = true;
  }

  return createFishingState({
    ...current,
    progress: nextProgress,
    fishIndex: nextFishIndex,
    cursor: nextCursor,
    triggered: nextTriggered,
    caught: nextCaught,
    escaped: nextEscaped,
    turn: current.turn + 1
  });
}

module.exports = {
  createFishingState,
  stepFishingState,
  MIN_CURSOR,
  MAX_CURSOR,
  MAX_PROGRESS,
  MIN_PROGRESS
};
