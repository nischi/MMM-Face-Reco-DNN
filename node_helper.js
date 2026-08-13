/* Magic Mirror
 * Module: MMM-Face-Reco-DNN
 *
 * By Thierry Nischelwitzer http://nischi.ch
 * MIT Licensed.
 */

'use strict';

const NodeHelper = require('node_helper');
const { PythonShell } = require('python-shell');
const onExit = require('signal-exit');
const RestartPolicy = require('./restartpolicy.js');

// Supervision constants (delay, rate budget, healthy-run threshold) live with
// the pure decision logic in restartpolicy.js so both sides agree on them.
const MAX_RESTARTS_PER_WINDOW = RestartPolicy.MAX_RESTARTS_PER_WINDOW;
const RESTART_WINDOW_MS = RestartPolicy.RESTART_WINDOW_MS;

// Only one python recognition process (one camera) may run per MagicMirror
// server. MagicMirror keys node helpers by module name and therefore creates a
// single instance of this helper, so the flag is really instance state; it is
// kept at module level to stay correct even if that ever changed.
var pythonStarted = false;

module.exports = NodeHelper.create({
  pyshell: null,
  // true while we are deliberately terminating python (stop/shutdown), so the
  // resulting exit is not mistaken for a crash.
  stopping: false,
  // restarts performed inside the current rolling window, and the timestamp at
  // which that window started (see restartpolicy.js).
  restartAttempts: 0,
  restartWindowStart: 0,
  restartTimer: null,
  exitHookRegistered: false,

  python_start: function () {
    const self = this;
    const extendedDataset = this.config.extendDataset ? 'True' : 'False';
    const options = {
      mode: 'json',
      pythonOptions: ['-u'], // Immediately flush buffer for std out/in monitoring/writing to work
      // mode 'json' would parse stdout with a bare JSON.parse; use a tolerant
      // parser instead (see parse_python_line). Outgoing messages keep the json
      // formatter that `mode` selects.
      parser: line => self.parse_python_line(line),
      stderrParser: line => JSON.stringify(line),
      args: [
        '--encodings=' + this.config.encodings,
        '--detModel=' + this.config.detModel,
        '--recModel=' + this.config.recModel,
        '--rotateCamera=' + this.config.rotateCamera,
        '--interval=' + this.config.checkInterval,
        '--output=' + this.config.output,
        '--outputmm=' + this.config.outputmm,
        '--extendDataset=' + extendedDataset,
        '--dataset=' + this.config.dataset,
        '--cosineThreshold=' + this.config.cosineThreshold,
        '--detScoreThreshold=' + this.config.detScoreThreshold,
        '--brightness=' + this.config.brightness,
        '--contrast=' + this.config.contrast,
        '--resolution=' + this.config.resolution,
        '--processWidth=' + this.config.processWidth,
        '--camera=' + this.config.camera,
        '--cameraDevice=' + this.config.cameraDevice,
        '--run-only-on-notification=' + (this.config.external_trigger_notification !== '' || this.config.motionGate ? '1' : '0'),
        '--start-paused=' + (this.config.motionGate ? '1' : '0'),
      ],
    };

    if (this.config.pythonPath != null && this.config.pythonPath !== '') {
      options.pythonPath = this.config.pythonPath;
    }

    this.stopping = false;
    const startedAt = Date.now();

    // Start face reco script
    const shell = new PythonShell('modules/' + this.name + '/tools/recognition.py', options);
    self.pyshell = shell;

    // 'error' and 'close' can both fire for the same process; latch per process
    // so its exit is handled exactly once and a late event from an already
    // replaced process cannot disturb its successor.
    let exitHandled = false;
    const handleExit = function (reason) {
      if (exitHandled) {
        return;
      }
      exitHandled = true;
      self.python_exited(shell, startedAt, reason);
    };

    // check if a message of the python script is comming in
    shell.on('message', function (message) {
      // Lines the tolerant parser could not read arrive as undefined.
      if (message == null || typeof message !== 'object') {
        return;
      }

      // A status message has received and will log
      if (Object.prototype.hasOwnProperty.call(message, 'status')) {
        console.log('[' + self.name + '] ' + message.status);
      }

      // Somebody new are in front of the camera, send it back to the Magic Mirror Module
      if (Object.prototype.hasOwnProperty.call(message, 'camera_image')) {
        self.sendSocketNotification('camera_image', {
          image: message.camera_image.image,
        });
      }

      // Check if we get an image to show in the mirror
      if (Object.prototype.hasOwnProperty.call(message, 'login')) {
        console.log('[' + self.name + '] ' + 'Users ' + message.login.names.join(' - ') + ' logged in.');
        self.sendSocketNotification('user', {
          action: 'login',
          users: message.login.names,
        });
      }

      // Somebody left the camera, send it back to the Magic Mirror Module
      if (Object.prototype.hasOwnProperty.call(message, 'logout')) {
        console.log('[' + self.name + '] ' + 'Users ' + message.logout.names.join(' - ') + ' logged out.');
        self.sendSocketNotification('user', {
          action: 'logout',
          users: message.logout.names,
        });
      }
    });

    // Spawn failures (bad pythonPath, missing script) arrive here. Without a
    // listener node would rethrow them and take the whole mirror down.
    shell.on('error', function (err) {
      handleExit('error: ' + (err && err.message ? err.message : err));
    });

    // Normal end of the process (crash inside python, killed, exit(0)).
    shell.on('close', function () {
      handleExit('exit code ' + self.exit_description(shell));
    });

    // python-shell does not attach an error listener to stdin, so a write to a
    // dead process would surface as an uncaught EPIPE.
    if (shell.stdin) {
      shell.stdin.on('error', function (err) {
        console.log('[' + self.name + '] ' + 'Python stdin error (ignored): ' + (err && err.message ? err.message : err));
      });
    }

    if (!this.exitHookRegistered) {
      this.exitHookRegistered = true;
      onExit(function (_code, _signal) {
        self.stopping = true;
        self.destroy();
      });
    }
  },

  // python-shell hands us stdout one line at a time. When the python process
  // dies mid-write, NewlineTransformer._flush pushes the torn remainder of the
  // last line, and the built-in json parser throws that SyntaxError right out
  // of a stream 'data' handler - uncatchable from here, and fatal for the whole
  // MagicMirror process. So parse defensively and drop what we cannot read;
  // well formed lines are returned exactly as JSON.parse would.
  parse_python_line: function (line) {
    if (typeof line !== 'string' || line.trim() === '') {
      return undefined;
    }

    try {
      return JSON.parse(line);
    } catch (err) {
      const preview = line.length > 200 ? line.slice(0, 200) + '...' : line;
      console.log('[' + this.name + '] ' + 'Ignoring unreadable line from python (' + (err && err.message ? err.message : err) + '): ' + preview);
      return undefined;
    }
  },

  exit_description: function (shell) {
    if (!shell) {
      return 'unknown';
    }
    if (shell.exitSignal) {
      return String(shell.exitCode) + ', signal ' + shell.exitSignal;
    }
    return String(shell.exitCode);
  },

  // Called once per python process when it is gone, whatever the reason.
  python_exited: function (shell, startedAt, reason) {
    const self = this;

    if (this.pyshell !== shell) {
      // A process we already gave up on (destroy()) or replaced. Nothing to do.
      console.log('[' + this.name + '] ' + 'Python process closed (' + reason + ').');
      return;
    }

    const now = Date.now();
    const ranForMs = now - startedAt;
    this.pyshell = null;

    if (this.stopping) {
      console.log('[' + this.name + '] ' + 'Python process terminated on request (' + reason + ').');
    } else {
      console.log('[' + this.name + '] ' + 'Python process died unexpectedly after ' + Math.round(ranForMs / 1000) + 's (' + reason + ').');
    }

    // No python process is running any more: release the guard so a restart (or
    // a fresh CONFIG after a browser reload) can start one.
    pythonStarted = false;

    const decision = RestartPolicy.decideRestart({
      intentional: this.stopping,
      now: now,
      attempts: this.restartAttempts,
      windowStart: this.restartWindowStart,
      ranForMs: ranForMs,
    });
    this.restartAttempts = decision.attempts;
    this.restartWindowStart = decision.windowStart;

    if (decision.action === 'none') {
      return;
    }

    if (decision.throttled) {
      console.log(
        '[' +
          this.name +
          '] ' +
          'Python failed ' +
          MAX_RESTARTS_PER_WINDOW +
          ' times within ' +
          Math.round(RESTART_WINDOW_MS / 60000) +
          ' minutes. Backing off for ' +
          Math.round(decision.delayMs / 1000) +
          's, then trying again with a fresh budget.',
      );
    } else {
      console.log(
        '[' +
          this.name +
          '] ' +
          'Restarting python in ' +
          Math.round(decision.delayMs / 1000) +
          's (restart ' +
          decision.attempts +
          '/' +
          MAX_RESTARTS_PER_WINDOW +
          ' in this window).',
      );
    }

    this.clear_restart_timer();
    this.restartTimer = setTimeout(function () {
      self.restartTimer = null;
      if (self.stopping || !self.config) {
        return;
      }
      if (pythonStarted) {
        // Somebody else (e.g. a CONFIG after a browser reload) already started
        // python in the meantime.
        console.log('[' + self.name + '] ' + 'Python already running again, skipping scheduled restart.');
        return;
      }
      pythonStarted = true;
      console.log('[' + self.name + '] ' + 'Restarting python recognition process...');
      try {
        self.python_start();
      } catch (err) {
        pythonStarted = false;
        console.log('[' + self.name + '] ' + 'Could not restart python: ' + (err && err.message ? err.message : err));
        return;
      }
      // The fresh process boots with the same --start-paused flags as the very
      // first one, so tell the browser module to resynchronise its motion gate
      // instead of assuming its old running/paused state still holds.
      self.sendSocketNotification('PYTHON_RESTARTED', {});
    }, decision.delayMs);

    if (this.restartTimer.unref) {
      this.restartTimer.unref();
    }
  },

  clear_restart_timer: function () {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  },

  python_alive: function () {
    const shell = this.pyshell;
    return !!(shell && !shell.terminated && shell.stdin && shell.stdin.writable);
  },

  send_python_cmd: function (cmd) {
    if (!this.python_alive()) {
      console.log('[' + this.name + '] ' + 'Ignoring command "' + cmd + '": no running python process.');
      return;
    }

    try {
      this.pyshell.send(cmd);
    } catch (err) {
      console.log('[' + this.name + '] ' + 'Could not send command "' + cmd + '" to python: ' + (err && err.message ? err.message : err));
    }
  },

  python_stop: function () {
    this.destroy();
  },

  destroy: function () {
    const self = this;
    const shell = this.pyshell;

    if (!shell) {
      console.log('[' + this.name + '] ' + 'No python process to terminate.');
      return;
    }

    this.pyshell = null;
    console.log('[' + this.name + '] ' + 'Terminate python');

    try {
      shell.end(function (err) {
        if (err) {
          console.log('[' + self.name + '] ' + 'Python process ended with an error: ' + (err.message ? err.message : err));
          return;
        }
        console.log('[' + self.name + '] ' + 'finished running...');
      });
    } catch (err) {
      console.log('[' + self.name + '] ' + 'Could not close python stdin: ' + (err && err.message ? err.message : err));
    }

    try {
      if (shell.childProcess && !shell.terminated) {
        shell.childProcess.kill();
      }
    } catch (err) {
      console.log('[' + self.name + '] ' + 'Could not kill python process: ' + (err && err.message ? err.message : err));
    }
  },

  socketNotificationReceived: function (notification, payload) {
    // Configuration are received
    if (notification === 'CONFIG') {
      this.config = payload;
      // Set static output to 0, because we do not need any output for MMM
      this.config.output = 0;
      if (!pythonStarted) {
        pythonStarted = true;
        // A CONFIG means the browser (re)loaded and explicitly asks for a
        // process: drop any pending restart and start from a clean budget.
        this.clear_restart_timer();
        this.restartAttempts = 0;
        this.restartWindowStart = 0;
        this.python_start();
      }
    }

    // Notification for triggering face recognition received. Only send to python subprocess
    // if it has been started
    if (notification === this.config.external_trigger_notification && pythonStarted) {
      if (payload === true) {
        this.send_python_cmd('start');
      } else {
        this.send_python_cmd('stop');
      }
    }

    // Motion gate control from the module: payload is 'start' or 'stop'
    if (notification === 'MOTION_GATE_CONTROL' && pythonStarted) {
      this.send_python_cmd(payload);
    }
  },

  stop: function () {
    this.stopping = true;
    this.clear_restart_timer();
    pythonStarted = false;
    this.python_stop();
  },
});
