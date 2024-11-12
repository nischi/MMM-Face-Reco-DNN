import time
from picamera2 import Picamera2, Preview
from libcamera import Transform
from pynput.keyboard import Key, Listener
import os
import sys
# Raspberry Pi Camera Image Capture Script
# Captures images from a Raspberry Pi camera and saves them to folders in the 'root/dataset' 
# directory of the module, with each folder named after the chosen 'name.'
# Press the space key to take pictures and 'q' to exit the application.
# Adjust camera rotation if needed.


# --------------------------------------------------------------------------------
# -- Edit this Parameter
# --------------------------------------------------------------------------------
# Set your name, which should be used to expand the dataset
name = 'YOUR_NAME' 

# Set camera rotation. Note, Transform does not support rotations, but only 
# vertical and horizontal flips
# Transform()                   - the identity transform, which is the default
# Transform(hflip=1)            - horizontal flip
# Transform(vflip=1)            - vertical flip
# Transform(hflip=1, vflip=1)   - horizontal and vertical flip (equivalent to a 180 degree rotation)
transform= Transform(vflip=1); 
# --------------------------------------------------------------------------------
# -- Edit this Parameter
# --------------------------------------------------------------------------------




# Specifies the directory for saving the images
output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "dataset", name)
# Create the directory if it doesn't exist
os.makedirs(output_dir, exist_ok=True)

picam2 = Picamera2()
camera_config = picam2.create_still_configuration(lores={"size": (640, 480)}, display="lores")
camera_config["transform"] = transform 

picam2.configure(camera_config)


picam2.start_preview(Preview.QTGL)
picam2.start()

# Get the existing image files in the output directory
existing_images = os.listdir(output_dir)

# Determine the starting photo number based on existing files
existing_numbers = set()
for filename in existing_images:
    if filename.startswith("img") and filename.endswith(".jpg"):
        try:
            number = int(filename[3:5])
            existing_numbers.add(number)
        except ValueError:
            pass

if existing_numbers:
    next_photo_number = max(existing_numbers) + 1
else:
    next_photo_number = 1

def on_key_release(key):
    global photo_captured
    if key == Key.space:
        global next_photo_number
        # Generate the filename with the format "imgXX.jpg"
        img_filename = f"img{next_photo_number:02d}.jpg"
        next_photo_number += 1
         # Save the image to the specified directory
        img_path = os.path.join(output_dir, img_filename)
        picam2.capture_file(img_path)
        print(f"Photo captured and saved as '{img_filename}' in '{output_dir}'")
        time.sleep(1)  # Wait for 2 seconds to stabilize the image

    if key == Key.esc:
        print("Exiting the application.")
        picam2.stop_preview()
        picam2.stop()
        sys.exit()


# Create a listener to detect key releases
with Listener(on_release=on_key_release) as listener:
    listener.join()

picam2.stop_preview()
picam2.stop()