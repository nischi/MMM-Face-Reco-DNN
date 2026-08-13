'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { decideRestart, MAX_RESTART_ATTEMPTS, RESTART_DELAY_MS, HEALTHY_RUN_MS } = require('../restartpolicy.js');

function state(overrides) {
  return Object.assign({ intentional: false, attempts: 0, ranForMs: 0 }, overrides);
}

test('a normal crash triggers a restart', () => {
  const decision = decideRestart(state({ ranForMs: 1000 }));
  assert.strictEqual(decision.action, 'restart');
  assert.strictEqual(decision.attempts, 1);
  assert.strictEqual(decision.delayMs, RESTART_DELAY_MS);
});

test('consecutive crashes stop at the cap', () => {
  let attempts = 0;
  const actions = [];

  // Crash immediately, over and over: every run is shorter than the healthy threshold.
  for (let i = 0; i < MAX_RESTART_ATTEMPTS + 2; i++) {
    const decision = decideRestart(state({ attempts: attempts, ranForMs: 10 }));
    actions.push(decision.action);
    attempts = decision.attempts;
  }

  assert.deepStrictEqual(actions.slice(0, MAX_RESTART_ATTEMPTS), new Array(MAX_RESTART_ATTEMPTS).fill('restart'), 'the first MAX_RESTART_ATTEMPTS crashes should each be retried');
  assert.deepStrictEqual(actions.slice(MAX_RESTART_ATTEMPTS), ['give-up', 'give-up'], 'once the budget is spent it stays spent');
  assert.strictEqual(attempts, MAX_RESTART_ATTEMPTS, 'the counter must not grow past the cap');
});

test('give-up carries no delay and never becomes a restart again', () => {
  const decision = decideRestart(state({ attempts: MAX_RESTART_ATTEMPTS, ranForMs: 10 }));
  assert.strictEqual(decision.action, 'give-up');
  assert.strictEqual(decision.delayMs, 0);
  assert.strictEqual(decision.attempts, MAX_RESTART_ATTEMPTS);
});

test('a healthy run resets the counter so later crashes get a fresh budget', () => {
  // The process ran fine for a while, then died: this counts as attempt 1 again.
  const decision = decideRestart(state({ attempts: MAX_RESTART_ATTEMPTS, ranForMs: HEALTHY_RUN_MS }));
  assert.strictEqual(decision.action, 'restart');
  assert.strictEqual(decision.attempts, 1);
});

test('a run just below the healthy threshold does not reset the counter', () => {
  const decision = decideRestart(state({ attempts: 2, ranForMs: HEALTHY_RUN_MS - 1 }));
  assert.strictEqual(decision.action, 'restart');
  assert.strictEqual(decision.attempts, 3);
});

test('a slow crash loop never exhausts the budget', () => {
  let attempts = 0;
  for (let i = 0; i < MAX_RESTART_ATTEMPTS * 5; i++) {
    const decision = decideRestart(state({ attempts: attempts, ranForMs: HEALTHY_RUN_MS * 60 }));
    assert.strictEqual(decision.action, 'restart');
    attempts = decision.attempts;
  }
  assert.strictEqual(attempts, 1);
});

test('a deliberate shutdown does not restart', () => {
  const decision = decideRestart(state({ intentional: true, ranForMs: 10 }));
  assert.strictEqual(decision.action, 'none');
  assert.strictEqual(decision.delayMs, 0);
});

test('a deliberate shutdown does not consume or reset the budget', () => {
  const decision = decideRestart(state({ intentional: true, attempts: 3, ranForMs: HEALTHY_RUN_MS }));
  assert.strictEqual(decision.action, 'none');
  assert.strictEqual(decision.attempts, 3);
});

test('custom limits override the defaults', () => {
  const limits = { maxAttempts: 2, healthyRunMs: 100, restartDelayMs: 7 };
  assert.deepStrictEqual(decideRestart(state({ attempts: 1, ranForMs: 10 }), limits), { action: 'restart', attempts: 2, delayMs: 7 });
  assert.strictEqual(decideRestart(state({ attempts: 2, ranForMs: 10 }), limits).action, 'give-up');
  assert.strictEqual(decideRestart(state({ attempts: 2, ranForMs: 100 }), limits).action, 'restart');
});

test('missing state fields are treated as a first crash', () => {
  const decision = decideRestart({});
  assert.strictEqual(decision.action, 'restart');
  assert.strictEqual(decision.attempts, 1);
});
