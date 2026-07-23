class Recognizer:
    """Pure, hardware-free helpers for the face recognition loop.

    These functions contain the only non-trivial decision logic of the
    recognition pipeline (which name a face embedding maps to, and which
    names are new logins/logouts between two frames). They take all model
    and camera dependencies as plain arguments so they can be unit tested
    without OpenCV, the ONNX models, or a camera.
    """

    @staticmethod
    def best_match(feature, known_encodings, known_names, threshold, similarity_fn):
        """Return the best matching name for a face embedding, or "unknown".

        SFace matches on cosine similarity where a higher score means a more
        similar face, so we keep the largest score and only accept it when it
        is at or above ``threshold``.

        Args:
            feature: the query face embedding.
            known_encodings: list of stored embeddings from the dataset.
            known_names: list of names aligned with ``known_encodings``.
            threshold: minimum cosine similarity to accept a match.
            similarity_fn: callable(feature, known_encoding) -> float. In
                production this wraps ``cv2.FaceRecognizerSF.match`` with the
                cosine distance type; in tests it is a plain cosine function.

        Returns:
            The matched name, or "unknown" if no stored face is similar enough.
        """
        best_name = "unknown"
        best_score = threshold

        for encoding, name in zip(known_encodings, known_names):
            score = similarity_fn(feature, encoding)
            if score >= best_score:
                best_score = score
                best_name = name

        return best_name

    @staticmethod
    def diff_logins_logouts(prev_names, names):
        """Diff the previous frame's names against the current frame's names.

        Args:
            prev_names: names recognized in the previous iteration.
            names: names recognized in the current iteration.

        Returns:
            (logins, logouts): names that just appeared and names that just
            disappeared. ``None`` entries are ignored on both sides.
        """
        logins = [n for n in names if n is not None and n not in prev_names]
        logouts = [n for n in prev_names if n is not None and n not in names]
        return logins, logouts
