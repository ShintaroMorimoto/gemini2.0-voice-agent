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

deploy:
	gcloud run deploy --project=$(PROJECT) \
		--region=$(LOCATION) \
		--source=. \
		--allow-unauthenticated \
		--port=8080 \
		--set-env-vars=PROJECT=$(PROJECT),LOCATION=${LOCATION},VERSION=v1beta1\
		voice-agent
