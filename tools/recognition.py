import base64
import cv2
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
from utils.recognizer import Recognizer
from utils.camera import Camera

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

# load the known faces and embeddings along with OpenCV's YuNet face detector
# and SFace face recognizer (both bundled with OpenCV's DNN module)
Print.printJson("status", "loading encodings + face detector...")
data = pickle.loads(open(Arguments.get("encodings"), "rb").read())
detector = cv2.FaceDetectorYN.create(
    Arguments.get("detModel"), "", (320, 320), float(Arguments.get("detScoreThreshold"))
)
recognizer = cv2.FaceRecognizerSF.create(Arguments.get("recModel"), "")

# production similarity: SFace cosine similarity between the query feature and a
# stored embedding (reshaped back to the (1, 128) form OpenCV expects).
def sface_similarity(query_feature, known_encoding):
    known = numpy.asarray(known_encoding, dtype=numpy.float32).reshape(1, -1)
    return recognizer.match(query_feature, known, cv2.FaceRecognizerSF_FR_COSINE)

# initialize the video stream
Print.printJson("status", "starting video stream...")
processWidth = Arguments.get("processWidth")
resolution = Arguments.get("resolution").split(",")
resolution = (int(resolution[0]), int(resolution[1]))
Print.printJson("status", resolution)
Print.printJson("status", processWidth)

camera = Camera.create(Arguments.get("camera"), resolution, Arguments.get("cameraDevice"))

# In motion-gate mode we boot paused (camera stopped) until a start command
# arrives from the first motion wake; otherwise start the camera right away.
start_paused = bool(Arguments.get("start_paused"))
if not start_paused:
    camera.start()


# variable for prev names
prevNames = []

# create unknown path if needed
if Arguments.get("extendDataset") is True:
    unknownPath = os.path.dirname(Arguments.get("dataset") + "unknown/")
    try:
        os.stat(unknownPath)
    except:
        os.mkdir(unknownPath)

cosineThreshold = float(Arguments.get("cosineThreshold"))

# Run face recognition immediately unless we were asked to start paused, in
# which case we wait for an external 'start' command (e.g. from the motion gate)
run_face_recognition = not start_paused
if start_paused:
    external_trigger = False
    Print.printJson("status", "Started paused, waiting for a start command.")

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
            camera.start()

        elif run_face_recognition == True and external_trigger == False:
            # Externally triggered to stop face recognition.
            Print.printJson("status", "Stopping face recognition and logging out any logged in users.")
            run_face_recognition = False
            camera.stop()

            # Log out any users that were logged in, and clear prevNames list
            if prevNames:
                Print.printJson("logout", {"names": prevNames})
                prevNames.clear()

    if run_face_recognition:
        # read the frame. picamera2 delivers XRGB8888 (4 channels); YuNet/SFace
        # and JPEG saving all need 3-channel BGR, so drop the alpha/X channel up
        # front and keep everything downstream 3-channel.
        originalFrame = camera.capture_array()
        if originalFrame.shape[2] == 4:
            originalFrame = cv2.cvtColor(originalFrame, cv2.COLOR_BGRA2BGR)

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

        # detect faces with YuNet
        (h, w) = frame.shape[:2]
        detector.setInputSize((w, h))
        _, faces = detector.detect(frame)

        # only build the on-frame overlay when we are actually displaying it,
        # so the common MagicMirror path (output=0, outputmm=0) does no drawing
        drawOverlay = Arguments.get("output") == 1 or Arguments.get("outputmm") == 1

        names = []
        overlay = []  # (box, name, score) tuples, only filled when drawing
        if faces is not None:
            for face in faces:
                # align + crop using YuNet's 5 landmarks, then embed with SFace
                aligned = recognizer.alignCrop(frame, face)
                encoding = recognizer.feature(aligned)

                # find the best matching known face (or "unknown")
                name = Recognizer.best_match(
                    encoding, data["encodings"], data["names"], cosineThreshold, sface_similarity
                )
                names.append(name)

                if drawOverlay:
                    score = max(
                        (sface_similarity(encoding, known) for known in data["encodings"]),
                        default=0.0,
                    )
                    overlay.append((face[:4].astype(int), name, score))

        if drawOverlay:
            for (x, y, bw, bh), name, score in overlay:
                cv2.rectangle(frame, (x, y), (x + bw, y + bh), (0, 255, 0), 2)
                ty = y - 15 if y - 15 > 15 else y + 15
                txt = name + " (" + "{:.2f}".format(score) + ")"
                cv2.putText(
                    frame, txt, (x, ty), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 0), 2
                )

        # display the image to our screen
        if Arguments.get("output") == 1:
            cv2.imshow("Frame", frame)

        if Arguments.get("outputmm") == 1:
            retval, buffer = cv2.imencode('.jpg', frame)
            jpg_as_text = base64.b64encode(buffer).decode()
            Print.printJson("camera_image", {"image": jpg_as_text})

        # figure out which names are new logins and which are new logouts
        logins, logouts = Recognizer.diff_logins_logouts(prevNames, names)

        # if extendDataset is active we need to save the picture of each new login
        if Arguments.get("extendDataset") is True:
            for n in logins:
                # set correct path to the dataset
                path = os.path.dirname(Arguments.get("dataset") + "/" + n + "/")
                today = datetime.now()
                cv2.imwrite(
                    path + "/" + n + "_" + today.strftime("%Y%m%d_%H%M%S") + ".jpg",
                    originalFrame,
                )

        # send information to prompt, only if something has changed
        if len(logins) > 0:
            Print.printJson("login", {"names": logins})

        if len(logouts) > 0:
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
camera.stop()
cv2.destroyAllWindows()
