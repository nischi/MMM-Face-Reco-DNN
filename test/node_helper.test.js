'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { loadNodeHelper, config, captureLogs, withFakeTimers } = require('./harness.js');

// Start the helper the way MagicMirror does and hand back the running shell.
function start(overrides) {
  const env = loadNodeHelper();
  captureLogs(() => env.helper.socketNotificationReceived('CONFIG', config(overrides)));
  assert.strictEqual(env.shells.length, 1, 'CONFIG must spawn exactly one python process');
  env.shell = env.shells[0];
  return env;
}

test('CONFIG spawns python and passes the start-paused flags of the motion gate', () => {
  const env = start({ motionGate: true });
  assert.ok(env.shell.options.args.includes('--start-paused=1'));
  assert.ok(env.shell.options.args.includes('--run-only-on-notification=1'));
});

// --- writing to a dead process ----------------------------------------------

test('a command sent after python died does not throw', () => {
  const env = start();

  captureLogs(() => env.shell.die(1));

  assert.doesNotThrow(() => captureLogs(() => env.helper.socketNotificationReceived('MOTION_GATE_CONTROL', 'start')));
  assert.deepStrictEqual(env.shell.stdin.writes, [], 'nothing may be written to a dead process');
});

test('a command sent in the post-kill race does not throw (the stdin error listener is load-bearing)', () => {
  const env = start();

  // The process is already gone but stdin still reports writable, so
  // python_alive() lets the write through and the pipe fails with EPIPE. Only
  // the stdin 'error' listener keeps that from becoming an uncaught exception.
  env.shell.dieSilently();
  assert.strictEqual(env.helper.python_alive(), true, 'this test is only meaningful while the liveness check still passes');

  assert.doesNotThrow(() => captureLogs(() => env.helper.send_python_cmd('start')));
  assert.ok(
    env.logs.some(line => line.indexOf('stdin error') !== -1),
    'the EPIPE must be logged, not thrown',
  );
});

test('a command sent while a restart is pending is dropped, not queued', () => {
  const env = start();

  withFakeTimers(() => {
    captureLogs(() => {
      env.shell.die(1);
      env.helper.socketNotificationReceived('MOTION_GATE_CONTROL', 'stop');
    });
  });

  assert.deepStrictEqual(env.shell.stdin.writes, []);
  assert.strictEqual(env.shells.length, 1, 'the command must not start python by itself');
});

// --- destroy() ---------------------------------------------------------------

test('destroy() is safe when there is no python process', () => {
  const env = loadNodeHelper();
  assert.doesNotThrow(() => captureLogs(() => env.helper.destroy()));
  assert.doesNotThrow(() => captureLogs(() => env.helper.destroy()));
});

test('destroy() does not throw when the end callback reports an error', () => {
  const env = start();
  env.shell.endCallbackError = new Error('stdin already gone');

  assert.doesNotThrow(() => captureLogs(() => env.helper.destroy()));
  assert.strictEqual(env.shell.killed, true, 'the process is still killed after a failing end()');
  assert.strictEqual(env.helper.pyshell, null);
});

// --- restart timer -----------------------------------------------------------

test('stop() clears a pending restart timer, which cannot resurrect python', () => {
  const env = start();

  withFakeTimers(clock => {
    captureLogs(() => env.shell.die(1));
    const pending = clock.pending();
    assert.strictEqual(pending.length, 1, 'a crash schedules exactly one restart');

    captureLogs(() => env.helper.stop());
    assert.strictEqual(clock.pending().length, 0, 'stop() must clear the pending restart');
    assert.strictEqual(env.helper.restartTimer, null);

    // Even a timer that somehow still fires must not start python again.
    captureLogs(() => pending[0].cb());
  });

  assert.strictEqual(env.shells.length, 1, 'no python process may be spawned after stop()');
});

