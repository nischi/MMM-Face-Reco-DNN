import pickle

import numpy


def test_encodings_pickle_roundtrip(tmp_path):
    """Lock the on-disk contract shared by encode.py (writer) and
    recognition.py (reader): a pickle holding aligned "encodings" and
    "names" lists. If this shape changes, recognition breaks silently."""
    known_encodings = [
        numpy.zeros(128, dtype=numpy.float32),
        numpy.ones(128, dtype=numpy.float32),
    ]
    known_names = ["thierry", "james"]

    # ---- writer side (mirrors encode.py) ----
    data = {"encodings": known_encodings, "names": known_names}
    path = tmp_path / "encodings.pickle"
    with open(path, "wb") as f:
        f.write(pickle.dumps(data))

    # ---- reader side (mirrors recognition.py) ----
    loaded = pickle.loads(open(path, "rb").read())

    assert set(loaded.keys()) == {"encodings", "names"}
    assert len(loaded["encodings"]) == len(loaded["names"]) == 2
    assert loaded["names"] == ["thierry", "james"]
    assert loaded["encodings"][0].shape == (128,)
    numpy.testing.assert_array_equal(loaded["encodings"][1], known_encodings[1])
