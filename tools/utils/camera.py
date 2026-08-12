import cv2


def normalize_device(device):
    """OpenCV accepts either an integer index or a device path. Command line
    arguments always arrive as strings, so digit-only values become ints and
    anything else (e.g. '/dev/video40') is passed through unchanged."""
    if isinstance(device, int):
        return device
    text = str(device).strip()
    if text.isdigit():
        return int(text)
    return text


class Camera:
    """Camera abstraction so the same recognition loop can run on a Raspberry
    Pi camera (picamera2) or a regular webcam (OpenCV VideoCapture, e.g. for
    testing on a laptop, or a v4l2loopback virtual device). Both back-ends
    expose the same tiny interface: start(), stop() and capture_array()
    returning a BGR/BGRA frame."""

    @staticmethod
    def create(kind, resolution, device=0):
        if kind == "webcam":
            return WebcamCamera(resolution, device)
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
    def __init__(self, resolution, device=0):
        self.resolution = resolution
        self.device = normalize_device(device)
        self.cap = None

    def start(self):
        if self.cap is None:
            self.cap = cv2.VideoCapture(self.device)
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.resolution[0])
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.resolution[1])
        if not self.cap.isOpened():
            raise RuntimeError(
                "Could not open the webcam device {}. If this is a v4l2loopback "
                "device, check that the broker is publishing to it. On macOS grant "
                "camera access to your terminal in System Settings > Privacy & "
                "Security > Camera.".format(self.device)
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
