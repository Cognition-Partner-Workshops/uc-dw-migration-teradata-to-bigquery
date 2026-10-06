# AWS infrastructure of the demo (Terraform). See README.md in this directory.
#
#   make up        bootstrap the state backend, apply, build+push the API image, run the migrations,
#                  roll the service, build+upload the web app, run the smoke checks  (first-time and repeatable)
#   make plan      terraform plan (must be clean after `make up`)
#   make destroy   tear everything down (then `make destroy-backend` removes the state bucket + lock table)
#
# Credentials: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY of account 599083837640 in the environment
# (GitHub Actions assumes the OIDC roles of modules/cicd instead; see .github/workflows/deploy.yml).

SHELL := /bin/bash
.DEFAULT_GOAL := help

ENVIRONMENT ?= demo
ENV_DIR := envs/$(ENVIRONMENT)
TF := terraform -chdir=$(ENV_DIR)
AUTO_APPROVE ?= -auto-approve
export ENVIRONMENT

.PHONY: help bootstrap init fmt fmt-check validate plan apply up push migrate deploy-api deploy-web smoke output destroy destroy-backend

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

bootstrap: ## Create the remote-state S3 bucket + DynamoDB lock table (idempotent)
	scripts/bootstrap-backend.sh

init: ## terraform init (remote backend)
	$(TF) init -input=false -upgrade=false

fmt: ## terraform fmt -recursive
	terraform fmt -recursive

fmt-check: ## terraform fmt -check (CI)
	terraform fmt -check -recursive -diff

validate: ## terraform validate without touching the backend (CI)
	$(TF) init -backend=false -input=false >/dev/null
	$(TF) validate

plan: init ## terraform plan
	$(TF) plan -input=false -lock-timeout=5m

apply: init ## terraform apply
	$(TF) apply -input=false -lock-timeout=5m $(AUTO_APPROVE)

push: ## Build app/api/Dockerfile and push it to ECR (IMAGE_TAG=latest)
	scripts/push-api-image.sh

migrate: ## Run `prisma migrate deploy` as a one-off ECS task and wait for it
	scripts/run-migrations.sh

deploy-api: ## Force a new ECS deployment and wait until stable
	scripts/deploy-api.sh

deploy-web: ## Build app/web against the deployed API/Cognito, upload to S3, invalidate CloudFront
	scripts/deploy-web.sh

smoke: ## Acceptance checks: ALB /health, CloudFront SPA, CloudFront /api proxy, CSP header
	scripts/smoke.sh

output: init ## Show the (non-secret) Terraform outputs
	$(TF) output

up: bootstrap apply push migrate deploy-api deploy-web smoke ## Everything: bootstrap, apply, push, migrate, deploy API + web, smoke

destroy: init ## Destroy every resource of the environment (buckets and ECR images included)
	$(TF) destroy -input=false -lock-timeout=5m $(AUTO_APPROVE)

destroy-backend: ## After destroy: delete the state bucket (all versions) and the lock table
	scripts/destroy-backend.sh
