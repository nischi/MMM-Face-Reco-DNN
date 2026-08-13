/* Shared test harness.
 *
 * node_helper.js depends on modules that only exist inside a running
 * MagicMirror (`node_helper`), on python-shell spawning a real python process,
 * and on wall-clock timers. These helpers stub just enough of that environment
 * that the real node_helper.js can be loaded and exercised in plain Node - no
 * MagicMirror install, no camera and no python required.
 *
 * This file is support code, not a test file: the runner glob is
 * `test/*.test.js` (see package.json), so nothing here is collected as a test.
 */

'use strict';

const Module = require('node:module');
const { EventEmitter } = require('node:events');

// node_helper registers a process exit hook per load; several loads per test
// file would otherwise warn about too many listeners.
process.setMaxListeners(0);

// The python process is gone but its stdin handle still looks writable - the
// race the real code hit after SIGKILL, where python_alive() said yes and the
// write failed with EPIPE afterwards.
const EPIPE = 'epipe';
// Everything is closed; a write is rejected right away.
const CLOSED = 'closed';
const ALIVE = 'alive';

class FakeStdin extends EventEmitter {
  constructor() {
    super();
    this.writable = true;
    this.writes = [];
    this.ended = false;
    this.state = ALIVE;
  }

  setEncoding() {}

  write(data) {
    if (this.state === CLOSED) {
      const err = new Error('write after end');
      err.code = 'ERR_STREAM_WRITE_AFTER_END';
      throw err;
    }

    if (this.state === EPIPE) {
      // A real pipe accepts the write and reports the failure afterwards as an
      // 'error' event on the stream. EventEmitter rethrows an 'error' with no
      // listener, which is exactly what took the whole mirror down (exit 9).
      const err = new Error('write EPIPE');
      err.code = 'EPIPE';
      this.emit('error', err);
      return false;
    }

    this.writes.push(data);
    return true;
  }

  end() {
    this.ended = true;
  }
}

// Stand-in for python-shell's PythonShell. Mirrors the parts node_helper uses:
// the 'message' / 'error' / 'close' events, stdin, send(), end(), kill() and
// the terminated/exitCode fields.
class FakePythonShell extends EventEmitter {
  constructor(scriptPath, options) {
    super();
    this.scriptPath = scriptPath;
    this.options = options || {};
    this.stdin = new FakeStdin();
    this.childProcess = { kill: () => (this.killed = true) };
    this.terminated = false;
    this.killed = false;
    this.exitCode = null;
    this.exitSignal = null;
    this.endCallbackError = null;
  }

  send(message) {
    if (!this.stdin) {
      throw new Error('stdin not open for writing');
    }
    const formatted = JSON.stringify(message) + '\n';
    this.stdin.write(formatted);
    return this;
  }

  end(callback) {
    this.stdin.end();
    if (callback) {
      callback(this.endCallbackError);
    }
    return this;
  }

  kill(signal) {
    this.terminated = true;
    this.exitSignal = signal || 'SIGTERM';
    return this;
  }

  // --- test-only helpers -------------------------------------------------

  // Feed one line of python stdout through the configured parser, the same way
  // python-shell does: `this.emit('message', self.parser(chunk))`.
  feedStdout(line) {
    this.emit('message', this.options.parser ? this.options.parser(line) : JSON.parse(line));
  }

  // The process is gone, but stdin has not noticed yet (post SIGKILL race).
  dieSilently() {
    this.stdin.state = EPIPE;
  }

  // The process exited: python-shell emits 'close' after the streams are done.
  die(exitCode, signal) {
    this.exitCode = typeof exitCode === 'number' ? exitCode : 1;
    this.exitSignal = signal || null;
    this.stdin.state = CLOSED;
    this.stdin.writable = false;
    this.emit('close');
  }
}

let patched = false;
const spawned = [];
const logs = [];
const exitHooks = [];

function patchRequire() {
  if (patched) {
    return;
  }
  patched = true;

  const origLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'node_helper') {
      return { create: proto => Object.assign({ sendSocketNotification() {} }, proto) };
    }
    if (request === 'python-shell') {
      return {
        PythonShell: function (scriptPath, options) {
          const shell = new FakePythonShell(scriptPath, options);
          spawned.push(shell);
          return shell;
        },
      };
    }
    if (request === 'signal-exit') {
      return function (cb) {
        exitHooks.push(cb);
        return function () {};
      };
    }
    return origLoad.call(this, request, parent, isMain);
  };
}

