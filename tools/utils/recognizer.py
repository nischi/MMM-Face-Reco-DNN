import numpy


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

    @staticmethod
    def scale_detection(face, scale):
        """Scale a YuNet detection from one frame's pixel space to another's.

        A YuNet detection row is 15 floats: the bounding box (x, y, w, h),
        5 facial landmarks as alternating x/y pairs (10 values), and a
        detection score. The first 14 values are coordinates and scale
        linearly with image size; the trailing score is a [0, 1] confidence
        value and must be left untouched.

        This is used to map a detection found on a cheap, downscaled frame
        back into the full-resolution frame, so the recognition crop can be
        taken from the sharp original instead of an upscaled, blurry one.

        Args:
            face: a single YuNet detection row (15 floats). Not mutated.
            scale: factor to multiply the coordinate values by, e.g.
                ``originalFrame.shape[1] / frame.shape[1]``.

        Returns:
            A new float32 array (the dtype cv2.FaceDetectorYN.detect
            naturally produces, and what FaceRecognizerSF.alignCrop expects)
            with the coordinates scaled and the score unchanged.
        """
        scaled = numpy.array(face, dtype=numpy.float32, copy=True)
        scaled[:14] *= scale
        return scaled
