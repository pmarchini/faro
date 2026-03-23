.PHONY: build check test dev-host package-vsix install-local upsert-agent-local upsert-agent-global upsert-agent-all upsert-copilot-agent-local

VSCODE ?= code
DEV_WORKSPACE ?= $(CURDIR)/faro-dev.code-workspace
VSIX_PATH ?= $(CURDIR)/dist/faro.vsix
FORCE_FLAG = $(if $(filter 1 true yes,$(FORCE)),-- --force,)

build:
	npm run build:vscode-assets

check:
	npm run check

test:
	npm test

dev-host: build
	@"$(VSCODE)" --new-window --extensionDevelopmentPath="$(CURDIR)" "$(DEV_WORKSPACE)"

package-vsix:
	@mkdir -p "$(dir $(VSIX_PATH))"
	@npm run package:vsix -- --out "$(VSIX_PATH)"

install-local: package-vsix
	@"$(VSCODE)" --install-extension "$(VSIX_PATH)" --force

upsert-agent-local:
	@test "$(SCOPE)" = "local" || (echo "Use: make upsert-agent-local SCOPE=local"; exit 1)
	@npm run upsert:agent-instructions:local $(FORCE_FLAG)

upsert-agent-global:
	@test "$(SCOPE)" = "global" || (echo "Use: make upsert-agent-global SCOPE=global"; exit 1)
	@npm run upsert:agent-instructions:global $(FORCE_FLAG)

upsert-agent-all:
	@test "$(SCOPE)" = "all" || (echo "Use: make upsert-agent-all SCOPE=all"; exit 1)
	@npm run upsert:agent-instructions $(FORCE_FLAG)

upsert-copilot-agent-local:
	@test "$(SCOPE)" = "local" || (echo "Use: make upsert-copilot-agent-local SCOPE=local"; exit 1)
	@npm run upsert:copilot-agent
