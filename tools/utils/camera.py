import cv2


class Camera:
    """Camera abstraction so the same recognition loop can run on a Raspberry
    Pi camera (picamera2) or a regular webcam (OpenCV VideoCapture, e.g. for
    testing on a laptop). Both back-ends expose the same tiny interface:
    start(), stop() and capture_array() returning a BGR/BGRA frame."""

    @staticmethod
    def create(kind, resolution):
        if kind == "webcam":
            return WebcamCamera(resolution)
        return PiCamera2Camera(resolution)


class PiCamera2Camera:
    def __init__(self, resolution):
        # imported lazily so non-Raspberry-Pi hosts (e.g. a Mac used for
        # testing with the webcam back-end) do not need picamera2 installed
        from picamera2 import Picamera2

        self.picam2 = Picamera2()
        self.picam2.configure(
            self.picam2.create_preview_configuration(
                main={"size": (resolution[0], resolution[1]), "format": "XRGB8888"}
            )
        )

    def start(self):
        self.picam2.start()

    def stop(self):
        self.picam2.stop()

    def capture_array(self):
        return self.picam2.capture_array()


class WebcamCamera:
    def __init__(self, resolution):
        self.resolution = resolution
        self.cap = None

    def start(self):
        if self.cap is None:
            self.cap = cv2.VideoCapture(0)
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.resolution[0])
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.resolution[1])
        if not self.cap.isOpened():
            raise RuntimeError(
                "Could not open the webcam. On macOS grant camera access to your "
                "terminal in System Settings > Privacy & Security > Camera."
            )

    def stop(self):
        if self.cap is not None:
            self.cap.release()
            self.cap = None

    def capture_array(self):
        ok, frame = self.cap.read()
        if not ok:
            raise RuntimeError("Failed to read a frame from the webcam.")
        return frame
