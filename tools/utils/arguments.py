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
            "-dm",
            "--detModel",
            type=str,
            required=False,
            default="../model/face_detection_yunet_2023mar.onnx",
            help="path to the YuNet face detection ONNX model",
        )
        ap.add_argument(
            "-rm",
            "--recModel",
            type=str,
            required=False,
            default="../model/face_recognition_sface_2021dec.onnx",
            help="path to the SFace face recognition ONNX model",
        )

        Arguments.args = vars(ap.parse_args())

    def prepareRecognitionArguments():
        ap = argparse.ArgumentParser()
        ap.add_argument(
            "-e",
            "--encodings",
            type=str,
            required=False,
            default="../model/encodings.pickle",
            help="path to serialized db of facial encodings",
        )
        ap.add_argument(
            "-dm",
            "--detModel",
            type=str,
            required=False,
            default="../model/face_detection_yunet_2023mar.onnx",
            help="path to the YuNet face detection ONNX model",
        )
        ap.add_argument(
            "-rm",
            "--recModel",
            type=str,
            required=False,
            default="../model/face_recognition_sface_2021dec.onnx",
            help="path to the SFace face recognition ONNX model",
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
            "-ct",
            "--cosineThreshold",
            type=float,
            required=False,
            default=0.363,
            help="Minimum SFace cosine similarity to accept a match. Higher is more strict.",
        )
        ap.add_argument(
            "-dst",
            "--detScoreThreshold",
            type=float,
            required=False,
            default=0.9,
            help="Minimum YuNet detection confidence to treat a region as a face. Lower detects more faces in poor lighting.",
        )
        ap.add_argument(
            "-cam",
            "--camera",
            type=str,
            required=False,
            default="picamera2",
            help="Camera back-end: 'picamera2' (Raspberry Pi) or 'webcam' (OpenCV VideoCapture, e.g. a Mac/laptop webcam for testing).",
        )
        ap.add_argument(
            "-cd",
            "--cameraDevice",
            type=str,
            required=False,
            default="0",
            help="Capture device for the 'webcam' back-end: an index (e.g. 0) or a path (e.g. /dev/video40). Ignored by picamera2.",
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
        ap.add_argument(
            "-sp",
            "--start-paused",
            type=int,
            default=0,
            help="If 1, start with face recognition paused (camera stopped) until a start command is received. Used by the motion gate.",
        )

        Arguments.args = vars(ap.parse_args())
