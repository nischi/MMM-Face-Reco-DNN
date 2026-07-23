import argparse

import pytest

from utils.helper import Helper


@pytest.mark.parametrize("value", ["yes", "true", "t", "y", "1", "True", "YES"])
def test_str2bool_truthy(value):
    assert Helper.str2bool(value) is True


@pytest.mark.parametrize("value", ["no", "false", "f", "n", "0", "False", "NO"])
def test_str2bool_falsy(value):
    assert Helper.str2bool(value) is False


def test_str2bool_passthrough_bool():
    assert Helper.str2bool(True) is True
    assert Helper.str2bool(False) is False


def test_str2bool_invalid_raises():
    with pytest.raises(argparse.ArgumentTypeError):
        Helper.str2bool("maybe")
