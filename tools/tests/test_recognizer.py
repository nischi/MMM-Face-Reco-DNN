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

    name, score = Recognizer.best_match(query, known_encodings, known_names, 0.5, cosine)

    assert name == "thierry"
    assert score == pytest.approx(0.9999, abs=1e-3)


def test_best_match_returns_unknown_below_threshold():
    known_encodings = [[1.0, 0.0]]
    known_names = ["thierry"]
    query = [0.0, 1.0]  # orthogonal -> cosine 0.0

    name, _ = Recognizer.best_match(query, known_encodings, known_names, 0.363, cosine)

    assert name == "unknown"


def test_best_match_reports_the_score_it_rejected():
    """A rejected match still reports how close it got.

    This is the whole point of returning the score: an "unknown" that scored
    0.35 means the threshold or the enrolled photos need work, while one that
    scored 0.02 means the crop itself is wrong. Without the number the two are
    indistinguishable in the logs.
    """
    known_encodings = [[1.0, 0.0]]
    known_names = ["thierry"]
    query = [0.94, 0.34]  # cosine ~0.94, but we demand near-perfection

    name, score = Recognizer.best_match(query, known_encodings, known_names, 0.99, cosine)

    assert name == "unknown"
    assert score == pytest.approx(0.94, abs=1e-2)


def test_best_match_empty_dataset_is_unknown():
    name, score = Recognizer.best_match([1.0, 0.0], [], [], 0.363, cosine)

    assert name == "unknown"
    assert score == 0.0


def test_best_match_picks_closest_of_several():
    known_encodings = [[1.0, 0.0], [0.9, 0.1], [0.0, 1.0]]
    known_names = ["far", "closest", "orthogonal"]
    query = [0.9, 0.1]

    name, score = Recognizer.best_match(query, known_encodings, known_names, 0.5, cosine)

    assert name == "closest"
    assert score == pytest.approx(1.0, abs=1e-6)


def test_best_match_accepts_score_exactly_at_threshold():
    # cosine of identical vectors is exactly 1.0
    name, score = Recognizer.best_match([1.0, 0.0], [[1.0, 0.0]], ["thierry"], 1.0, cosine)

    assert name == "thierry"
    assert score == pytest.approx(1.0, abs=1e-6)


def test_best_match_reports_the_highest_score_not_the_first_over_threshold():
    """The reported score must be the best one, even when a weaker match came first."""
    known_encodings = [[0.8, 0.6], [1.0, 0.0]]
    known_names = ["weaker", "stronger"]

    name, score = Recognizer.best_match([1.0, 0.0], known_encodings, known_names, 0.5, cosine)

    assert name == "stronger"
    assert score == pytest.approx(1.0, abs=1e-6)


# ----------------------------------------------------------------------------
# split_by_detection_score
# ----------------------------------------------------------------------------
def row(score):
    """A YuNet detection row: 4 box + 10 landmark values, score last."""
    return numpy.array([0.0] * 14 + [score], dtype=numpy.float32)


def test_split_accepts_at_and_above_threshold():
    accepted, rejected = Recognizer.split_by_detection_score(
        [row(0.95), row(0.80), row(0.79)], 0.80
    )

    assert [float(f[-1]) for f in accepted] == pytest.approx([0.95, 0.80])
    assert [float(f[-1]) for f in rejected] == pytest.approx([0.79])


def test_split_handles_no_detections():
    """YuNet returns None, not an empty array, when it finds nothing."""
    accepted, rejected = Recognizer.split_by_detection_score(None, 0.8)

    assert accepted == []
    assert rejected == []


def test_split_keeps_near_misses_so_the_threshold_can_be_tuned():
    """The rejected list is the whole point: it is what makes the cut visible.

    A bowl on a kitchen counter detected at 0.60 and a real face detected at
    0.78 both fail a 0.80 threshold, and only the logged score tells them
    apart. Dropping them inside OpenCV would make the threshold untunable.
    """
    accepted, rejected = Recognizer.split_by_detection_score([row(0.60), row(0.78)], 0.80)

    assert accepted == []
    assert [float(f[-1]) for f in rejected] == pytest.approx([0.60, 0.78])


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
