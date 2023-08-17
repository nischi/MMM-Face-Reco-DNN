import cv2
import os


class Image:
    image_types = (".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff")

    def resize(image, width=None, height=None, inter=cv2.INTER_AREA):
        # initialize the dimensions of the image to be resized and
        # grab the image size
        dim = None
        (h, w) = image.shape[:2]

        # if both the width and height are None, then return the
        # original image
        if width is None and height is None:
            return image

        # check to see if the width is None
        if width is None:
            # calculate the ratio of the height and construct the
            # dimensions
            r = height / float(h)
            dim = (int(w * r), height)

        # otherwise, the height is None
        else:
            # calculate the ratio of the width and construct the
            # dimensions
            r = width / float(w)
            dim = (width, int(h * r))

        # resize the image
        resized = cv2.resize(image, dim, interpolation=inter)

        # return the resized image
        return resized

    def adjust_brightness_contrast(image, brightness=0, contrast=0):
        beta = 0
        # See the OpenCV docs for more info on the `beta` parameter to addWeighted
        # https://docs.opencv.org/3.4.2/d2/de8/group__core__array.html#gafafb2513349db3bcff51f54ee5592a19
        return cv2.addWeighted(
            image,
            1 + float(contrast) / 100.0,
            image,
            beta,
            float(brightness),
        )

    def list_images(basePath, contains=None):
        # return the set of files that are valid
        return Image.list_files(
            basePath, validExts=Image.image_types, contains=contains
        )

    def list_files(basePath, validExts=None, contains=None):
        # loop over the directory structure
        for rootDir, dirNames, filenames in os.walk(basePath):
            # loop over the filenames in the current directory
            for filename in filenames:
                # if the contains string is not none and the filename does not contain
                # the supplied string, then ignore the file
                if contains is not None and filename.find(contains) == -1:
                    continue

                # determine the file extension of the current file
                ext = filename[filename.rfind(".") :].lower()

                # check to see if the file is an image and should be processed
                if validExts is None or ext.endswith(validExts):
                    # construct the path to the image and yield it
                    imagePath = os.path.join(rootDir, filename)
                    yield imagePath
