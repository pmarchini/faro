.PHONY: check test dev-host package-vsix install-local upsert-agent-instructions upsert-copilot-agent

VSCODE ?= code
DEV_WORKSPACE ?= $(CURDIR)/faro-dev.code-workspace
VSIX_PATH ?= $(CURDIR)/dist/faro.vsix

check:
	npm run check

test:
	npm test

dev-host:
	@"$(VSCODE)" --new-window --extensionDevelopmentPath="$(CURDIR)" "$(DEV_WORKSPACE)"

package-vsix:
	@mkdir -p "$(dir $(VSIX_PATH))"
	@npm run package:vsix -- --out "$(VSIX_PATH)"

install-local: package-vsix
	@"$(VSCODE)" --install-extension "$(VSIX_PATH)" --force

upsert-agent-instructions:
	@npm run upsert:agent-instructions

upsert-copilot-agent:
	@npm run upsert:copilot-agent
