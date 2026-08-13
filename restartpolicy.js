/* Magic Mirror
 * Module: MMM-Face-Reco-DNN
 *
 * Pure decision logic for supervising the python recognition process.
 * Kept dependency-free and side-effect-free so it can be unit tested with
 * node:test, in the same style as motiongate.js.
 *
 * By Thierry Nischelwitzer http://nischi.ch
 * MIT Licensed.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RestartPolicy = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Wait this long before respawning python. The usual cause of an unexpected
  // exit is the camera device disappearing for a moment (e.g. a camera broker
  // restarting under systemd), so a few seconds of grace is enough for the
  // device to come back without hammering the CPU.
  var RESTART_DELAY_MS = 5000;

  // How many consecutive failed starts we accept before giving up. Five tries
  // spread over ~25s covers a device that is slow to reappear, while a real
  // misconfiguration (wrong pythonPath, missing encodings pickle) fails fast
  // and stops instead of looping forever.
  var MAX_RESTART_ATTEMPTS = 5;

  // A process that stayed alive at least this long is considered to have run
  // healthily; the next crash therefore starts from a fresh budget. Without
  // this, a slow crash loop (one crash a day) would silently exhaust the
  // budget over a week and disable recognition for good.
  var HEALTHY_RUN_MS = 60000;

  // Decide what to do after the python process exited.
  //
  // state:
  //   intentional - true when we killed the process ourselves (stop/shutdown)
  //   attempts    - consecutive restart attempts so far
  //   ranForMs    - how long the process that just exited stayed alive
  //
  // limits (optional, mainly for tests): maxAttempts, healthyRunMs, restartDelayMs
  //
  // Returns { action, attempts, delayMs } where action is one of:
  //   'none'    - do not restart (deliberate shutdown)
  //   'restart' - respawn after delayMs, with `attempts` as the new counter
  //   'give-up' - budget exhausted, stay down until the mirror is restarted
  function decideRestart(state, limits) {
    var cfg = limits || {};
    var maxAttempts = typeof cfg.maxAttempts === 'number' ? cfg.maxAttempts : MAX_RESTART_ATTEMPTS;
    var healthyRunMs = typeof cfg.healthyRunMs === 'number' ? cfg.healthyRunMs : HEALTHY_RUN_MS;
    var restartDelayMs = typeof cfg.restartDelayMs === 'number' ? cfg.restartDelayMs : RESTART_DELAY_MS;

    var attempts = typeof state.attempts === 'number' && state.attempts > 0 ? state.attempts : 0;

    if (state.intentional) {
      return { action: 'none', attempts: attempts, delayMs: 0 };
    }

    // The process that just died had been up long enough to count as healthy,
    // so this crash is treated as the first one of a new series.
    if ((state.ranForMs || 0) >= healthyRunMs) {
      attempts = 0;
    }

    if (attempts >= maxAttempts) {
      return { action: 'give-up', attempts: attempts, delayMs: 0 };
    }

    return { action: 'restart', attempts: attempts + 1, delayMs: restartDelayMs };
  }

  return {
    decideRestart: decideRestart,
    RESTART_DELAY_MS: RESTART_DELAY_MS,
    MAX_RESTART_ATTEMPTS: MAX_RESTART_ATTEMPTS,
    HEALTHY_RUN_MS: HEALTHY_RUN_MS,
  };
});
