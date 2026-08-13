'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { decideRestart, MAX_RESTARTS_PER_WINDOW, RESTART_WINDOW_MS, RESTART_DELAY_MS, HEALTHY_RUN_MS } = require('../restartpolicy.js');

function state(overrides) {
  return Object.assign({ intentional: false, now: 0, attempts: 0, windowStart: 0, ranForMs: 0 }, overrides);
}

// Replay a series of crashes through the policy the way node_helper does:
// carry attempts/windowStart forward and advance the clock by the delay the
// policy asked for plus however long the next process survived.
function replay(crashes) {
  let now = 0;
  let attempts = 0;
  let windowStart = 0;
  const decisions = [];

  for (const ranForMs of crashes) {
    const decision = decideRestart({ intentional: false, now: now, attempts: attempts, windowStart: windowStart, ranForMs: ranForMs });
    decisions.push(decision);
    attempts = decision.attempts;
    windowStart = decision.windowStart;
    now += decision.delayMs + ranForMs;
  }

  return { decisions: decisions, attempts: attempts, windowStart: windowStart, now: now };
}

test('a normal crash triggers a restart', () => {
  const decision = decideRestart(state({ ranForMs: 1000 }));
  assert.strictEqual(decision.action, 'restart');
  assert.strictEqual(decision.attempts, 1);
  assert.strictEqual(decision.delayMs, RESTART_DELAY_MS);
  assert.strictEqual(decision.throttled, false);
});

test('repeated instant failures stop retrying once the window budget is spent', () => {
  // The camera device is gone, so every start fails within a second.
  const { decisions } = replay(new Array(MAX_RESTARTS_PER_WINDOW + 2).fill(1000));

  const quick = decisions.slice(0, MAX_RESTARTS_PER_WINDOW);
  assert.deepStrictEqual(
    quick.map(d => d.throttled),
    new Array(MAX_RESTARTS_PER_WINDOW).fill(false),
    'the first restarts of a window are immediate retries',
  );
  assert.deepStrictEqual(
    quick.map(d => d.attempts),
    quick.map((_d, i) => i + 1),
    'each retry consumes one unit of the budget',
  );

  const spent = decisions[MAX_RESTARTS_PER_WINDOW];
  assert.strictEqual(spent.action, 'restart', 'we never give up permanently');
  assert.strictEqual(spent.throttled, true, 'but we stop hammering once the budget is spent');
  assert.ok(spent.delayMs > RESTART_DELAY_MS, 'the back-off waits far longer than a normal restart');
  assert.strictEqual(spent.attempts, MAX_RESTARTS_PER_WINDOW, 'the counter must not grow past the cap');

  // The replay advanced the clock by that back-off, so the window has passed.
  const recovered = decisions[MAX_RESTARTS_PER_WINDOW + 1];
  assert.strictEqual(recovered.throttled, false, 'the module retries normally again once the window elapsed');
  assert.strictEqual(recovered.attempts, 1);
  assert.strictEqual(recovered.delayMs, RESTART_DELAY_MS);
});

test('the back-off waits out the rest of the window, never longer', () => {
  const windowStart = 1000;
  const now = windowStart + 60000;
  const decision = decideRestart(state({ now: now, windowStart: windowStart, attempts: MAX_RESTARTS_PER_WINDOW, ranForMs: 100 }));

  assert.strictEqual(decision.throttled, true);
  assert.strictEqual(decision.delayMs, RESTART_WINDOW_MS - 60000);
  assert.strictEqual(decision.windowStart, windowStart, 'the window is not extended by the back-off');
});

test('a spent budget recovers once the window has elapsed', () => {
  const windowStart = 5000;
  const decision = decideRestart(state({ now: windowStart + RESTART_WINDOW_MS, windowStart: windowStart, attempts: MAX_RESTARTS_PER_WINDOW, ranForMs: 100 }));

  assert.strictEqual(decision.action, 'restart');
  assert.strictEqual(decision.throttled, false, 'a fresh window means normal quick retries again');
  assert.strictEqual(decision.attempts, 1, 'the budget starts over');
  assert.strictEqual(decision.delayMs, RESTART_DELAY_MS);
  assert.strictEqual(decision.windowStart, windowStart + RESTART_WINDOW_MS, 'a new window opens at the current time');
});

