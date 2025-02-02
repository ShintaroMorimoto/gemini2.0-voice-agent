ifneq (,$(wildcard ./.env))
    include .env
    export
endif


.PHONY: build push deploy

build:
	docker image build -t $(IMAGE_NAME):$(TAG) .
	docker tag $(IMAGE_NAME):$(TAG) $(REGISTRY)/$(IMAGE_NAME):$(TAG)

push:
	docker push $(REGISTRY)/$(IMAGE_NAME):$(TAG)

build-push: build push
