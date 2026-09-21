// Owns exactly one bounded browser request or coherent read batch at a time.
// The caller binds it to project/mission state before accepting a response;
// this slot supplies the cancellation, generation and deadline invariants that
// prevent a stale fetch from becoming the current operator view.

function validTimeout(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= 120_000;
}

function validIdentity(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 512;
}

export function createMissionRequestSlot({
  timeoutMs,
  onTimeout = () => {},
  makeAbortController = () => new AbortController(),
  setTimer = (callback, milliseconds) => globalThis.setTimeout(callback, milliseconds),
  clearTimer = handle => globalThis.clearTimeout(handle),
} = {}) {
  if (!validTimeout(timeoutMs)) throw new TypeError('timeoutMs must be a bounded positive integer.');
  if (typeof onTimeout !== 'function' || typeof makeAbortController !== 'function'
    || typeof setTimer !== 'function' || typeof clearTimer !== 'function') {
    throw new TypeError('Mission request slot requires callable lifecycle dependencies.');
  }

  let current = null;
  let generation = 0;

  function clearDeadline(request) {
    if (request.timeout === null) return;
    clearTimer(request.timeout);
    request.timeout = null;
  }

  function abort(request) {
    clearDeadline(request);
    request.controller.abort();
  }

  function owns(request) {
    return current === request;
  }

  function cancel() {
    const request = current;
    if (!request) return null;
    current = null;
    abort(request);
    return request;
  }

  function begin({projectId, missionId} = {}) {
    if (!validIdentity(projectId) || !validIdentity(missionId)) {
      throw new TypeError('Mission request identity is invalid.');
    }
    cancel();
    const controller = makeAbortController();
    if (!controller || typeof controller.abort !== 'function' || !controller.signal) {
      throw new TypeError('Mission request requires an AbortController-compatible value.');
    }
    const request = {
      generation: ++generation,
      projectId,
      missionId,
      controller,
      timeout: null,
      timedOut: false,
    };
    current = request;
    request.timeout = setTimer(() => {
      if (!owns(request)) return;
      request.timedOut = true;
      // Invalidate before invoking user code. Abort is advisory: a nonsettling
      // fetch can still resolve later, but it no longer owns the UI state.
      current = null;
      request.timeout = null;
      request.controller.abort();
      onTimeout(request);
    }, timeoutMs);
    return request;
  }

  function finish(request) {
    if (!owns(request)) return false;
    current = null;
    clearDeadline(request);
    return true;
  }

  function live(request) {
    return owns(request) && !request.controller.signal.aborted;
  }

  return Object.freeze({
    begin,
    cancel,
    finish,
    owns,
    live,
    current: () => current,
  });
}
