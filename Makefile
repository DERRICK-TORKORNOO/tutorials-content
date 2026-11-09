.DEFAULT_GOAL := help
.PHONY: help install dev build preview check lint typecheck test format db-generate db-schema schema db-migrate migrate db-seed seed db-setup db-sql sql db-studio
help:
	@echo "Kudi Store — local development and Supabase setup"
	@echo "make install     Install locked npm dependencies"
	@echo "make dev         Start Next.js and the API"
	@echo "make check       Lint, TypeScript and database/API tests"
	@echo "make build       Build the app and offline asset list"
	@echo "make preview     Start the production build"
	@echo "make db-schema   Generate a migration from api/db/schema.ts (no database needed)"
	@echo "make db-sql      Export supabase/setup.sql for the Supabase SQL Editor"
	@echo "make db-migrate  Apply migrations using DATABASE_URL in .env.local"
	@echo "make db-seed     Insert seed products without overwriting existing rows"
	@echo "make db-setup    Apply migrations and insert the seed data"
	@echo "make db-studio   Open Drizzle Studio using DATABASE_URL"
install:
	npm ci
dev:
	npm run dev
build:
	npm run build
preview:
	npm run preview
check: lint typecheck test
lint:
	npm run lint
typecheck:
	npm run typecheck
test:
	npm test
format:
	npm run format
db-generate db-schema schema:
	npm run db:generate
db-migrate migrate:
	npm run db:migrate
db-seed seed:
	npm run db:seed
db-setup: db-migrate db-seed
db-sql sql:
	npm run db:sql
db-studio:
	npx drizzle-kit studio
