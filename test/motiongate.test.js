'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { nextAction } = require('../motiongate.js');

function state(overrides) {
  return Object.assign({ motionActive: false, userPresent: false, running: false, pausePending: false }, overrides);
}

test('resumes from paused when motion starts', () => {
  assert.strictEqual(nextAction(state({ motionActive: true, running: false })), 'resume');
});

test('schedules a pause when running and everything is quiet', () => {
  assert.strictEqual(nextAction(state({ running: true })), 'schedule-pause');
});

test('stays running after motion clears while a user is present (standing-still guard)', () => {
  assert.strictEqual(nextAction(state({ motionActive: false, userPresent: true, running: true })), 'none');
});

test('cancels a pending pause when motion re-triggers', () => {
  assert.strictEqual(nextAction(state({ motionActive: true, running: true, pausePending: true })), 'cancel-pause');
});

test('cancels a pending pause when a user logs in', () => {
  assert.strictEqual(nextAction(state({ userPresent: true, running: true, pausePending: true })), 'cancel-pause');
});

test('stays running when a user leaves but motion is still active', () => {
  assert.strictEqual(nextAction(state({ motionActive: true, userPresent: false, running: true })), 'none');
});

test('schedules a pause when the last user leaves and motion already cleared', () => {
  assert.strictEqual(nextAction(state({ motionActive: false, userPresent: false, running: true })), 'schedule-pause');
});

test('does nothing while paused with no motion (stays paused at boot)', () => {
  assert.strictEqual(nextAction(state({ running: false })), 'none');
});

test('does not schedule a second pause when one is already pending', () => {
  assert.strictEqual(nextAction(state({ running: true, pausePending: true })), 'none');
});

test('resume takes priority over a pending pause', () => {
  // motion returns while a pause was pending and recognition had not stopped yet
  assert.strictEqual(nextAction(state({ motionActive: true, running: false, pausePending: true })), 'resume');
});
