import assert from 'node:assert/strict';
import test from 'node:test';

import {createMissionRequestSlot} from '../public/mission-request-slot.js';

function fakeTimers() {
  let nextHandle = 0;
  const callbacks = new Map();
  return {
    setTimer(callback, milliseconds) {
      const handle = ++nextHandle;
      callbacks.set(handle, {callback, milliseconds});
      return handle;
    },
    clearTimer(handle) {
      callbacks.delete(handle);
    },
    run(handle) {
      const entry = callbacks.get(handle);
      if (!entry) return false;
      callbacks.delete(handle);
      entry.callback();
      return true;
    },
    onlyHandle() {
      assert.equal(callbacks.size, 1);
      return [...callbacks.keys()][0];
    },
  };
}

test('a newer mission request aborts and invalidates its predecessor without clearing the newer owner', () => {
  const timers = fakeTimers();
  const expired = [];
  const slot = createMissionRequestSlot({
    timeoutMs: 500,
    onTimeout: request => expired.push(request.generation),
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });

  const first = slot.begin({projectId: 'project:one', missionId: 'mission:first'});
  const second = slot.begin({projectId: 'project:one', missionId: 'mission:second'});

  assert.equal(first.controller.signal.aborted, true);
  assert.equal(slot.owns(first), false);
  assert.equal(slot.live(first), false);
  assert.equal(slot.owns(second), true);
  assert.equal(slot.live(second), true);
  assert.equal(slot.finish(first), false);
  assert.equal(slot.owns(second), true);
  assert.equal(expired.length, 0);

  assert.equal(slot.finish(second), true);
  assert.equal(slot.current(), null);
});

test('a request deadline releases the slot even if the aborted fetch never settles', () => {
  const timers = fakeTimers();
  const expired = [];
  const slot = createMissionRequestSlot({
    timeoutMs: 500,
    onTimeout: request => expired.push({generation: request.generation, missionId: request.missionId}),
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });

  const stalled = slot.begin({projectId: 'project:one', missionId: 'mission:stalled'});
  assert.equal(timers.run(timers.onlyHandle()), true);
  assert.equal(stalled.timedOut, true);
  assert.equal(stalled.controller.signal.aborted, true);
  assert.equal(slot.current(), null);
  assert.equal(slot.finish(stalled), false);
  assert.deepEqual(expired, [{generation: 1, missionId: 'mission:stalled'}]);

  const recovery = slot.begin({projectId: 'project:one', missionId: 'mission:recovery'});
  assert.equal(recovery.generation, 2);
  assert.equal(slot.live(recovery), true);
});

test('a cancelled request cannot fire a stale timeout after the next request owns the slot', () => {
  const timers = fakeTimers();
  let expirations = 0;
  const slot = createMissionRequestSlot({
    timeoutMs: 500,
    onTimeout: () => { expirations += 1; },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });

  const first = slot.begin({projectId: 'project:one', missionId: 'mission:first'});
  const firstHandle = timers.onlyHandle();
  const second = slot.begin({projectId: 'project:one', missionId: 'mission:second'});

  assert.equal(timers.run(firstHandle), false);
  assert.equal(expirations, 0);
  assert.equal(slot.owns(second), true);
  assert.equal(first.controller.signal.aborted, true);
});