const DEFAULT_CONFIG = {
  debug: 0,
  encodings: 'model/encodings.pickle',
  detModel: 'model/det.onnx',
  recModel: 'model/rec.onnx',
  rotateCamera: -1,
  checkInterval: 2000,
  output: 0,
  outputmm: 0,
  extendDataset: false,
  dataset: 'dataset/',
  cosineThreshold: 0.363,
  detScoreThreshold: 0.9,
  brightness: 0,
  contrast: 0,
  resolution: [1920, 1080],
  processWidth: 500,
  camera: 'pi',
  cameraDevice: 0,
  pythonPath: '',
  external_trigger_notification: '',
  motionGate: true,
};

// Load a pristine copy of node_helper.js (module level state included) with the
// MagicMirror/python-shell environment stubbed out. Returns the helper plus the
// spawned fake shells, the socket notifications it sent and the lines it logged.
function loadNodeHelper() {
  patchRequire();

  spawned.length = 0;
  logs.length = 0;
  exitHooks.length = 0;

  delete require.cache[require.resolve('../node_helper.js')];
  const helper = require('../node_helper.js');

  helper.name = 'MMM-Face-Reco-DNN';

  const sent = [];
  helper.sendSocketNotification = (notification, payload) => {
    sent.push({ notification: notification, payload: payload });
  };

  return { helper: helper, shells: spawned, sent: sent, logs: logs, exitHooks: exitHooks };
}

function config(overrides) {
  return Object.assign({}, DEFAULT_CONFIG, overrides || {});
}

// Load MMM-Face-Reco-DNN.js (the browser side) with the MagicMirror globals
// stubbed, including the MotionGate helper the real module gets via
// getScripts(). Returns the module object plus what it sent out.
function loadClientModule(overrides) {
  global.Module = {
    register: function (_name, proto) {
      global.__mmmFaceReco = proto;
    },
  };
  global.Log = { log() {}, info() {}, warn() {}, error() {} };
  global.MotionGate = require('../motiongate.js');

  delete require.cache[require.resolve('../MMM-Face-Reco-DNN.js')];
  require('../MMM-Face-Reco-DNN.js');

  const mod = global.__mmmFaceReco;
  mod.name = 'MMM-Face-Reco-DNN';
  mod.identifier = 'module_1_MMM-Face-Reco-DNN';
  mod.config = Object.assign({}, mod.defaults, overrides || {});
  mod.users = [];
  mod.userClasses = [];
  mod.timouts = {};
  mod.motionActive = false;
  mod.motionRunning = true;
  mod.motionPauseTimer = null;
  mod.updateDom = function () {};

  const sockets = [];
  const notifications = [];
  mod.sendSocketNotification = (notification, payload) => sockets.push({ notification: notification, payload: payload });
  mod.sendNotification = (notification, payload) => notifications.push({ notification: notification, payload: payload });

  return { mod: mod, sockets: sockets, notifications: notifications };
}

// Swallow node_helper's console.log noise and keep it for assertions.
function captureLogs(fn) {
  const realLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    return fn();
  } finally {
    console.log = realLog;
  }
}

// Deterministic setTimeout/clearTimeout for the restart timer. `fn` must be
// synchronous so the globals are only swapped for the duration of the call.
function withFakeTimers(fn) {
  const realSetTimeout = global.setTimeout;
  const realClearTimeout = global.clearTimeout;
  const timers = new Map();
  let nextId = 1;

  global.setTimeout = (cb, ms) => {
    const id = nextId++;
    timers.set(id, { id: id, cb: cb, ms: ms });
    return {
      id: id,
      unref: function () {
        return this;
      },
    };
  };
  global.clearTimeout = handle => {
    if (handle && typeof handle.id === 'number') {
      timers.delete(handle.id);
      return;
    }
    realClearTimeout(handle);
  };

  const clock = {
    pending: () => Array.from(timers.values()),
    // Fire every pending timer once, in scheduling order.
    runAll: () => {
      const due = Array.from(timers.values());
      timers.clear();
      due.forEach(timer => timer.cb());
      return due.length;
    },
  };

  try {
    return fn(clock);
  } finally {
    global.setTimeout = realSetTimeout;
    global.clearTimeout = realClearTimeout;
  }
}

module.exports = {
  loadNodeHelper: loadNodeHelper,
  loadClientModule: loadClientModule,
  config: config,
  captureLogs: captureLogs,
  withFakeTimers: withFakeTimers,
  FakePythonShell: FakePythonShell,
};
