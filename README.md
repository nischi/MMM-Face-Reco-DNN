# Face Recognition with Open CV and Deep Neural Network (Pre-Alpha)

This module detect and recognize your face for [MagicMirror²](https://magicmirror.builders/). This module is mainly inspired by [MMM-Facial-Recognition-OCV3](https://github.com/normyx/MMM-Facial-Recognition-OCV3) and a tutorial from [Adrian Rosebrock](https://www.pyimagesearch.com/2018/06/25/raspberry-pi-face-recognition/). It use the new DNN (Deep neural network) of OpenCV 4.1 and is much more accurate than the old Haar Cascade method. But also this are still available in this module because for a Raspberry Pi zero the new way will be to heavy.

## Screenshot

Because this Module works in the background, i do not have any Screenshot.

## Dependencies

- [OpenCV 4.1](#opencv)
- [dlib](#dlib)
- [face_recognition](#fr)
- [imutils](#imutils)

## Install Dependencies

### <a name="opencv"></a>OpenCV

You will find a lot of good examples to install OpenCV 4 for your computer / raspberry pi. I do not write here a new way :-). I only testet it with the OpenCV 4.1 version, so please use this one, maybe newer version will also work, so let me know that i can setup a compatibility list.

- https://www.pyimagesearch.com/2018/08/17/install-opencv-4-on-macos/
- https://www.pyimagesearch.com/2018/09/26/install-opencv-4-on-your-raspberry-pi/
- https://pysource.com/2019/03/15/how-to-install-python-3-and-opencv-4-on-windows/

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
```

## Usage

TODO

`python3 encode.py -i ../dataset/ -e encodings.pickle`

## Config

Config | Description
--- | ---
`logoutDelay` | Logout 15 seconds after user was not detecte anymore, if they will be detected between this 15 Seconds, they delay will start again <br />**Default Value:** `15000`
`checkInterval` | How many time the recognition starts, with a RasPi 3+ it would be good every 2 seconds <br />**Default Value:** `2000`
`defaultClass` | Module set used for strangers and if no user is detected <br />**Default Value:** `default`
`everyoneClass` | Set of modules which should be shown for every user <br />**Default Value:** `everyone`
`cascade` | XML to recognize with haarcascae <br />**Default Value:** `tools/haarcascade_frontalface_default.xml`
`encodings` | Pre encoded pickle with the faces <br />**Default Value:** `tools/encodings.pickle`
`usePiCamera` | You wanna use pi camera or usb / builtin (1 = raspi camera, 0 = other camera) <br />**Default Value:** `1`
`method` | Method of face detection (dnn = deep neural network, haar = haarcascade) <br />**Default Value:** `dnn`
`detectionMethod` | Which face detection model to use. "hog" is less accurate but faster on CPUs. "cnn" is a more accurate deep-learning model which is GPU/CUDA accelerated (if available). The default is "hog". <br />**Default Value:** `hog`

## Credits

- Thanks Adrian Rosebrock for the great tutorial: https://www.pyimagesearch.com/2018/06/25/raspberry-pi-face-recognition/
- Thanks normyx for the first version of Face-Recognition for MagicMirror: https://github.com/normyx/MMM-Facial-Recognition-OCV3
