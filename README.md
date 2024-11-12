# Face Recognition with Open CV

This module detects and recognizes your face for [MagicMirror²](https://magicmirror.builders/).

With this module you can show and hide all other modules depending on which person is recognized. For example, if you are in front of the mirror, the mirror will show you your agenda, but if a stranger is in front, the agenda will not be shown.

## Screenshot

This module works in the background, and so no screenshots are available.

## Dependencies

- [OpenCV](#opencv)
- [dlib](#dlib)
- [face_recognition](#fr)
- [numpy](#numpy)
- [picamera2](#picamera2)
- [libcap-dev](#libcap-dev)

## Installation

The installation is much more simplified now. You can run `npm ci` to install all the node packages and after that it will install all packages with pip. This can take a while to compile the whole opencv stuff.

Be sure that your raspberry pi has enough cooling to do this job, it will be heavily used. It is also 
likely necessary to increase the available SWAP space for opencv and dlib to succesfully compile. SWAP 
can be increased by editing the file: `sudo nano /etc/dphys-swapfile` and changing
the value of `CONF_SWAPSIZE`. 1024 MB was enough to work on a RPi 4 (i.e. `CONF_SWAPSIZE=1024`). 

For the installation procedure to work, you first need the following installed beforehand system wide:

- node with nvm
  - [install instructions](https://github.com/nvm-sh/nvm#installing-and-updating)
  - run `nvm install --lts` to install latest LTS version
  - run `nvm use --lts` to use latest LTS version
- pip
  - `sudo apt install python3-pip`
- libcap-dev
  - `sudo apt install libcap-dev`
- install python dependencies
  - If you working with Bookworm you need to create first an virtual environment, please have a look in the next chapter
  - Numpy versions 2.0+ do not seem to work with this module
  - `pip install face-recognition numpy==1.26.4 dlib picamera2 opencv-python`

### Some additional steps for Bookworm and above to run it with an virtual environment

If you want/need to install it with an virtual environment, you need to do following steps before you install the packages with pip

- create environment with `python3 -m venv ~/python-facereco`
- activate environment with `source ~/python-facereco/bin/activate`
- install pip packages with `pip install face-recognition numpy==1.26.4 dlib picamera2 opencv-python`
- Because some libraries uses global installed libs which are not available with pip, you need to change the config of your virtual environment
  - `nano ~/python-facereco/pyvenv.cfg`
  - Change line `include-system-site-packages = false` to `include-system-site-packages = true`

## Install the Module

Load this module directly from GitHub using the following commands.

```sh
cd ~/MagicMirror/modules/
git clone https://github.com/nischi/MMM-Face-Reco-DNN.git
cd MMM-Face-Reco-DNN
npm install
```

### Face Dataset

First of all you need to create your face dataset. The module is preconfigured such that you store your dataset in the folder `dataset` in the root of the module. It is possible to use another folder if you want to.

Put each person in a seperate subdirectory like this:

```
- dataset
  - thierry
    - img01.jpg
    - img02.jpg
    - img03.jpg
  - adam
    - img01.jpg
    - img02.jpg
    - img03.jpg
  - james
    - img01.jpg
    - img02.jpg
    - img03.jpg
  - john
    - img01.jpg
    - img02.jpg
    - img03.jpg
```

It's enough if you have around **10** pictures for each person. Try to use pictures in different settings and lighting if possible as it may help to build a better model of the person's face.

### Facial Recognition Embeddings

After you set up your dataset, we need to go to the embeddings for the recognitions. I prepared a script for that. It took a while to run on my Macbook and will take much longer on a Raspberry Pi, so if possible, use it on a computer with more power and then transfer the resulting file.

You will find a script called `encode.py` in folder `tools` of the module. You can simply run following command:

```sh
npm run encode
```

After that you are ready to configure the module and use it on your MagicMirror.

### Module Usage

To setup the module in MagicMirror², add the following section to the `config.js` file in the `MagicMirror/config` directory.

```js
{
    module: 'MMM-Face-Reco-DNN',
    config: {
      // Logout 15 seconds after user was not detecte anymore, if they will be detected between this 15
      // Seconds, they delay will start again
      logoutDelay: 15000,
      // How many time the recognition starts, with a RasPi 3+ it would be good every 2 seconds
      checkInterval: 2000,
      // Module set used for when there is no face detected ie no one is in front of the camera
      noFaceClass: 'noface',
      // Module set used for when there is an unknown/unrecognised face detected
      unknownClass: 'unknown',
      // Module set used for when there is a known/recognised face detected
      knownClass: 'known',
      // Module set used for strangers and if no user is detected
      defaultClass: 'default',
      // Set of modules which should be shown for any user ie when there is any face detected
      everyoneClass: 'everyone',
      // Set of modules that are always shown - show if there is a face or no face detected
      alwaysClass: 'always',
      // xml to recognize with haarcascade
      cascade: 'modules/MMM-Face-Reco-DNN/model/haarcascade_frontalface_default.xml',
      // pre encoded pickle with the faces
      encodings: 'modules/MMM-Face-Reco-DNN/model/encodings.pickle',
      // Brightness (0-100)
      brightness: 0,
      // Contrast (0-127)
      contrast: 0,
      // Rotate camera image (-1 = no rotation, 0 = 90°, 1 = 180°, 2 = 270°)
      rotateCamera: -1,
      // method of face recognition (dnn = deep neural network, haar = haarcascade)
      method: 'dnn',
      // which face detection model to use. "hog" is less accurate but faster on CPUs. "cnn" is a more accurate
      // deep-learning model which is GPU/CUDA accelerated (if available). The default is "hog".
      detectionMethod: 'hog',
      // how fast in ms should the modules hide and show (face effect)
      animationSpeed: 0,
      // Path to Python to run the face recognition (null / '' means default path, with Bookworm you need to set the virutal environment like /home/youruser/python-facereco/bin/python3. You can also find out the correct path if you are activated the virtual environment and run "which python3")
      pythonPath: null,
      // Boolean to toggle welcomeMessage
      welcomeMessage: true,
      // Dictionary for person name mapping in welcome message
      // Allows for displaying name with complex character sets in welcome message
      // e.g. jerome => Jérôme, hideyuki => 英之, mourad => مراد
      usernameDisplayMapping: null,
      // Save some pictures from recognized people, if unknown we save it in folder "unknown"
      // So you can extend your dataset and retrain it afterwards for better recognitions
      extendDataset: false,
      // if extenDataset is set, you need to set the full path of the dataset
      dataset: 'modules/MMM-Face-Reco-DNN/dataset/',
      // How much distance between faces to consider it a match. Lower is more strict.
      tolerance: 0.6,
      // allow multiple concurrent user logins, 0=no, any other number is the maximum number of concurrent logins
      multiUser: 0,
      // resoltuion of the image
      resolution: [1920, 1080],
      // width of the image for processing
      processWidth: 500,
      // output image on mm
      outputmm: 0,
      // turn on extra debugging 0=no, 1=yes
      debug: 0,
      // If specified, conditionally run face recognition when a notification with a name as specified by this 
      // option is received with a boolean true/false payload. A True payload activates face recognition, False 
      // deactivates it. An empty string here disables this functionality so face recognition always runs. Use for 
      // exmaple with with MMM-Pir with notification name 'MMM_PIR-SCREEN_POWERSTATUS' to only run face 
      // recognition when screen is on.
      external_trigger_notification: '',
    }
}
```

## Notifications

The module sends notifications if a user is logged in or logged out. In addition you can request the list of logged-in users to check if somebody is in front of the mirror. You can then use it for your own module, such as [MMM-MotionControl](https://github.com/nischi/MMM-MotionControl).

| Notification          | Direction | Description                                           |
| --------------------- | --------- | ----------------------------------------------------- |
| `USERS_LOGIN`         | out       | Sent if new users are detected in front of the mirror |
| `USERS_LOGOUT`        | out       | Sent if users leave the camera's view                 |
| `LOGGED_IN_USERS`     | out       | All logged in (in front of mirror) users              |
| `GET_LOGGED_IN_USERS` | in        | Request all logged in users                           |

## Facial Recognition States

There are 3 states that of facial recogntion that this module runs in. The states are not directly configurable but rather you use the classes to define which modules are activated in the various states.

| State   | Description                                                                           |
| ------- | ------------------------------------------------------------------------------------- |
| noface  | This is the state when facial recognition has found no faces                          |
| unknown | This is the state when facial recognition has found a face that it does NOT recognise |
| known   | This is the state when facial recognition has found a face that it does recognise     |

## Classes

In order for this module to do anything useful you have to assign classes to your modules. Do _not_ set any classes on this module itself, it has no output and will not work.

There are a series of classes that drive the showing/hiding of modules based on the state of facial recognition. The following table gives a view of which classes drive which states.

When a state changes, the classes from the old state are hidden and the classes from the new state are shown. Anytime that a specific class appears in both states, nothing happens to the modules tagged with that specific class.

For example:

- starting from no faces detected, when an unknown face is detected, any modules tagged with the `noface` class will disappear and any modules tagged with the `unknown` class will appear.
- starting from no faces detected, when an unknown face is detected, any modules tagged with the `default` class will remain unchanged, because `default` provides both the Noface and the Unknown states.
- starting from no faces detected, when an known face is detected, any modules tagged with the `default` class will be hidden and modules tagged with `known` or "specific user's name" ie to specify modules for a certain user, use their name as the class name

The state to class mappings are:

<table>
  <thead>
    <tr>
      <td></td>
      <td colspan=3>States that the class is active in</td>
    </tr>
    <tr>
      <td><b>Class</b></td>
      <td><b>Noface</b></td>
      <td><b>Unknown</b></td>
      <td><b>Known</b></td>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><code>noface</code></td>
      <td align=center>Y</td>
      <td align=center></td>
      <td align=center></td>
    </tr>
    <tr>
      <td><code>unknown</code></td>
      <td align=center></td>
      <td align=center>Y</td>
      <td align=center></td>
    </tr>
    <tr>
      <td><code>known</code></td>
      <td align=center></td>
      <td align=center></td>
      <td align=center>Y</td>
    </tr>
    <tr>
      <td><code>default</code></td>
      <td align=center>Y</td>
      <td align=center>Y</td>
      <td align=center></td>
    </tr>
    <tr>
      <td><code>everyone</code></td>
      <td align=center></td>
      <td align=center>Y</td>
      <td align=center>Y</td>
    </tr>
    <tr>
      <td><code>always</code></td>
      <td align=center>Y</td>
      <td align=center>Y</td>
      <td align=center>Y</td>
    </tr>
    <tr>
      <td><code>"specific user's name"</code></td>
      <td align=center></td>
      <td align=center></td>
      <td align=center>Y</td>
    </tr>
  </tbody>
</table>

```js
{
    module: 'example_module',
    position: 'top_left',
    // Set your classes here seperated by a space
    // Always shown
    classes: 'always'
},
{
    module: 'example_module_2',
    position: 'top_left',
    // Only shown for Thierry and James
    classes: 'thierry james'
},
{
    module: 'example_module_3',
    position: 'top_right',
    // Only shown for James
    classes: 'james'
}
{
    module: 'example_module_4',
    position: 'top_right',
    // Only shown for known (recognised users)
    classes: 'known'
}
```

## Known Issues

- Support for multiple concurrently logged in users is not yet complete.
