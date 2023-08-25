import face_recognition
import pickle
import time
import cv2
import signal
import os
import numpy
import base64
from datetime import datetime
from utils.image import Image
from utils.arguments import Arguments
from utils.print import Print


def signalHandler(signal, frame):
    global closeSafe
    closeSafe = True


signal.signal(signal.SIGINT, signalHandler)
closeSafe = False

# prepare console arguments
Arguments.prepareRecognitionArguments()

# load the known faces and embeddings along with OpenCV's Haar
# cascade for face detection
Print.printJson("status", "loading encodings + face detector...")
data = pickle.loads(open(Arguments.get("encodings"), "rb").read())
detector = cv2.CascadeClassifier(Arguments.get("cascade"))

# initialize the video stream
Print.printJson("status", "starting video stream...")
src = int(Arguments.get("source"))
processWidth = Arguments.get("processWidth")
resolution = Arguments.get("resolution").split(",")
resolution = (int(resolution[0]), int(resolution[1]))
Print.printJson("status", src)
Print.printJson("status", resolution)
Print.printJson("status", processWidth)
vs = cv2.VideoCapture(src)
vs.set(cv2.CAP_PROP_FRAME_WIDTH, resolution[0])
vs.set(cv2.CAP_PROP_FRAME_HEIGHT, resolution[1])

# variable for prev names
prevNames = []

# create unknown path if needed
if Arguments.get("extendDataset") is True:
    unknownPath = os.path.dirname(Arguments.get("dataset") + "unknown/")
    try:
        os.stat(unknownPath)
    except:
        os.mkdir(unknownPath)

tolerance = float(Arguments.get("tolerance"))

# loop over frames from the video file stream
while True:
    # read the frame
    retval, originalFrame = vs.read()
    
    # adjust image brightness and contrast
    originalFrame = Image.adjust_brightness_contrast(
        originalFrame, Arguments.get("brightness"), Arguments.get("contrast")
    )

    if Arguments.get("rotateCamera") >= 0 and Arguments.get("rotateCamera") <= 2:
        originalFrame = cv2.rotate(originalFrame, Arguments.get("rotateCamera"))

    # resize image if we wanna process a smaller image
    if processWidth != resolution[0] and processWidth != 0:
        frame = Image.resize(originalFrame, width=processWidth)
    else:
        frame = originalFrame

    if Arguments.get("method") == "dnn":
        # load the input image and convert it from BGR (OpenCV ordering)
        # to dlib ordering (RGB)
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        # detect the (x, y)-coordinates of the bounding boxes
        # corresponding to each face in the input image
        boxes = face_recognition.face_locations(
            rgb, model=Arguments.get("detectionMethod")
        )
    elif Arguments.get("method") == "haar":
        # convert the input frame from (1) BGR to grayscale (for face
        # detection) and (2) from BGR to RGB (for face recognition)
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # detect faces in the grayscale frame
        rects = detector.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30),
            flags=cv2.CASCADE_SCALE_IMAGE,
        )

        # OpenCV returns bounding box coordinates in (x, y, w, h) order
        # but we need them in (top, right, bottom, left) order, so we
        # need to do a bit of reordering
        boxes = [(y, x + w, y + h, x) for (x, y, w, h) in rects]

    # compute the facial embeddings for each face bounding box
    encodings = face_recognition.face_encodings(rgb, boxes)
    names = []

    # loop over the facial embeddings
    for encoding in encodings:
        # compute distances between this encoding and the faces in dataset
        distances = face_recognition.face_distance(data["encodings"], encoding)

        minDistance = 1.0
        if len(distances) > 0:
            # the smallest distance is the closest to the encoding
            minDistance = min(distances)

        # save the name if the distance is below the tolerance
        if minDistance < tolerance:
            idx = numpy.where(distances == minDistance)[0][0]
            name = data["names"][idx]
        else:
            name = "unknown"

        # update the list of names
        names.append(name)

    # loop over the recognized faces
    for (top, right, bottom, left), name in zip(boxes, names):
        # draw the predicted face name on the image
        cv2.rectangle(frame, (left, top), (right, bottom), (0, 255, 0), 2)
        y = top - 15 if top - 15 > 15 else top + 15
        txt = name + " (" + "{:.2f}".format(minDistance) + ")"
        cv2.putText(
            frame, txt, (left, y), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 0), 2
        )

    # display the image to our screen
    if Arguments.get("output") == 1:
        cv2.imshow("Frame", frame)

    if Arguments.get("outputmm") == 1:
        retval, buffer = cv2.imencode('.jpg', frame)
        jpg_as_text = base64.b64encode(buffer).decode()
        Print.printJson("camera_image", {"image": jpg_as_text})

    # update the FPS counter
    # fps.update()

    logins = []
    logouts = []
    # Check which names are new login and which are new logout with prevNames
    for n in names:
        if prevNames.__contains__(n) == False and n is not None:
            logins.append(n)

            # if extendDataset is active we need to save the picture
            if Arguments.get("extendDataset") is True:
                # set correct path to the dataset
                path = os.path.dirname(Arguments.get("dataset") + "/" + n + "/")

                today = datetime.now()
                cv2.imwrite(
                    path + "/" + n + "_" + today.strftime("%Y%m%d_%H%M%S") + ".jpg",
                    originalFrame,
                )
    for n in prevNames:
        if names.__contains__(n) == False and n is not None:
            logouts.append(n)

    # send inforrmation to prompt, only if something has changes
    if logins.__len__() > 0:
        Print.printJson("login", {"names": logins})

    if logouts.__len__() > 0:
        Print.printJson("logout", {"names": logouts})

    # set this names as new prev names for next iteration
    prevNames = names

    key = cv2.waitKey(1) & 0xFF
    # if the `q` key was pressed, break from the loop
    if key == ord("q") or closeSafe == True:
        break

    time.sleep(Arguments.get("interval") / 1000)

# do a bit of cleanup
vs.release()
cv2.destroyAllWindows()
