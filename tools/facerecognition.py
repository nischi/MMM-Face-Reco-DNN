# USAGE
# python pi_face_recognition.py --cascade haarcascade_frontalface_default.xml --encodings encodings.pickle

# import the necessary packages
from imutils.video import FPS, VideoStream
from datetime import datetime
import face_recognition
import argparse
import imutils
import pickle
import time
import cv2
import json
import sys
import signal
import os

def printjson(type, message):
	print(json.dumps({type: message}))
	sys.stdout.flush()

def signalHandler(signal, frame):
	global closeSafe
	closeSafe = True

signal.signal(signal.SIGINT, signalHandler)
closeSafe = False

# construct the argument parser and parse the arguments
ap = argparse.ArgumentParser()
ap.add_argument("-c", "--cascade", type=str, required=False, default="haarcascade_frontalface_default.xml",
	help = "path to where the face cascade resides")
ap.add_argument("-e", "--encodings", type=str, required=False, default="encodings.pickle",
	help="path to serialized db of facial encodings")
ap.add_argument("-p", "--usePiCamera", type=int, required=False, default=1,
	help="Is using picamera or builtin/usb cam")
ap.add_argument("-m", "--method", type=str, required=False, default="dnn",
	help="method to detect faces (dnn, haar)")
ap.add_argument("-d", "--detectionMethod", type=str, required=False, default="hog",
	help="face detection model to use: either `hog` or `cnn`")
ap.add_argument("-i", "--interval", type=int, required=False, default=2000,
	help="interval between recognitions")
ap.add_argument("-o", "--output", type=int, required=False, default=1,
	help="Show output")
ap.add_argument("-eds", "--extendDataset", type=bool, required=False, default=False,
	help="Extend Dataset with unknown pictures")
ap.add_argument("-ds", "--dataset", required=False, default="../dataset/",
	help="path to input directory of faces + images")
args = vars(ap.parse_args())

# load the known faces and embeddings along with OpenCV's Haar
# cascade for face detection
printjson("status", "loading encodings + face detector...")
data = pickle.loads(open(args["encodings"], "rb").read())
detector = cv2.CascadeClassifier(args["cascade"])

# initialize the video stream and allow the camera sensor to warm up
printjson("status", "starting video stream...")

if args["usePiCamera"] >= 1:
	vs = VideoStream(usePiCamera=True).start()
else:
	vs = VideoStream(src=0).start()
time.sleep(2.0)

# variable for prev names
prevNames = []

# create unknown path if needed
if args["extendDataset"] is True:
	unknownPath = os.path.dirname(args["dataset"] + "unknown/")
	try:
			os.stat(unknownPath)
	except:
			os.mkdir(unknownPath)

# start the FPS counter
fps = FPS().start()

# loop over frames from the video file stream
while True:
	# grab the frame from the threaded video stream and resize it
	# to 500px (to speedup processing)
	originalFrame = vs.read()
	frame = imutils.resize(originalFrame, width=500)

	if args["method"] == "dnn":
		# load the input image and convert it from BGR (OpenCV ordering)
		# to dlib ordering (RGB)
		rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
		# detect the (x, y)-coordinates of the bounding boxes
		# corresponding to each face in the input image
		boxes = face_recognition.face_locations(rgb,
			model=args["detectionMethod"])
	elif args["method"] == "haar":
		# convert the input frame from (1) BGR to grayscale (for face
		# detection) and (2) from BGR to RGB (for face recognition)
		gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
		rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

		# detect faces in the grayscale frame
		rects = detector.detectMultiScale(gray, scaleFactor=1.1,
			minNeighbors=5, minSize=(30, 30),
			flags=cv2.CASCADE_SCALE_IMAGE)

		# OpenCV returns bounding box coordinates in (x, y, w, h) order
		# but we need them in (top, right, bottom, left) order, so we
		# need to do a bit of reordering
		boxes = [(y, x + w, y + h, x) for (x, y, w, h) in rects]

	# compute the facial embeddings for each face bounding box
	encodings = face_recognition.face_encodings(rgb, boxes)
	names = []

	# loop over the facial embeddings
	for encoding in encodings:
		# attempt to match each face in the input image to our known
		# encodings
		matches = face_recognition.compare_faces(data["encodings"],
			encoding)
		name = "unknown"

		# check to see if we have found a match
		if True in matches:
			# find the indexes of all matched faces then initialize a
			# dictionary to count the total number of times each face
			# was matched
			matchedIdxs = [i for (i, b) in enumerate(matches) if b]
			counts = {}

			# loop over the matched indexes and maintain a count for
			# each recognized face face
			for i in matchedIdxs:
				name = data["names"][i]
				counts[name] = counts.get(name, 0) + 1

			# determine the recognized face with the largest number
			# of votes (note: in the event of an unlikely tie Python
			# will select first entry in the dictionary)
			name = max(counts, key=counts.get)

		# update the list of names
		names.append(name)

	# loop over the recognized faces
	for ((top, right, bottom, left), name) in zip(boxes, names):
		# draw the predicted face name on the image
		cv2.rectangle(frame, (left, top), (right, bottom),
			(0, 255, 0), 2)
		y = top - 15 if top - 15 > 15 else top + 15
		cv2.putText(frame, name, (left, y), cv2.FONT_HERSHEY_SIMPLEX,
			0.75, (0, 255, 0), 2)

	# display the image to our screen
	if (args["output"] == 1):
		cv2.imshow("Frame", frame)

	# update the FPS counter
	fps.update()

	logins = []
	logouts = []
	# Check which names are new login and which are new logout with prevNames
	for n in names:
		if (prevNames.__contains__(n) == False and n is not None):
			logins.append(n)

			# if extendDataset is active we need to save the picture
			if args["extendDataset"] is True:
				# set correct path to the dataset
				path = os.path.dirname(args["dataset"] + '/' + n + '/')

				today = datetime.now()
				cv2.imwrite(path + '/' + n + '_' + today.strftime("%Y%m%d_%H%M%S") + '.jpg', originalFrame)
	for n in prevNames:
		if (names.__contains__(n) == False and n is not None):
			logouts.append(n)

	# send inforrmation to prompt, only if something has changes
	if (logins.__len__() > 0):
		printjson("login", {
			"names": logins
		})

	if (logouts.__len__() > 0):
		printjson("logout", {
			"names": logouts
		})

	# set this names as new prev names for next iteration
	prevNames = names

	key = cv2.waitKey(1) & 0xFF
	# if the `q` key was pressed, break from the loop
	if key == ord("q") or closeSafe == True:
		break

	time.sleep(args["interval"] / 1000)

# stop the timer and display FPS information
fps.stop()
printjson("status", "elasped time: {:.2f}".format(fps.elapsed()))
printjson("status", "approx. FPS: {:.2f}".format(fps.fps()))

# do a bit of cleanup
cv2.destroyAllWindows()
vs.stop()