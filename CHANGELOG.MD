# 2.0.2 (2024-11-12)
- Added feature to conditionally trigger face recognition to start and stop via a Magic Mirror notification. Use of this feature is optional. Use for example with MMM-Pir to turn off face recognition when monitor is off, and back on when monitor is on.
  - node_helper sends commands to the python child process via its std input upon receiving an external notfication. 
  - CPU utilization of python process is substatially reduced while face recognition is paused. RPi power consumption also reduced
- Added SIGTERM signal handling to recognition.py so python process reliably stops when Magic Mirror application is terminated
- Improved recognition.py loop timing so the target interval specified by `checkInterval` is better enforced by the main loop

# 2.0.1 (2023-11-01)

- After a lot of install issues. We removed `pipenv` again and changed the install-instructions
  - For Bookworm we added an extra install step for an virtual environment

# 2.0.0 (2023-10-01)

## Breaking Changes

- Following Settings have changed and are breaking changes
  - `cascade` - chnage default path according to the new folder structure
  - `encodings` - chnage default path according to the new folder structure
  - `usePiCamera` and `source` - not avialable anymore because of auto-detection with `picamera2` library
  - `brightness` - new possible values are 0-100
  - `contrast` - new possible values are 0-127
  - `rotateCamera` - new possible values are -1 = no rotation, 0 = 90°, 1 = 180°, 2 = 270°
  - `pythonPath` - still works if you like to use it, but it is not necessary anmore with pipenv
  - `resolution` - default resolution was changed from `[1280, 960]` to `[1920,1080]`
- Some old OS images are not supported anymore according to `picamera2`

### Folder structure

- Move haarcascade from `tools` to `model`
- `encodings.pickle` is now by default in folder `model`
- `Dockerfile` was removed because of new simple setup
- `Makefile` was removed because of new simple setup
- `facerecognition.py` was renamed to `recognition.py`
- Split `recognition.py` functions into mulitple utils files

### pipenv

- To be sure everything is installed what is needed for this module we
  implemented pipenv and add all dependencies automaticly with pip and pipenv.
  It will be installed after `npm install`.

### Camera support

- We use the new `picamera2` library to read the camera image. It should support
  all the picameras and some third party cameras.

### OS support

- Because we use the `picamera2` libary, we support Raspberry Pi OS Bullseye (or later) 32bit and 64bit.

- Picamera2 is not supported on:
  - Images based on Buster or earlier releases.
  - Raspberry Pi OS Legacy images.
  - Bullseye (or later) images where the legacy camera stack has been re-enabled.

### NPM scripts

- We have new npm scripts which helps to setup the module
  - `npm run encode`
  - `npm run recognition`
