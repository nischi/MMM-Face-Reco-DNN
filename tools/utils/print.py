import json
import sys


class Print:
    def printJson(type, message):
        print(json.dumps({type: message}))
        sys.stdout.flush()
