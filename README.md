# Face Recognition with Open CV and Deep Neural Network

This module detects and recognizes your face for [MagicMirror²](https://magicmirror.builders/). This module is mainly inspired by [MMM-Facial-Recognition-OCV3](https://github.com/normyx/MMM-Facial-Recognition-OCV3) and a tutorial from [Adrian Rosebrock](https://www.pyimagesearch.com/2018/06/25/raspberry-pi-face-recognition/). It uses the new DNN (Deep Neural Network) provided by OpenCV 4.1 and is much more accurate than the old Haar Cascade method. The old method is still available in this module because for a Raspberry Pi Zero the new way will be too heavy.

With this module you can show and hide all other modules depending on which person is recognized. For example, if you are in front of the mirror, the mirror will show you your agenda, but if a stranger is in front, the agenda will not be shown.

## Development Status

The module is finished as far as I can tell. I have tested the module on my development machine as well as on the MagicMirror and it works fine with the PiCamera.

## Screenshot

This module works in the background, and so no screenshots are available.

## Dependencies

- [OpenCV 4.1](#opencv)
- [dlib](#dlib)
- [face_recognition](#fr)
- [imutils](#imutils)
- Camera

I used a [Raspberry Pi Spy Cam](https://www.digitec.ch/de/s1/product/sertronics-rpi-spycam-kamera-elektronikmodul-8194042) which i built into my [mirror](https://forum.magicmirror.builders/topic/10567/my-old-wood-mirror?page=1). It also works fine with the regular Raspberry Pi camera module.

## Installation

### <a name="opencv"></a>OpenCV

You will find a lot of good tutorials to install OpenCV 4 for your computer / Raspberry Pi. I am not going to write another one here. The module has only been tested with OpenCV 4.1. If you use another version, please let me know whether it works so I can make a list of all compatible versions.

- https://www.pyimagesearch.com/2018/08/17/install-opencv-4-on-macos/
- https://www.pyimagesearch.com/2018/09/26/install-opencv-4-on-your-raspberry-pi/
- https://pysource.com/2019/03/15/how-to-install-python-3-and-opencv-4-on-windows/

If you install OpenCV in a virtual environment, please do not forget to set the correct `pythonPath` in the settings.

**OpenCV 4.1.2 quick installation (wthout compliation) for Raspbian Buster**

If you are planning to run OpenCV on Raspbian Buster, you can follow [these steps](https://github.com/cyysky/OpenCV-4.1.2-for-Raspbian) to install pre-compilled OpenCV v.4.2.1 package. This will save time for OpenCV compilation. 
```sh
wget https://github.com/cyysky/OpenCV-4.1.2-for-Raspbian/raw/master/opencv_4.1.2-1_armhf.deb
sudo dpkg -i opencv_4.1.2-1_armhf.deb
sudo apt-get -f install
sudo dpkg -i opencv_4.1.2-1_armhf.deb
```

### <a name="dlib"></a>dlib

You can install dlib easily using pip with the following command.

```sh
pip install dlib
```

### <a name="fr"></a>face_recognition

You can install the face_recognition library over pip too.

```sh
pip install face_recognition
```

If you have issues installing, this [tutorial](https://www.pyimagesearch.com/2017/05/01/install-dlib-raspberry-pi/) may be helpful.

### <a name="imutils"></a>imutils

You can install imutils over pip.

```sh
pip install imutils
```

## Compatibility

I have tested the following dependency versions. Let me know if the module works with another version so I can extend this list.

| Dependency       | Versions |
|------------------|----------|
| OpenCV           | 4.1      |
| dlib             | 19.17.0  |
| face_recognition | 1.2.3    |
| imutils          | 0.5.2    |

## Install the Module

Load this module directly from GitHub using the following commands.

```sh
cd ~/MagicMirror/modules/
git clone https://github.com/nischi/MMM-Face-Reco-DNN.git
cd MMM-Face-Reco-DNN
npm install
```

## Usage

Here is a summary of the most important points to use this module. If you are interested how it works, have a look at Adrian Rosebrocks' [tutorial](https://www.pyimagesearch.com/2018/06/25/raspberry-pi-face-recognition/).

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

You will find a script called `encode.py` in folder `tools` of the module. The following arguments are default:

```sh
python3 encode.py -i ../dataset/ -e encodings.pickle -d hog

# Arguments can be omitted to use the defaults above
python3 encode.py
```

| Argument | Description |
|---|---|
| `-i` / `--dataset` | Path to dataset directory containing face images<br />**Default Value:** `../dataset/` |
| `-e` / `--encodings` | Path to serialized database of facial encodings<br />**Default Value:** `encodings.pickle` |
| `-d` / `--detection-method` | Which face detection model to use. "hog" is less accurate but faster on CPUs. "cnn" is a more accurate deep-learning model which is GPU/CUDA accelerated (if available). <br />**Default Value:** `hog` |

After that you are ready to configure the module and use it on your MagicMirror.

### Building encodings.pickle in a Container

Another option for building the encodings.pickle file is to use a Docker container. This way all dependencies and libraries are isolated from the host OS, you will only need `make` and `docker`.

```sh
cd tools;
make  # generate an encodings.pickle with hog, or alternatively

make encoding=cnn  # overide the default to use cnn encoding
```

### Module Usage

To setup the module in MagicMirror², add the following section to the `config.js` file in the `MagicMirror/config` directory.

```js
{
    module: 'MMM-Face-Reco-DNN',
    config: {
      // Logout 15 seconds after user was not detected any more
      // If they are detected within this period, the delay will start again
      logoutDelay: 15000,
      // How often the recognition starts in milliseconds
      // With a Raspberry Pi 3+ it works well every 2 seconds
      checkInterval: 2000,
      // Module set used for strangers or if no user is detected
      defaultClass: 'default',
      // Set of modules which should be shown for every recognised user
      everyoneClass: 'everyone',
      // XML to recognize with haarcascade
      cascade: 'modules/MMM-Face-Reco-DNN/tools/haarcascade_frontalface_default.xml',
      // Pre-encoded pickle with the faces
      encodings: 'modules/MMM-Face-Reco-DNN/tools/encodings.pickle',
      // Use Raspberry Pi camera or another type
      // 1 = RasPi camera, 0 = other camera
      usePiCamera: 1,
      // If using another type of camera, you can choose
      // i.e. 0 = /dev/video0 or 'http://link.to/live'
      source: 0,
      // Rotate camera
      rotateCamera: 0,
      // Method of facial recognition
      // dnn = deep neural network, haar = haarcascade
      method: 'dnn',
      // Which face detection model to use
      // "hog" is less accurate but faster on CPUs
      // "cnn" is a more accurate deep-learning model which is GPU/CUDA accelerated
      detectionMethod: 'hog',
      // How long in milliseconds modules take to hide and show
      animationSpeed: 0,
      // Path to Python to run the face recognition
      // null or '' means default path
      pythonPath: null,
      // Should a welcome message be shown using the MagicMirror alerts module?
      welcomeMessage: true,
      // Capture new pictures of recognized people, if unknown we save it in folder "unknown"
      // So you can extend your dataset and retrain it afterwards for better recognitions
      extendDataset: false,
      // If extendDataset is true, you need to set the full path of the dataset
      dataset: 'modules/MMM-Face-Reco-DNN/dataset/'
    }
}
```

In order for this module to do anything useful you have to assign classes to your modules.

- The class `default` (if you don't rename it) is shown if no user or a stranger is detected
- The class `everyone` (again if you don't change it) is shown for all users
- To specify modules for a certain user, use their name as the class name

Do *not* set any classes on this module, it has no output and will not work.

```js
{
    module: 'example_module',
    position: 'top_left',
    // Set your classes here seperated by a space
    // Shown for all users
    classes: 'default everyone'
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
```

## Notifications

The module sends notifications if a user is logged in or logged out. In addition you can request the list of logged-in users to check if somebody is in front of the mirror. You can then use it for your own module, such as [MMM-MotionControl](https://github.com/nischi/MMM-MotionControl).

| Notification          | Direction | Description                                           |
|-----------------------|-----------|-------------------------------------------------------|
| `USERS_LOGIN`         | out       | Sent if new users are detected in front of the mirror |
| `USERS_LOGOUT`        | out       | Sent if users leave the camera's view                 |
| `LOGGED_IN_USERS`     | out       | All logged in (in front of mirror) users              |
| `GET_LOGGED_IN_USERS` | in        | Request all logged in users                           |

## Configuration

| Option | Description |
|---|---|
| `logoutDelay` | Log out this long after user was not detected any more. If they are detected within this period, the delay will start again. <br />**Default Value:** `15000` |
| `checkInterval` | How often the recognition starts in milliseconds. With a Raspberry Pi 3+ it works well every 2 seconds. <br />**Default Value:** `2000` |
| `defaultClass` | Module set used for strangers or if no user is detected. <br />**Default Value:** `default` |
| `everyoneClass` | Set of modules which should be shown for every recognised user. <br />**Default Value:** `everyone` |
| `cascade` | XML to recognize with haarcascade. <br />**Default Value:** `modules/MMM-Face-Reco-DNN/tools/haarcascade_frontalface_default.xml`. |
| `encodings` | Pre-encoded pickle with the faces. <br />**Default Value:** `modules/MMM-Face-Reco-DNN/tools/encodings.pickle` |
| `usePiCamera` | Use Raspberry Pi camera or another type. (1 = RasPi camera, 0 = other camera) <br />**Default Value:** `1` |
| `method` | Method of facial recognition. (dnn = deep neural network, haar = haarcascade) <br />**Default Value:** `dnn` |
| `detectionMethod` | Which face detection model to use. "hog" is less accurate but faster on CPUs. "cnn" is a more accurate deep-learning model which is GPU/CUDA accelerated (if available). <br />**Default Value:** `hog` |
| `animationSpeed` | How long in milliseconds modules take to hide and show. <br />**Default Value:** `0` |
| `pythonPath` | Path to Python to run the face recognition. <br />**Default Value:** `null` |
| `welcomeMessage` | Should a welcome message be shown using the MagicMirror alerts module? <br />**Default Value:** `true` |
| `extendDataset` | Capture new pictures of recognized people, if unknown we save it in folder "unknown". So you can extend your dataset and retrain it afterwards for better recognitions. <br />**Default Value:** `false` |
| `dataset` | If `extendDataset` is true, you need to set the full path of the dataset as well. <br /> **Default Value:** `modules/MMM-Face-Reco-DNN/dataset/` |

## Credits

- Adrian Rosebrock for the great tutorial: https://www.pyimagesearch.com/2018/06/25/raspberry-pi-face-recognition/
- Normyx for the first version of Face-Recognition for MagicMirror: https://github.com/normyx/MMM-Facial-Recognition-OCV3
