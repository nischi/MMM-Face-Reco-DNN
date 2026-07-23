import numpy

from utils.recognizer import Recognizer


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
