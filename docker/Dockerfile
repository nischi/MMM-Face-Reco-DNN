FROM jjanzic/docker-python3-opencv

RUN pip install dlib face_recognition imutils

WORKDIR /srv

# Setup our user
ARG UNAME=ocvuser
ARG UID=1000
ARG GID=1000
RUN groupadd -g $GID -o $UNAME
RUN useradd -m -u $UID -g $GID -o -s /bin/sh $UNAME

ENV method=hog
USER $UNAME

# Add the application
ADD *.py *.xml /srv/

CMD [ "python3", "/srv/encode.py", "-i", "/srv/dataset", "-e", "/srv/model/encodings.pickle", "-d", "${method}" ]
