# Face Recognition with Open CV and Deep Neural Network

This module detect and recognize your face for [MagicMirror²](https://magicmirror.builders/). This module is mainly inspired by [MMM-Facial-Recognition-OCV3](https://github.com/normyx/MMM-Facial-Recognition-OCV3) and a tutorial from [Adrian Rosebrock](https://www.pyimagesearch.com/2018/06/25/raspberry-pi-face-recognition/). It use the new DNN (Deep neural network) of OpenCV 4.1 and is much more accurate than the old Haar Cascade method. But also this are still available in this module because for a Raspberry Pi zero the new way will be to heavy.

With this module you can show and hide all other modules depend on which person are recognized. For example: if you are in front of the mirror, the mirror will show you your agenda, but if a stranger are in front, it will not show the agenda.

## Development Status (Final)

Module are finished as far as i can tell, but it was only testet on my development machine and not with my real mirror. I will test it in the next few days and let you know about the development status.

### Update

Now i tested the Module also on my MagicMirror and work fine with the PiCamera.

## Screenshot

Because this Module works in the background, i do not have any Screenshot.

## Dependencies

- [OpenCV 4.1](#opencv)
- [dlib](#dlib)
- [face_recognition](#fr)
- [imutils](#imutils)
- Camera

I use a [Raspberry Pi Spy Cam](https://www.digitec.ch/de/s1/product/sertronics-rpi-spycam-kamera-elektronikmodul-8194042) which i built in in my [mirror](https://forum.magicmirror.builders/topic/10567/my-old-wood-mirror?page=1).

## Install Dependencies

### <a name="opencv"></a>OpenCV

You will find a lot of good examples to install OpenCV 4 for your computer / raspberry pi. I do not write here a new way :-). I only testet it with the OpenCV 4.1 version, so please use this one, maybe newer version will also work, so let me know that i can setup a compatibility list.

- https://www.pyimagesearch.com/2018/08/17/install-opencv-4-on-macos/
- https://www.pyimagesearch.com/2018/09/26/install-opencv-4-on-your-raspberry-pi/
- https://pysource.com/2019/03/15/how-to-install-python-3-and-opencv-4-on-windows/

If you install OpenCV in a virutal environment, please do not forget to set the correct `pythonPath` in the settings.

### <a name="dlib"></a>dlib

You can install dlib easy over pip with the following command.

```sh
pip install dlib
```

### <a name="fr"></a>face_recognition

You can install the face_recognition library easy over pip with the following command.

```sh
pip install face_recognition
```

If you have some issues to install, maybe this [Tutorial](https://www.pyimagesearch.com/2017/05/01/install-dlib-raspberry-pi/) will help.

### <a name="imutils"></a>imutils

You can install imutils easy over pip with the following command.

```sh
pip install imutils
```

## Compatibility

I have tested following Versions. Let me know if you tested it with another Version so i can extend this list.

Tool | Versions
--- | ---
OpenCV | 4.1
dlib | 19.17.0
face_recognition | 1.2.3
imutils | 0.5.2

## Install the Module

Get this module with the command line and load it direct via GitHub.

```sh
cd ~/MagicMirror/modules/
git clone https://github.com/nischi/MMM-Face-Reco-DNN.git
cd MMM-Face-Reco-DNN
npm install
```

## Usage

I will try to do a summary of the most important points to use this Module. If you are interested what that exactly do, have a look to Adrian Rosebrocks [tutorial](https://www.pyimagesearch.com/2018/06/25/raspberry-pi-face-recognition/).

### Faces Dataset

First of all you need to create your face dataset. The module is preconfigure that you set your Dataset in the folder `dataset` in the root folder of the module. But you can use also another folder if you want.

Put each person in a seperate folder like that:

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

As i read through some articles it's enough if you have around **10** pictures each.

### Face recognition embeddings

After you setup your dataset we need to to the embeddings for the recognitions. I prepared a script for that. It took a while on my Macbook and will go much longer on a Raspberry Pi, so if possible, do it on a computer with more power.

You will find this `encode.py` script in folder `tools` in the module. The following arguments are default.

```sh
python3 encode.py -i ../dataset/ -e encodings.pickle -d hog

# or easy with default values

python3 encode.py
```

Argument | Description
--- | ---
-i / --dataset | Path to input directory of faces + images<br />**Default Value:** `../dataset/`
-e / --encodings | Path to serialized db of facial encodings<br />**Default Value:** `encodings.pickle`
-d / --detection-method | Which face detection model to use. "hog" is less accurate but faster on CPUs. "cnn" is a more accurate deep-learning model which is GPU/CUDA accelerated (if available). <br />**Default Value:** `hog`

After that you are ready to configure the module and use it for MagicMirror.

### Module Usage

To setup the module in MagicMirror², add the following script int the config.js file in the config/ MagicMirror² directory.

```js
{
    module: 'MMM-Face-Reco-DNN',
    config: {
      // Logout 15 seconds after user was not detecte anymore, if they will be detected between this 15 Seconds, they delay will start again
      logoutDelay: 15000,
      // How many time the recognition starts, with a RasPi 3+ it would be good every 2 seconds
      checkInterval: 2000,
      // Module set used for strangers and if no user is detected
      defaultClass: 'default',
      // Set of modules which should be shown for every user
      everyoneClass: 'everyone',
      // XML to recognize with haarcascae
      cascade: 'modules/MMM-Face-Reco-DNN/tools/haarcascade_frontalface_default.xml',
      // Pre encoded pickle with the faces
      encodings: 'modules/MMM-Face-Reco-DNN/tools/encodings.pickle',
      // You wanna use pi camera or usb / builtin (1 = raspi camera, 0 = other camera)
      usePiCamera: 1,
      // Method of face detection (dnn = deep neural network, haar = haarcascade)
      method: 'dnn',
      // Which face detection model to use. "hog" is less accurate but faster on CPUs. "cnn" is a more accurate deep-learning model which is GPU/CUDA accelerated (if available).
      detectionMethod: 'hog',
      // How fast in ms should the modules hide and show (face effect)
      animationSpeed: 0,
      // Path to Python to run the face recognition (null / '' means default path)
      pythonPath: null,
      // Should shown welcome message over alert module from MagicMirror
      welcomeMessage: true,
      // Save some pictures from recognized people, if unknown we save it in folder "unknown"
      // So you can extend your dataset and retrain it afterwards for better recognitions
      extendDataset: false,
      // if extenDataset is set, you need to set the full path of the dataset
      dataset: 'modules/MMM-Face-Reco-DNN/dataset/'
    }
}
```

In order for this module to do anything useful you have to assign custom classes to your modules. The class default (if you don't change it) is shown if no user is detected or a stranger. The class everyone (if you don't change it) is shown for all users. To specify modules for a certain user, use their name as classname. Do *not* set any classes to this module, because it has no output and will not work.

```js
{
    module: 'example_module',
    position: 'top_left',
    //Set your classes here seperated by a space.
    //Shown for all users
    classes: 'default everyone'
},
{
    module: 'example_module2',
    position: 'top_left',
    //Only shown for name1
    classes: 'thierry james'
},
{
    module: 'example_module',
    position: 'top_right',
    //Only shown for name1
    classes: 'james'
}
```

## Notifications

The module send some notifications if a user are logged in or logged out. In addition you can request the list of logged in users to check if somebody is in front of the mirror.

You can then use it for you own module like my [MMM-MotionControl](https://github.com/nischi/MMM-MotionControl)

Notification | Direction | Description
--- | --- | ---
USERS_LOGIN | out | Sent if new users are detected in front of the mirror
USERS_LOGOUT | out | Sent if users left front of the mirror
LOGGED_IN_USERS | out | All logged in (Users in front of mirror) Users
GET_LOGGED_IN_USERS | in | Request all logged in Users

## Config

Config | Description
--- | ---
`logoutDelay` | Logout 15 seconds after user was not detecte anymore, if they will be detected between this 15 Seconds, they delay will start again <br />**Default Value:** `15000`
`checkInterval` | How many time the recognition starts, with a RasPi 3+ it would be good every 2 seconds <br />**Default Value:** `2000`
`defaultClass` | Module set used for strangers and if no user is detected <br />**Default Value:** `default`
`everyoneClass` | Set of modules which should be shown for every user <br />**Default Value:** `everyone`
`cascade` | XML to recognize with haarcascae <br />**Default Value:** `modules/MMM-Face-Reco-DNN/tools/haarcascade_frontalface_default.xml`
`encodings` | Pre encoded pickle with the faces <br />**Default Value:** `modules/MMM-Face-Reco-DNN/tools/encodings.pickle`
`usePiCamera` | You wanna use pi camera or usb / builtin (1 = raspi camera, 0 = other camera) <br />**Default Value:** `1`
`method` | Method of face detection (dnn = deep neural network, haar = haarcascade) <br />**Default Value:** `dnn`
`detectionMethod` | Which face detection model to use. "hog" is less accurate but faster on CPUs. "cnn" is a more accurate deep-learning model which is GPU/CUDA accelerated (if available). <br />**Default Value:** `hog`
`animationSpeed` | How fast in ms should the modules hide and show (face effect). <br />**Default Value:** `0`
`pythonPath` | Path to Python where the Face-Recognition will run. <br />**Default Value:** `null`
`welcomeMessage` | Show Welcome Message over alert module from MagicMirror. <br />**Default Value:** `true`
`extendDataset` | Save some pictures from recognized people, if unknown we save it in folder "unknown". So you can extend your dataset and retrain it afterwards for better recognitions. <br />**Default Value:** `false`
`dataset`| If extendDataset is set you need to set the path to the dataset as well. <br /> **Default Value:** `modules/MMM-Face-Reco-DNN/dataset/`

## Credits

- Thanks Adrian Rosebrock for the great tutorial: https://www.pyimagesearch.com/2018/06/25/raspberry-pi-face-recognition/
- Thanks normyx for the first version of Face-Recognition for MagicMirror: https://github.com/normyx/MMM-Facial-Recognition-OCV3
