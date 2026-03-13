.PHONY: check test dev-host

VSCODE ?= code
DEV_WORKSPACE ?= $(CURDIR)/faro-dev.code-workspace

check:
	npm run check

test:
	npm test

dev-host:
	@"$(VSCODE)" --new-window --extensionDevelopmentPath="$(CURDIR)" "$(DEV_WORKSPACE)"
