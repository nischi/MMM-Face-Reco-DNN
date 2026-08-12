import pytest

from utils.camera import Camera, WebcamCamera, normalize_device


class FakeCapture:
    """Stand-in for cv2.VideoCapture so the tests need no real camera."""

    def __init__(self, device):
        self.device = device
        self.props = {}
        self.opened = True

    def set(self, prop, value):
        self.props[prop] = value

    def isOpened(self):
        return self.opened

    def release(self):
        self.opened = False


@pytest.mark.parametrize(
    "raw,expected",
    [
        (0, 0),
        ("0", 0),
        ("3", 3),
        (" 2 ", 2),
        ("/dev/video40", "/dev/video40"),
    ],
)
def test_normalize_device(raw, expected):
    # CLI args always arrive as strings; digit-only values are indices,
    # anything else (a device path) must be passed through untouched.
    assert normalize_device(raw) == expected


def test_webcam_opens_the_configured_device(monkeypatch):
    opened = []

    def fake_video_capture(device):
        opened.append(device)
        return FakeCapture(device)

    monkeypatch.setattr("utils.camera.cv2.VideoCapture", fake_video_capture)

    camera = Camera.create("webcam", (1280, 720), "/dev/video40")
    camera.start()

    assert opened == ["/dev/video40"]


def test_webcam_defaults_to_device_zero(monkeypatch):
    opened = []

    def fake_video_capture(device):
        opened.append(device)
        return FakeCapture(device)

    monkeypatch.setattr("utils.camera.cv2.VideoCapture", fake_video_capture)

    camera = Camera.create("webcam", (640, 480))
    camera.start()

    assert opened == [0]


def test_webcam_error_names_the_device(monkeypatch):
    class ClosedCapture(FakeCapture):
        def isOpened(self):
            return False

    monkeypatch.setattr("utils.camera.cv2.VideoCapture", lambda d: ClosedCapture(d))

    camera = WebcamCamera((640, 480), "/dev/video40")
    with pytest.raises(RuntimeError, match="/dev/video40"):
        camera.start()
