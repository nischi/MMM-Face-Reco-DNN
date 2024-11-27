import base64
import cv2
import face_recognition
import numpy
import os
import pickle
import signal
import sys
import threading
import time
from datetime import datetime
from utils.image import Image
from utils.arguments import Arguments
from utils.print import Print
from picamera2 import Picamera2

def signalHandler(signal, frame):
    global closeSafe
    closeSafe = True

signal.signal(signal.SIGINT, signalHandler)
signal.signal(signal.SIGTERM, signalHandler)
closeSafe = False

external_trigger = True # Default to true to start recognition on startup

def monitor_stdin_for_command():
    """
    Function for monitoring std input for commands to start or stop face recognition.

    Note: Avoid putting print statements in this function, as will run asynchronously in 
    a thread. Print statements could get weaved in with other print statements, which may
    break the parent Magic Mirror processes processing of this tool's std output. 
    """
    global external_trigger
    while True:
        line = sys.stdin.readline()
        if 'start' in line:
            external_trigger = True
        elif 'stop' in line:
            external_trigger = False
        elif 'exit' in line or line == '':
            # If exit or EOF sent, break loop
            external_trigger = False
            break

# prepare console arguments
Arguments.prepareRecognitionArguments()

# load the known faces and embeddings along with OpenCV's Haar
# cascade for face detection
Print.printJson("status", "loading encodings + face detector...")
data = pickle.loads(open(Arguments.get("encodings"), "rb").read())
detector = cv2.CascadeClassifier(Arguments.get("cascade"))

# initialize the video stream
Print.printJson("status", "starting video stream...")
processWidth = Arguments.get("processWidth")
resolution = Arguments.get("resolution").split(",")
resolution = (int(resolution[0]), int(resolution[1]))
Print.printJson("status", resolution)
Print.printJson("status", processWidth)

picam2 = Picamera2()
picam2.configure(picam2.create_preview_configuration(main={"size": (resolution[0], resolution[1]), "format": "XRGB8888"}))
picam2.start()


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

# Default to running face recognition
run_face_recognition = True

# If triggering face recognition on external notification, start
# listener thread for that external trigger
if Arguments.get("run_only_on_notification"):
    stdin_monitoring_thread = threading.Thread(target=monitor_stdin_for_command, daemon=True)
    stdin_monitoring_thread.start()
    Print.printJson("status", "Started stdin monitoring thread for triggering face recognition.")


# loop over frames from the video file stream
Print.printJson("status", "Starting face recognition loop.")
while True:
    loop_start_time = time.time()
    
    if Arguments.get("run_only_on_notification"):
        if run_face_recognition == False and external_trigger == True:
            # Externally triggered to run face recognition
            Print.printJson("status", "Starting face recognition.")
            run_face_recognition = True
            picam2.start()

        elif run_face_recognition == True and external_trigger == False:
            # Externally triggered to stop face recognition.
            Print.printJson("status", "Stopping face recognition and logging out any logged in users.")
            run_face_recognition = False
            picam2.stop()
            
            # Log out any users that were logged in, and clear prevNames list
            if prevNames:
                Print.printJson("logout", {"names": prevNames})
                prevNames.clear()

    if run_face_recognition:
        # read the frame
        originalFrame = picam2.capture_array()

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
    
    # Calculate how long the loop ran thus far. If loop time was less than 
    # the specified interval, sleep more to meet the target interval
    loop_time = time.time() - loop_start_time
    time.sleep(max(0.0, Arguments.get("interval") / 1000 - loop_time))


# do a bit of cleanup
picam2.stop()
cv2.destroyAllWindows()
