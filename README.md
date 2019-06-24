# Face Recognition with Open CV and Deep Neural Network (WORK IN PROGRESS)

## Tutorial

https://www.pyimagesearch.com/2018/06/25/raspberry-pi-face-recognition/

## Dependencies

- OpenCV 4.1
- dlib
- face_recognition
- imutils

## Install Dependencies

### OpenCV

- https://www.pyimagesearch.com/2018/08/17/install-opencv-4-on-macos/
- https://www.pyimagesearch.com/2018/09/26/install-opencv-4-on-your-raspberry-pi/
- https://pysource.com/2019/03/15/how-to-install-python-3-and-opencv-4-on-windows/

### dlib

`pip install dlib`

### face_recognition

`pip install face_recognition`

### imutils

`pip install imutils`

## Usage

`python3 encode.py -i ../dataset/ -e encodings.pickle`

## Config

  logoutDelay: 15000,
  checkInterval: 2000,
  defaultClass: "default",
  everyoneClass: "everyone",
  welcomeMessage: true,
  cascade: 'tools/haarcascade_frontalface_default.xml',
  encodings: 'tools/encodings.pickle',
  usePiCamera: 1,
  method: 'dnn',
  detectionMethod: 'hog'
