all: image data

method ?= hog

image:
	docker build --build-arg UID=$(shell id -u) --build-arg GID=$(shell id -g) -t mmm-face-reco-dnn-dataset-runner .

data:
	docker run -it -v $(shell pwd)/../dataset:/srv/dataset -v $(shell pwd):/srv/model -e method=$(method) mmm-face-reco-dnn-dataset-runner:latest
