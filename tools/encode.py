# import the necessary packages
import pickle
import cv2
import os
from utils.image import Image
from utils.arguments import Arguments

# construct the argument parser and parse the arguments
Arguments.prepareEncodingArguments()

# create the YuNet face detector and the SFace face recognizer (both bundled
# with OpenCV's DNN module). The detector's input size is set per image below.
# Dataset images are curated (each folder is known to contain the person), so
# we use a lenient detection score threshold to avoid skipping usable photos;
# only the single highest-scoring face per image is embedded.
detector = cv2.FaceDetectorYN.create(Arguments.get("detModel"), "", (320, 320), 0.6)
recognizer = cv2.FaceRecognizerSF.create(Arguments.get("recModel"), "")

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

    # load the input image
    image = cv2.imread(imagePath)
    if image is None:
        print("[WARN] could not read image, skipping: {}".format(imagePath))
        continue

    # detect the faces in the image
    (h, w) = image.shape[:2]
    detector.setInputSize((w, h))
    _, faces = detector.detect(image)

    if faces is None:
        print("[WARN] no face found, skipping: {}".format(imagePath))
        continue

    # a dataset image is meant to show one person, so keep only the most
    # confident detection (the last column of each row is the score)
    face = max(faces, key=lambda f: f[-1])

    # align + crop the face using YuNet's landmarks, then embed it
    aligned = recognizer.alignCrop(image, face)
    encoding = recognizer.feature(aligned)

    # add the encoding + name to our set of known names and encodings.
    # flatten() turns the (1, 128) feature into a flat 128-D vector.
    knownEncodings.append(encoding.flatten())
    knownNames.append(name)

# dump the facial encodings + names to disk. The format ({"encodings", "names"})
# is unchanged so recognition.py can load it exactly as before.
print("[INFO] serializing encodings...")
data = {"encodings": knownEncodings, "names": knownNames}
f = open(Arguments.get("encodings"), "wb")
f.write(pickle.dumps(data))
f.close()
