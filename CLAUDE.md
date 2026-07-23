# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

MMM-Face-Reco-DNN is a [MagicMirror²](https://magicmirror.builders/) module that detects and recognizes faces via a camera, then shows/hides other MagicMirror modules depending on who is standing in front of the mirror. It has **no visual output of its own** (optionally it can echo the annotated camera frame); its job is to drive the visibility of *other* modules through CSS classes.

The system is split across two runtimes that communicate over a JSON pipe:

- **Node.js side** — the MagicMirror module (`MMM-Face-Reco-DNN.js`, browser context) and its `node_helper.js` (Node context, runs on the MM server).
- **Python side** — the OpenCV / dlib face recognition scripts under `tools/`.

## Commands

```sh
npm ci                 # install node deps, then pip-installs the python deps (see README)
npm run lint           # eslint over all JS
npm run prettier       # format all JS in place
npm test               # node --test (motiongate.js) + python -m pytest tools/tests
npm run encode         # build model/encodings.pickle from the dataset/ folder
npm run recognition    # run the recognition loop standalone (for debugging outside MM)
```

Unit tests cover the pure logic with no camera/models: Python (`tools/tests/`) for recognition, image utils, and the encodings pickle format; JS (`test/motiongate.test.js`, `node --test`) for the motion-gate decision. The rest (camera capture, live recognition, MM integration) is still verified manually. Run a single test with `pytest tools/tests/test_recognizer.py -k best_match` or `node --test test/motiongate.test.js`.

Node version is pinned to **20.5** (`.nvmrc`). Any NumPy version works — the old `numpy<2` pin was a `dlib` constraint and is gone.

Python entry points can also be run directly (their default model paths assume the `tools/` cwd):
```sh
python tools/encode.py -i dataset -e model/encodings.pickle -dm model/face_detection_yunet_2023mar.onnx -rm model/face_recognition_sface_2021dec.onnx
python tools/recognition.py -e model/encodings.pickle -dm model/face_detection_yunet_2023mar.onnx -rm model/face_recognition_sface_2021dec.onnx
```

## Architecture

### The two-process pipeline

1. On MM startup, `MMM-Face-Reco-DNN.js` `start()` sends its full `config` to `node_helper.js` via `sendSocketNotification('CONFIG', ...)`.
2. `node_helper.js` `python_start()` spawns `tools/recognition.py` with **python-shell** in `json` mode, translating every config key into a `--flag=value` CLI arg. The Python arg parser lives in `tools/utils/arguments.py` — **any config option the Python side needs must be wired in three places**: the module `defaults`, the `node_helper.js` `args` array, and `arguments.py`. (Browser-only options, like the motion-gate notification names, live only in the module `defaults`.)
3. The Python loop grabs camera frames (`picamera2`), detects + recognizes faces, and emits newline-delimited JSON objects on stdout (`utils/print.py` → `Print.printJson`). Keys it emits: `status`, `login`, `logout`, `camera_image`.
4. `node_helper.js` reads those messages and forwards `login`/`logout` to the browser module as a `user` socket notification (and `camera_image` if `outputmm` is on).
5. `MMM-Face-Reco-DNN.js` turns those into MagicMirror notifications (`USERS_LOGIN`, `USERS_LOGOUT`, `USERS_LOGOUT_MODULES`) and, more importantly, shows/hides modules.

Communication is **bidirectional**: `node_helper.js` can write `start`/`stop`/`exit` commands to the Python process's stdin. Python's `monitor_stdin_for_command()` thread reads these to pause/resume recognition. Two features drive this: the `external_trigger_notification` config (recognition runs while that MM notification's payload is `true`, e.g. pause when the screen is off), and the **motion gate** (below). Either enables `--run-only-on-notification`; the gate additionally passes `--start-paused=1` so Python boots paused.

### The motion gate (`motionGate`)

Opt-in pause-when-idle, driven by [MMM-MotionControl](https://github.com/nischi/MMM-MotionControl)'s `MOTION_WAKE` / `MOTION_CLEARED` broadcasts. The decision logic is a pure function in `motiongate.js` (`MotionGate.nextAction`), loaded into the browser via `getScripts()` and unit-tested with `node --test` (`test/motiongate.test.js`). The browser module holds the state (`motionActive`, `motionRunning`, `motionPauseTimer`) and calls `applyMotionGate()` on every relevant event (wake, cleared, login, logout). Core rule: run while `motionActive || userPresent` — the `userPresent` term is the **presence guard** so recognition never pauses on someone standing still. When it should pause, a `motionPauseDelay` timer fires and the module sends `MOTION_GATE_CONTROL` (`start`/`stop`) to `node_helper`, which forwards it to Python's stdin. Boots paused via `--start-paused`; resumes on the first wake.

### The class/state visibility engine (the tricky part)

This is the heart of the browser module and where most logic bugs live. There are three **states**: `noface`, `unknown`, `known`. Users don't map to states directly — instead each state activates a set of **classes**, and other MM modules opt into visibility by tagging themselves with those classes (`always`, `default`, `everyone`, `noface`, `unknown`, `known`, or a person's lowercased name).

- State→class mappings are precomputed in `start()` as `classes_noface`, `classes_unknown`, `classes_known`.
- `login_user()` / `logout_user()` compute the class set that *should* be visible, diff it against what *was* visible, then call `show_modules(show, except)` / `hide_modules(hide, except)`. The `except` argument prevents a module shared between the old and new state from flickering.
- Multi-user (`multiUser` > 0) makes this genuinely stateful: `this.users` (array) and `this.userClasses` (name→classes map) accumulate, and `get_class_set()` unions all logged-in users' classes. Logout recomputes the remaining union rather than just hiding one user's classes. Multi-user support is documented as incomplete.
- Logouts are debounced by `logoutDelay` via `this.timouts` (sic) — a re-detection within the window clears the pending logout so users don't flicker out.

When editing this logic, trace the `debug: 1` log statements — they narrate every state transition and are the intended debugging tool.

### Recognition internals (`tools/recognition.py`)

- Detection + recognition use OpenCV's bundled ONNX models: **YuNet** (`cv2.FaceDetectorYN`) locates faces and returns bbox + 5 landmarks; **SFace** (`cv2.FaceRecognizerSF`) aligns each face via those landmarks (`alignCrop`) and produces a 128-D embedding. Detection and recognition are therefore coupled — SFace alignment needs YuNet's landmarks.
- A face is "known" when its best **cosine similarity** to the encoded dataset is `>= cosineThreshold` (default `0.363`, **higher = stricter**); otherwise `"unknown"`. `detScoreThreshold` (default `0.9`) is YuNet's detection-confidence floor.
- The two non-trivial pure functions live in `tools/utils/recognizer.py` (`best_match`, `diff_logins_logouts`) so they can be unit tested without a camera or models; `recognition.py` injects the real SFace `match` as the similarity function. **When touching match/diff logic, edit `recognizer.py` and its tests, not just the loop.**
- The on-frame overlay (bbox + score) is only computed when `output` or `outputmm` is on — the normal MM path skips all drawing.
- `extendDataset: true` saves captured frames into `dataset/<name>/` (unknowns into `dataset/unknown/`) so the model can be retrained later via `npm run encode`.
- `encode.py` uses a lenient detection threshold (0.6) and embeds only the highest-scoring face per image, since dataset folders are curated (one person each).

### Supporting pieces

- `tools/utils/` — `recognizer.py` (pure match/diff logic), `camera.py` (picamera2 vs OpenCV-webcam abstraction; `picamera2` is imported lazily so non-Pi hosts can test with `--camera=webcam`), `image.py` (resize, brightness/contrast, image listing), `print.py` (the JSON stdout protocol), `helper.py` (`str2bool`), `arguments.py` (argparse).
- `tools/tests/` — pytest suite; `conftest.py` puts `tools/` on `sys.path` so tests import `utils.*` like the scripts do.
- `tools/takesPictures.py` — standalone Raspberry Pi camera capture helper to build a dataset by name (spacebar to capture, `q` to quit).
- `model/` — holds the two ONNX models (committed) plus the generated `encodings.pickle` (gitignored).
- `translations/` — welcome-message strings for 12 locales; the module translates the `stranger`/`knownlogin`/`unknownlogin`/`title` keys.

## Conventions

- Prettier config is non-standard: single quotes, semicolons, trailing commas, **printWidth 180**, 2-space tabs, `arrowParens: avoid`. Run `npm run prettier` before committing JS.
- ESLint caps cyclomatic `complexity` at 27 (the visibility engine is close to it) and ignores unused args prefixed with `_`.
- Commits/PRs follow the existing conventional-commit-ish style visible in `git log`; the current working branch is `feature/new-release`, PRs target `master`.
