import os

import cv2
import numpy
import pytest

from utils.recognizer import Recognizer

# Bundled ONNX model used to verify, for real, that whatever dtype
# scale_detection() returns is actually accepted by
# cv2.FaceRecognizerSF.alignCrop -- a silent dtype mismatch here would only
# surface as a runtime crash in production, not a test failure.
_REC_MODEL = os.path.join(
    os.path.dirname(__file__), "..", "..", "model", "face_recognition_sface_2021dec.onnx"
)


def cosine(a, b):
    """Plain cosine similarity, standing in for cv2.FaceRecognizerSF.match."""
    a = numpy.asarray(a, dtype=float)
    b = numpy.asarray(b, dtype=float)
    denom = numpy.linalg.norm(a) * numpy.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(numpy.dot(a, b) / denom)


# ----------------------------------------------------------------------------
# best_match
# ----------------------------------------------------------------------------
def test_best_match_returns_name_above_threshold():
    known_encodings = [[1.0, 0.0], [0.0, 1.0]]
    known_names = ["thierry", "james"]
    query = [0.99, 0.01]  # very close to thierry

    result = Recognizer.best_match(query, known_encodings, known_names, 0.5, cosine)

    assert result == "thierry"


def test_best_match_returns_unknown_below_threshold():
    known_encodings = [[1.0, 0.0]]
    known_names = ["thierry"]
    query = [0.0, 1.0]  # orthogonal -> cosine 0.0

    result = Recognizer.best_match(query, known_encodings, known_names, 0.363, cosine)

    assert result == "unknown"


def test_best_match_empty_dataset_is_unknown():
    result = Recognizer.best_match([1.0, 0.0], [], [], 0.363, cosine)

    assert result == "unknown"


def test_best_match_picks_closest_of_several():
    known_encodings = [[1.0, 0.0], [0.9, 0.1], [0.0, 1.0]]
    known_names = ["far", "closest", "orthogonal"]
    query = [0.9, 0.1]

    result = Recognizer.best_match(query, known_encodings, known_names, 0.5, cosine)

    assert result == "closest"


def test_best_match_accepts_score_exactly_at_threshold():
    # cosine of identical vectors is exactly 1.0
    result = Recognizer.best_match([1.0, 0.0], [[1.0, 0.0]], ["thierry"], 1.0, cosine)

    assert result == "thierry"


# ----------------------------------------------------------------------------
# diff_logins_logouts
# ----------------------------------------------------------------------------
def test_diff_detects_new_login():
    logins, logouts = Recognizer.diff_logins_logouts([], ["thierry"])

    assert logins == ["thierry"]
    assert logouts == []


def test_diff_detects_logout():
    logins, logouts = Recognizer.diff_logins_logouts(["thierry"], [])

    assert logins == []
    assert logouts == ["thierry"]


def test_diff_unchanged_set_yields_nothing():
    logins, logouts = Recognizer.diff_logins_logouts(["thierry", "james"], ["thierry", "james"])

    assert logins == []
    assert logouts == []


def test_diff_simultaneous_login_and_logout():
    logins, logouts = Recognizer.diff_logins_logouts(["thierry"], ["james"])

    assert logins == ["james"]
    assert logouts == ["thierry"]


def test_diff_ignores_none_entries():
    logins, logouts = Recognizer.diff_logins_logouts([None], [None, "thierry"])

    assert logins == ["thierry"]
    assert logouts == []


# ----------------------------------------------------------------------------
# scale_detection
# ----------------------------------------------------------------------------
# A YuNet detection row is 15 floats: bbox (x, y, w, h), 5 landmarks as
# alternating x/y pairs (10 values), then a detection score. Indices 0-13 are
# coordinates in frame-pixel space; index 14 is a [0, 1] confidence score and
# must never be scaled.
def _detection(scale=1.0):
    return numpy.array(
        [
            10.0,
            20.0,  # x, y
            30.0,
            40.0,  # w, h
            15.0,
            25.0,  # right eye
            35.0,
            25.0,  # left eye
            25.0,
            35.0,  # nose tip
            18.0,
            50.0,  # right mouth corner
            32.0,
            50.0,  # left mouth corner
            0.987,  # score
        ],
        dtype=numpy.float32,
    ) * ([scale] * 14 + [1.0])


def test_scale_detection_scales_bbox_and_all_landmarks():
    face = _detection()
    scale = 2.56

    scaled = Recognizer.scale_detection(face, scale)

    expected_coords = face[:14] * scale
    numpy.testing.assert_allclose(scaled[:14], expected_coords)


def test_scale_detection_does_not_scale_the_score():
    face = _detection()

    scaled = Recognizer.scale_detection(face, 2.56)

    assert scaled[14] == pytest.approx(face[14])


def test_scale_detection_at_scale_one_is_equivalent():
    face = _detection()

    scaled = Recognizer.scale_detection(face, 1.0)

    numpy.testing.assert_allclose(scaled, face)


def test_scale_detection_does_not_mutate_input():
    face = _detection()
    original = face.copy()

    Recognizer.scale_detection(face, 2.56)

    numpy.testing.assert_array_equal(face, original)


def test_scale_detection_returns_float32():
    face = _detection()

    scaled = Recognizer.scale_detection(face, 2.56)

    assert scaled.dtype == numpy.float32


def test_scale_detection_output_is_accepted_by_align_crop():
    """Pin the real OpenCV contract: alignCrop must accept whatever dtype
    scale_detection() produces. This is the dtype that actually matters at
    runtime, not an assumption about what "should" work."""
    if not os.path.exists(_REC_MODEL):
        pytest.skip("bundled SFace model not present")

    recognizer = cv2.FaceRecognizerSF.create(_REC_MODEL, "")
    image = numpy.zeros((200, 200, 3), dtype=numpy.uint8)
    face = _detection()  # fits inside the 200x200 image, scale 1.0 is a no-op here

    scaled = Recognizer.scale_detection(face, 1.0)
    aligned = recognizer.alignCrop(image, scaled)

    assert aligned.shape == (112, 112, 3)
