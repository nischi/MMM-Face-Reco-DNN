'use strict';

// The browser side of the motion gate, in particular how it resynchronises
// after the node helper had to respawn the python process.

const test = require('node:test');
const assert = require('node:assert');
const { loadClientModule, withFakeTimers } = require('./harness.js');

function gateCommands(sockets) {
  return sockets.filter(item => item.notification === 'MOTION_GATE_CONTROL').map(item => item.payload);
}

test('the module boots paused when the motion gate is on', () => {
  const { mod, sockets } = loadClientModule({ motionGate: true });
  mod.start();

  assert.strictEqual(mod.motionRunning, false, 'python boots with --start-paused');
  assert.deepStrictEqual(gateCommands(sockets), []);
});

test('a restart while somebody is at the mirror re-sends start', () => {
  const { mod, sockets } = loadClientModule({ motionGate: true });
  mod.start();

  // Motion woke recognition up and a user is standing in front of the mirror.
  mod.notificationReceived('MOTION_WAKE', true, null);
  mod.users = ['thierry'];
  assert.deepStrictEqual(gateCommands(sockets), ['start']);

  // The camera broker restarted, python died and was respawned paused. Without
  // the resync the module would still believe recognition is running and never
  // send 'start' again, so recognition would stay dead until the user left.
  mod.socketNotificationReceived('PYTHON_RESTARTED', {});

  assert.deepStrictEqual(gateCommands(sockets), ['start', 'start'], 'the fresh process is told to resume');
  assert.strictEqual(mod.motionRunning, true);
});

test('a restart with motion still active re-sends start even without a user', () => {
  const { mod, sockets } = loadClientModule({ motionGate: true });
  mod.start();
  mod.notificationReceived('MOTION_WAKE', true, null);

  mod.socketNotificationReceived('PYTHON_RESTARTED', {});

  assert.deepStrictEqual(gateCommands(sockets), ['start', 'start']);
});

test('a restart while everything is quiet sends nothing, because python boots paused', () => {
  const { mod, sockets } = loadClientModule({ motionGate: true });
  mod.start();
  mod.notificationReceived('MOTION_WAKE', true, null);

  withFakeTimers(clock => {
    mod.notificationReceived('MOTION_CLEARED', true, null);
    clock.runAll(); // the pause delay elapses -> 'stop'
  });
  assert.deepStrictEqual(gateCommands(sockets), ['start', 'stop']);

  mod.socketNotificationReceived('PYTHON_RESTARTED', {});

  assert.deepStrictEqual(gateCommands(sockets), ['start', 'stop'], 'no command needed, the fresh process is already paused');
  assert.strictEqual(mod.motionRunning, false);
});

test('a restart drops a pending pause so it cannot stop the fresh process', () => {
  const { mod, sockets } = loadClientModule({ motionGate: true });
  mod.start();
  mod.notificationReceived('MOTION_WAKE', true, null);

  withFakeTimers(clock => {
    mod.notificationReceived('MOTION_CLEARED', true, null);
    assert.strictEqual(clock.pending().length, 1, 'a pause is pending');

    mod.socketNotificationReceived('PYTHON_RESTARTED', {});
    assert.strictEqual(mod.motionPauseTimer, null, 'the stale pause timer is dropped');
    assert.strictEqual(clock.pending().length, 0);
  });

  assert.deepStrictEqual(gateCommands(sockets), ['start'], 'no spurious stop for the new process');
});

test('a restart is a no-op when the motion gate is off', () => {
  const { mod, sockets } = loadClientModule({ motionGate: false });
  mod.start();

  mod.socketNotificationReceived('PYTHON_RESTARTED', {});

  assert.deepStrictEqual(gateCommands(sockets), []);
  assert.strictEqual(mod.motionRunning, true, 'without the gate python always runs');
});

test('the restart notification never falls through to the login/logout handling', () => {
  const { mod, notifications } = loadClientModule({ motionGate: true });
  mod.start();

  assert.doesNotThrow(() => mod.socketNotificationReceived('PYTHON_RESTARTED', {}));
  assert.deepStrictEqual(notifications, []);
  assert.deepStrictEqual(mod.users, []);
});
