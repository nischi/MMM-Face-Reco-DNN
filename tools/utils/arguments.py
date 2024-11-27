import argparse
from utils.helper import Helper


class Arguments:
    args = None

    def get(name):
        return Arguments.args[name]

    def prepareEncodingArguments():
        ap = argparse.ArgumentParser()
        ap.add_argument(
            "-i",
            "--dataset",
            required=False,
            default="../dataset/",
            help="path to input directory of faces + images",
        )
        ap.add_argument(
            "-e",
            "--encodings",
            required=False,
            default="../model/encodings.pickle",
            help="path to serialized db of facial encodings",
        )
        ap.add_argument(
            "-d",
            "--detection-method",
            type=str,
            default="hog",
            help="face detection model to use: either `hog` or `cnn`",
        )

        Arguments.args = vars(ap.parse_args())

    def prepareRecognitionArguments():
        ap = argparse.ArgumentParser()
        ap.add_argument(
            "-c",
            "--cascade",
            type=str,
            required=False,
            default="../model/haarcascade_frontalface_default.xml",
            help="path to where the face cascade resides",
        )
        ap.add_argument(
            "-e",
            "--encodings",
            type=str,
            required=False,
            default="../model/encodings.pickle",
            help="path to serialized db of facial encodings",
        )
        ap.add_argument(
            "-r",
            "--rotateCamera",
            type=int,
            required=False,
            default=-1,
            help="Rotate camera image (-1 = no rotation, 0 = 90°, 1 = 180°, 2 = 270°)",
        )
        ap.add_argument(
            "-m",
            "--method",
            type=str,
            required=False,
            default="dnn",
            help="method to detect faces (dnn, haar)",
        )
        ap.add_argument(
            "-d",
            "--detectionMethod",
            type=str,
            required=False,
            default="hog",
            help="face detection model to use: either `hog` or `cnn`",
        )
        ap.add_argument(
            "-i",
            "--interval",
            type=int,
            required=False,
            default=2000,
            help="interval between recognitions",
        )
        ap.add_argument(
            "-o", "--output", type=int, required=False, default=0, help="Show output"
        )
        ap.add_argument(
            "-omm",
            "--outputmm",
            type=int,
            required=False,
            default=0,
            help="Show output on magic mirror",
        )
        ap.add_argument(
            "-eds",
            "--extendDataset",
            type=Helper.str2bool,
            required=False,
            default=False,
            help="Extend Dataset with unknown pictures",
        )
        ap.add_argument(
            "-ds",
            "--dataset",
            required=False,
            default="../dataset/",
            help="path to input directory of faces + images",
        )
        ap.add_argument(
            "-t",
            "--tolerance",
            type=float,
            required=False,
            default=0.6,
            help="How much distance between faces to consider it a match. Lower is more strict.",
        )
        ap.add_argument(
            "-br",
            "--brightness",
            default=0,
            help="Brightness (0-100)",
        )
        ap.add_argument(
            "-co",
            "--contrast",
            default=0,
            help="Contrast (0-127)",
        )
        ap.add_argument(
            "-res", "--resolution", default="1920,1080", help="Resolution of the image"
        )
        ap.add_argument(
            "-pw",
            "--processWidth",
            type=int,
            default=500,
            help="Resolution of the image which will be processed from OpenCV",
        )
        ap.add_argument(
            "-roon",
            "--run-only-on-notification",
            type=int,
            default=0,
            help="If 1, only runs face detection upon external trigger. If 0, face detection runs all the time.",
        )

        Arguments.args = vars(ap.parse_args())
