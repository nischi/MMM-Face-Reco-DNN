import numpy

from utils.image import Image


def _solid_image(h, w, value=100):
    return numpy.full((h, w, 3), value, dtype=numpy.uint8)


def test_resize_by_width_preserves_aspect_ratio():
    img = _solid_image(100, 200)  # h=100, w=200

    resized = Image.resize(img, width=100)

    # width halved -> height should halve too
    assert resized.shape[1] == 100
    assert resized.shape[0] == 50


def test_resize_by_height_preserves_aspect_ratio():
    img = _solid_image(100, 200)

    resized = Image.resize(img, height=50)

    assert resized.shape[0] == 50
    assert resized.shape[1] == 100


def test_resize_without_dimensions_returns_original():
    img = _solid_image(100, 200)

    resized = Image.resize(img)

    assert resized.shape == img.shape


def test_adjust_brightness_increases_pixel_values():
    img = _solid_image(10, 10, value=100)

    brighter = Image.adjust_brightness_contrast(img, brightness=50, contrast=0)

    assert int(brighter[0, 0, 0]) == 150


def test_adjust_contrast_scales_pixel_values():
    img = _solid_image(10, 10, value=100)

    # contrast multiplies by (1 + contrast/100) -> 100 * 2 = 200
    contrasted = Image.adjust_brightness_contrast(img, brightness=0, contrast=100)

    assert int(contrasted[0, 0, 0]) == 200


def test_list_images_filters_by_extension(tmp_path):
    (tmp_path / "person").mkdir()
    (tmp_path / "person" / "a.jpg").write_bytes(b"x")
    (tmp_path / "person" / "b.png").write_bytes(b"x")
    (tmp_path / "person" / "notes.txt").write_bytes(b"x")

    found = sorted(p.rsplit("/", 1)[-1] for p in Image.list_images(str(tmp_path)))

    assert found == ["a.jpg", "b.png"]
