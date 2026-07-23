import os
import sys

# Make the tools/ directory importable so tests can `from utils.x import Y`,
# matching how encode.py / recognition.py import their helpers.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
