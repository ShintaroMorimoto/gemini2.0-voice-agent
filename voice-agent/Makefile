.PHONY: deploy
build:
	docker image build -t voice-agent .
	docker tag voice-agent us-east1-docker.pkg.dev/sandbox-morimoto-s1/zenn-ai-agent-hackathon/voice-agent
	docker push us-east1-docker.pkg.dev/sandbox-morimoto-s1/zenn-ai-agent-hackathon/voice-agent