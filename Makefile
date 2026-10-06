# Local development environment (docker-compose). See README.md "Local development".
#
#   make up        build + start Postgres 16, the API (hot reload) and the web app (HMR), wait until healthy
#   make migrate   apply the committed Prisma migrations (prisma migrate deploy)
#   make seed      load the migrated data set from data/migrated/ (app/api/scripts/seed.ts)
#   make test      unit tests of the API and the web app + the Apex characterisation specs (tests/parity)
#   make characterise  run every characterisation spec for real (red until the Apex ports land)
#   make e2e       smoke-check the running stack, then run the Playwright E2E suite when it exists
#
# Containers run as your uid/gid so files written into the bind-mounted source trees stay yours;
# always go through make (or export DEV_UID/DEV_GID yourself before calling docker compose directly).

SHELL := /bin/bash
.DEFAULT_GOAL := help

export DEV_UID ?= $(shell id -u)
export DEV_GID ?= $(shell id -g)
API_PORT ?= 3000
WEB_PORT ?= 5173
export API_PORT WEB_PORT

COMPOSE ?= docker compose
RUN_API := $(COMPOSE) run --rm --no-deps api
RUN_WEB := $(COMPOSE) run --rm --no-deps web
# tests/parity is bind-mounted into the api container (it links app/api as a package); the
# characterisation specs boot the API in-process, so they run with the api image's Node. The cd is
# explicit because the api entrypoint resets the working directory to app/api, and the npm cache is
# separate because the image's /tmp/npm-cache belongs to root.
RUN_PARITY := $(COMPOSE) run --rm -e npm_config_cache=/tmp/parity-npm-cache api sh -c 'cd /workspace/tests/parity && npm ci --no-audit --no-fund &&

.PHONY: help up down restart ps logs build migrate migrate-status migrate-dev seed test characterise lint e2e smoke psql openapi reset clean

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

up: ## Build and start db + api + web, wait until healthy
	$(COMPOSE) up -d --build --wait db api web
	@echo
	@echo "API  http://localhost:$(API_PORT)/health   docs http://localhost:$(API_PORT)/docs"
	@echo "Web  http://localhost:$(WEB_PORT)/"

down: ## Stop and remove the containers (keeps the database volume)
	$(COMPOSE) down --remove-orphans

restart: down up ## Restart the stack

ps: ## Show container status and health
	$(COMPOSE) ps

logs: ## Follow the logs of all services
	$(COMPOSE) logs -f --tail=100

build: ## (Re)build the dev images without starting them
	$(COMPOSE) build db api web

migrate: ## Apply committed Prisma migrations to the local database (starts db if needed)
	$(COMPOSE) up -d --wait db
	$(COMPOSE) run --rm --no-deps api npx prisma migrate deploy

migrate-status: ## Show which Prisma migrations are applied to the local database
	$(COMPOSE) up -d --wait db
	$(COMPOSE) run --rm --no-deps -T api npx prisma migrate status

migrate-dev: ## Create a new migration from schema.prisma changes (prisma migrate dev --name NAME=...)
	$(COMPOSE) up -d --wait db
	$(COMPOSE) run --rm --no-deps api npx prisma migrate dev $(if $(NAME),--name $(NAME),)

seed: ## Load the migrated data set (data/migrated/) into the local database
	$(COMPOSE) up -d --wait db
	$(COMPOSE) run --rm --no-deps api npm run seed

test: ## API + web unit tests and the Apex characterisation specs (suites whose port is pending report as todo)
	$(RUN_API) npm test
	$(RUN_WEB) npm test
	$(RUN_PARITY) npm test'

characterise: ## Run every Apex characterisation spec for real against the local database (PARITY_RUN_ALL=1; red until the ports land)
	$(COMPOSE) up -d --wait db
	$(RUN_PARITY) PARITY_RUN_ALL=1 npm test'

lint: ## Lint the API and the web app inside the dev containers
	$(RUN_API) npm run lint
	$(RUN_WEB) npm run lint

smoke: ## Check the running stack: API live/ready, OpenAPI served, web shell served, web -> API proxy
	API_PORT=$(API_PORT) WEB_PORT=$(WEB_PORT) tools/dev/smoke.sh

e2e: up smoke ## Smoke-check the stack, then run the Playwright E2E suite (tests/parity/e2e) when it exists
	@if [ -f tests/parity/playwright.config.ts ]; then \
	  $(COMPOSE) --profile e2e run --rm e2e; \
	else \
	  echo "tests/parity has no playwright.config.ts yet (ticket UNT3-24): only the smoke checks ran."; \
	fi

psql: ## Open psql on the local database
	$(COMPOSE) exec db psql -U dreamhouse -d dreamhouse

openapi: ## Regenerate app/api/openapi/openapi.json and the web app's typed client
	$(RUN_API) npm run openapi:export
	$(RUN_WEB) npm run api:generate

reset: ## Stop everything and delete the database and node_modules volumes
	$(COMPOSE) --profile e2e down --remove-orphans --volumes

clean: reset ## reset + remove the dev images
	$(COMPOSE) --profile e2e down --rmi local
