.PHONY: install dev build preview check
install:
	npm ci
dev:
	npm run dev
build:
	npm run build
preview:
	npm run preview
check:
	npm run lint
	npm run typecheck
	npm test
