/* Magic Mirror
 * Module: MMM-Face-Reco-DNN
 *
 * Pure decision logic for the motion gate (see the `motionGate` config).
 * Kept dependency-free and side-effect-free so it can be unit tested with
 * node:test and reused by the browser module (loaded via getScripts()).
 *
 * By Thierry Nischelwitzer http://nischi.ch
 * MIT Licensed.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MotionGate = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Decide what the motion gate should do next given the current inputs.
  //
  // Recognition should run while there is motion OR a user is currently
  // recognized (the presence guard: someone standing still keeps it awake even
  // after motion clears, so the mirror never blanks on a stationary viewer).
  //
  // Returns one of:
  //   'resume'         - was paused, should start recognition now
  //   'schedule-pause' - running and everything quiet, start the pause timer
  //   'cancel-pause'   - running with a pending pause, but activity resumed
  //   'none'           - no change needed
  function nextAction(state) {
    var shouldRun = state.motionActive || state.userPresent;

    if (shouldRun) {
      if (!state.running) {
        return 'resume';
      }
      if (state.pausePending) {
        return 'cancel-pause';
      }
      return 'none';
    }

    if (state.running && !state.pausePending) {
      return 'schedule-pause';
    }
    return 'none';
  }

  return { nextAction: nextAction };
});