test('a single exit produces a single restart', () => {
  const env = start();

  // The latch must swallow the repeat events before python_exited is reached.
  let exits = 0;
  const realExited = env.helper.python_exited;
  env.helper.python_exited = function (...args) {
    exits++;
    return realExited.apply(this, args);
  };

  withFakeTimers(clock => {
    captureLogs(() => {
      // python-shell can emit both 'error' and 'close' for the same process.
      env.shell.emit('error', new Error('spawn failed'));
      env.shell.die(1);
      // A late event from the process we already handled must be ignored, too.
      env.shell.emit('close');
    });

    assert.strictEqual(exits, 1, 'the exit of one process is handled exactly once');
    assert.strictEqual(clock.pending().length, 1, 'only one restart may be scheduled');
    assert.strictEqual(
      captureLogs(() => clock.runAll()),
      1,
    );
  });

  assert.strictEqual(env.shells.length, 2, 'exactly one new python process');
});

test('a restart tells the browser module to resynchronise', () => {
  const env = start();

  withFakeTimers(clock => {
    captureLogs(() => {
      env.shell.die(1);
      clock.runAll();
    });
  });

  assert.strictEqual(env.shells.length, 2);
  const restarted = env.sent.filter(item => item.notification === 'PYTHON_RESTARTED');
  assert.strictEqual(restarted.length, 1, 'the browser module must learn about the restart');
});

test('the exit of an already replaced process does not restart python again', () => {
  const env = start();

  withFakeTimers(clock => {
    captureLogs(() => {
      env.shell.die(1);
      clock.runAll();
      // The first shell fires a late event after it has been replaced.
      env.shells[0].emit('close');
    });
    assert.strictEqual(clock.pending().length, 0, 'a stale exit must not schedule anything');
  });

  assert.strictEqual(env.shells.length, 2);
});

test('a re-sent CONFIG restarts python once the old process is gone', () => {
  const env = start();

  withFakeTimers(clock => {
    captureLogs(() => {
      env.shell.die(1);
      env.helper.socketNotificationReceived('CONFIG', config());
    });
    assert.strictEqual(clock.pending().length, 0, 'CONFIG must drop the pending restart it superseded');
  });

  assert.strictEqual(env.shells.length, 2, 'CONFIG starts a process while none is running');
  assert.strictEqual(env.helper.restartAttempts, 0, 'and it starts from a fresh restart budget');
});

// --- stdout parsing ----------------------------------------------------------

test('a torn json line from a dying process is dropped instead of thrown', () => {
  const env = start();

  assert.doesNotThrow(() => captureLogs(() => env.shell.feedStdout('{"status": "starting up, this can ta')));
  assert.doesNotThrow(() => captureLogs(() => env.shell.feedStdout('')));
  assert.doesNotThrow(() => captureLogs(() => env.shell.feedStdout('not json at all')));

  assert.deepStrictEqual(env.sent, [], 'nothing is forwarded for unreadable lines');
  assert.ok(
    env.logs.some(line => line.indexOf('Ignoring unreadable line') !== -1),
    'the dropped line must be logged',
  );
});

test('well formed messages are handled exactly as before', () => {
  const env = start();

  captureLogs(() => {
    env.shell.feedStdout(JSON.stringify({ status: 'ready' }));
    env.shell.feedStdout(JSON.stringify({ login: { names: ['thierry'] } }));
    env.shell.feedStdout(JSON.stringify({ logout: { names: ['thierry'] } }));
    env.shell.feedStdout(JSON.stringify({ camera_image: { image: 'base64' } }));
  });

  assert.deepStrictEqual(env.sent, [
    { notification: 'user', payload: { action: 'login', users: ['thierry'] } },
    { notification: 'user', payload: { action: 'logout', users: ['thierry'] } },
    { notification: 'camera_image', payload: { image: 'base64' } },
  ]);
  assert.ok(env.logs.some(line => line.indexOf('ready') !== -1));
});

test('a json line that is not an object is ignored', () => {
  const env = start();

  assert.doesNotThrow(() => captureLogs(() => env.shell.feedStdout('null')));
  assert.doesNotThrow(() => captureLogs(() => env.shell.feedStdout('42')));
  assert.deepStrictEqual(env.sent, []);
});