test('a brief camera outage does not disable recognition for the rest of the uptime', () => {
  // The camera broker is away for ~30s: every start fails instantly, so the
  // budget is spent. It comes back during the back-off, and the module must
  // restart on its own without any human intervention.
  const outage = replay(new Array(MAX_RESTARTS_PER_WINDOW + 1).fill(1000));
  const last = outage.decisions[outage.decisions.length - 1];
  assert.strictEqual(last.throttled, true);

  const afterBackoff = decideRestart(state({ now: outage.now, attempts: outage.attempts, windowStart: outage.windowStart, ranForMs: 1000 }));
  assert.strictEqual(afterBackoff.action, 'restart', 'recognition gets another chance');
  assert.strictEqual(afterBackoff.throttled, false);
  assert.strictEqual(afterBackoff.attempts, 1);
});

test('a sustained healthy run resets the budget', () => {
  const decision = decideRestart(state({ now: 1000, windowStart: 0, attempts: MAX_RESTARTS_PER_WINDOW, ranForMs: HEALTHY_RUN_MS }));
  assert.strictEqual(decision.action, 'restart');
  assert.strictEqual(decision.throttled, false);
  assert.strictEqual(decision.attempts, 1);
  assert.strictEqual(decision.windowStart, 1000, 'the healthy run also opens a new window');
});

test('a run just below the healthy threshold does not reset the budget', () => {
  const decision = decideRestart(state({ now: 1000, windowStart: 0, attempts: 2, ranForMs: HEALTHY_RUN_MS - 1 }));
  assert.strictEqual(decision.action, 'restart');
  assert.strictEqual(decision.attempts, 3);
});

test('a slow crash loop never exhausts the budget', () => {
  const { decisions } = replay(new Array(MAX_RESTARTS_PER_WINDOW * 5).fill(HEALTHY_RUN_MS * 60));
  for (const decision of decisions) {
    assert.strictEqual(decision.action, 'restart');
    assert.strictEqual(decision.throttled, false);
    assert.strictEqual(decision.attempts, 1);
  }
});

test('a hard crash loop is rate limited instead of spinning', () => {
  // 100 instant failures in a row. Each window allows the quick budget plus the
  // single restart that ends the back-off, so the sustained rate must stay just
  // above the budget - and 100 failures must take hours, not seconds.
  const { decisions, now } = replay(new Array(100).fill(200));
  const windows = now / RESTART_WINDOW_MS;
  const restarts = decisions.filter(d => d.action === 'restart').length;
  const perWindow = restarts / windows;

  // Steady state is the budget plus the one restart that ends each back-off;
  // the extra allowance covers the truncated last window of the replay.
  assert.ok(perWindow <= MAX_RESTARTS_PER_WINDOW + 2, 'restarts per window stay at the budget, got ' + perWindow);
  assert.ok(now > 10 * RESTART_WINDOW_MS, 'a hard crash loop is spread over many windows, took ' + Math.round(now / 60000) + ' minutes');
});

test('a deliberate shutdown does not restart', () => {
  const decision = decideRestart(state({ intentional: true, ranForMs: 10 }));
  assert.strictEqual(decision.action, 'none');
  assert.strictEqual(decision.delayMs, 0);
});

test('a deliberate shutdown does not consume or reset the budget', () => {
  const decision = decideRestart(state({ intentional: true, now: 90000, windowStart: 1000, attempts: 3, ranForMs: HEALTHY_RUN_MS }));
  assert.strictEqual(decision.action, 'none');
  assert.strictEqual(decision.attempts, 3);
  assert.strictEqual(decision.windowStart, 1000);
});

test('custom limits override the defaults', () => {
  const limits = { maxRestarts: 2, windowMs: 1000, healthyRunMs: 100, restartDelayMs: 7 };

  assert.deepStrictEqual(decideRestart(state({ now: 10, attempts: 1, ranForMs: 10 }), limits), {
    action: 'restart',
    attempts: 2,
    windowStart: 0,
    delayMs: 7,
    throttled: false,
  });
  assert.strictEqual(decideRestart(state({ now: 10, attempts: 2, ranForMs: 10 }), limits).throttled, true);
  assert.strictEqual(decideRestart(state({ now: 10, attempts: 2, ranForMs: 100 }), limits).throttled, false, 'a healthy run beats the cap');
  assert.strictEqual(decideRestart(state({ now: 1000, attempts: 2, ranForMs: 10 }), limits).throttled, false, 'an elapsed window beats the cap');
});

test('missing state fields are treated as a first crash', () => {
  const decision = decideRestart({});
  assert.strictEqual(decision.action, 'restart');
  assert.strictEqual(decision.attempts, 1);
  assert.strictEqual(decision.throttled, false);
});
