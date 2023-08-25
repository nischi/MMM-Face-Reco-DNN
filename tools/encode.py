# import the necessary packages
import face_recognition
import pickle
import cv2
import os
from utils.image import Image
from utils.arguments import Arguments

# construct the argument parser and parse the arguments
Arguments.prepareEncodingArguments()

# grab the paths to the input images in our dataset
print("[INFO] quantifying faces...")
imagePaths = list(Image.list_images(Arguments.get("dataset")))

# initialize the list of known encodings and known names
knownEncodings = []
knownNames = []

# loop over the image paths
for i, imagePath in enumerate(imagePaths):
    # extract the person name from the image path
    print(
        "[INFO] processing image {}/{} - {}".format(i + 1, len(imagePaths), imagePath)
    )
    name = os.path.basename(os.path.dirname(imagePath))

    # load the input image and convert it from RGB (OpenCV ordering)
    # to dlib ordering (RGB)
    image = cv2.imread(imagePath)
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    # detect the (x, y)-coordinates of the bounding boxes
    # corresponding to each face in the input image
    boxes = face_recognition.face_locations(
        rgb, model=Arguments.get("detection_method")
    )

    # compute the facial embedding for the face
    encodings = face_recognition.face_encodings(rgb, boxes)

    # loop over the encodings
    for encoding in encodings:
        # add each encoding + name to our set of known names and
        # encodings
        knownEncodings.append(encoding)
        knownNames.append(name)

# dump the facial encodings + names to disk
print("[INFO] serializing encodings...")
data = {"encodings": knownEncodings, "names": knownNames}
f = open(Arguments.get("encodings"), "wb")
f.write(pickle.dumps(data))
f.close()
