/* Magic Mirror
 * Module: MMM-Face-Reco-DNN
 *
 * Pure decision logic for supervising the python recognition process.
 * Kept dependency-free and side-effect-free so it can be unit tested with
 * node:test, in the same style as motiongate.js. The clock is always passed
 * in (state.now) instead of read here, so tests can drive time freely.
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

  // The budget is a RATE, not a lifetime allowance: at most this many restarts
  // inside RESTART_WINDOW_MS. A lifetime cap was wrong here, because the camera
  // helper fails within a second when the device is absent, so a ~30s outage of
  // the camera broker (or losing the cold boot race) burned the whole allowance
  // and left recognition dead for the rest of the mirror's uptime.
  var MAX_RESTARTS_PER_WINDOW = 5;

  // Rolling window for the budget above. Ten minutes is long enough to cover a
  // camera outage of several minutes with quick retries, and short enough that
  // the module still recovers on its own afterwards. Once the budget is spent
  // we wait out the window instead of spinning, so a genuine crash loop (wrong
  // pythonPath, missing encodings pickle) costs about one spawn every two
  // minutes on average rather than a continuous restart storm.
  var RESTART_WINDOW_MS = 10 * 60 * 1000;

  // A process that stayed alive at least this long is considered to have run
  // healthily (it got past opening the camera and loading the models), so the
  // next crash starts from a fresh budget and a fresh window.
  var HEALTHY_RUN_MS = 60000;

  function numberOr(value, fallback) {
    return typeof value === 'number' ? value : fallback;
  }

  // Decide what to do after the python process exited.
  //
  // state:
  //   intentional - true when we killed the process ourselves (stop/shutdown)
  //   now         - current timestamp in ms (the caller owns the clock)
  //   attempts    - restarts already performed inside the current window
  //   windowStart - timestamp at which the current window started
  //   ranForMs    - how long the process that just exited stayed alive
  //
  // limits (optional, mainly for tests): maxRestarts, windowMs, healthyRunMs,
  // restartDelayMs
  //
  // Returns { action, attempts, windowStart, delayMs, throttled } where action
  // is one of:
  //   'none'    - do not restart (deliberate shutdown)
  //   'restart' - respawn after delayMs; feed `attempts`/`windowStart` back in
  //               on the next call
  // `throttled` is true when the budget for the current window is already
  // spent; delayMs then waits out the rest of the window instead of restarting
  // straight away. There is no permanent give-up: recognition always gets
  // another chance once the window has passed.
  function decideRestart(state, limits) {
    var cfg = limits || {};
    var maxRestarts = numberOr(cfg.maxRestarts, MAX_RESTARTS_PER_WINDOW);
    var windowMs = numberOr(cfg.windowMs, RESTART_WINDOW_MS);
    var healthyRunMs = numberOr(cfg.healthyRunMs, HEALTHY_RUN_MS);
    var restartDelayMs = numberOr(cfg.restartDelayMs, RESTART_DELAY_MS);

    var now = numberOr(state.now, 0);
    var attempts = typeof state.attempts === 'number' && state.attempts > 0 ? state.attempts : 0;
    var windowStart = numberOr(state.windowStart, now);

    if (state.intentional) {
      return { action: 'none', attempts: attempts, windowStart: windowStart, delayMs: 0, throttled: false };
    }

    // Two things open a fresh budget: the window elapsing, and a process that
    // had been up long enough to count as healthy. Either way this crash is the
    // first one of a new series.
    if (now - windowStart >= windowMs || (state.ranForMs || 0) >= healthyRunMs) {
      attempts = 0;
      windowStart = now;
    }

    if (attempts >= maxRestarts) {
      // Budget spent inside this window. Do not spin: sit out the remainder of
      // the window, then try again with a clean budget.
      var wait = windowStart + windowMs - now;
      return {
        action: 'restart',
        attempts: attempts,
        windowStart: windowStart,
        delayMs: wait > restartDelayMs ? wait : restartDelayMs,
        throttled: true,
      };
    }

    return { action: 'restart', attempts: attempts + 1, windowStart: windowStart, delayMs: restartDelayMs, throttled: false };
  }

  return {
    decideRestart: decideRestart,
    RESTART_DELAY_MS: RESTART_DELAY_MS,
    MAX_RESTARTS_PER_WINDOW: MAX_RESTARTS_PER_WINDOW,
    RESTART_WINDOW_MS: RESTART_WINDOW_MS,
    HEALTHY_RUN_MS: HEALTHY_RUN_MS,
  };
});
