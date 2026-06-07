# PartSelect chat agent — dev workflow.
#
# Boot is offline + deterministic:  make up
# Refresh the data snapshot (network / paid APIs, run on host):  make scrape && make embed
.DEFAULT_GOAL := help
COMPOSE := docker compose

.PHONY: help up seed reset down logs ps psql scrape embed

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

up: ## Build + start the whole stack (db → seed → backend → frontend)
	$(COMPOSE) up -d --build
	@echo ""
	@$(COMPOSE) logs seed 2>/dev/null | grep -m1 "seeded:" || true
	@$(COMPOSE) ps
	@echo ""
	@echo "  Storefront + chat:  http://localhost:$${FRONTEND_PORT:-3000}"
	@echo "  Agent API:          http://localhost:$${BACKEND_PORT:-3001}/health"

seed: ## Re-run the deterministic seed (idempotent upsert)
	$(COMPOSE) run --rm seed

reset: ## Drop the volume and re-seed (use after a schema/db change)
	$(COMPOSE) down -v
	$(MAKE) up

down: ## Stop the stack (keeps data volume)
	$(COMPOSE) down

logs: ## Tail all service logs
	$(COMPOSE) logs -f

ps: ## Show service status
	$(COMPOSE) ps

psql: ## Open a psql shell on the running db
	docker exec -it partselect-pg psql -U $${POSTGRES_USER:-partselect} -d $${POSTGRES_DB:-partselect}

scrape: ## [offline data-prep, host] Enrich the SQLite snapshot with compat/install/symptom data (full catalog)
	cd scraper && python scrape.py --enrich --max-products 0

embed: ## [offline data-prep, host] Write Voyage embeddings into the SQLite snapshot
	python scripts/embed.py
