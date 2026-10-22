#!/usr/bin/env bash
# Runs the Claude Code mod's tests with `claude plugin test`.
#
# The runner loads every *.test.ts under the folder it is given, and the
# repository root also holds the extension's node:test suites, which the mod
# runtime cannot load. So the mod's files are staged in a temporary folder
# and the runner is pointed there.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

mkdir -p "$stage/src"
cp -R "$root/.claude-plugin" "$root/hooks" "$root/claude-code" "$root/skills" "$stage/"
cp -R "$root/src/core" "$stage/src/core"
rm -rf "$stage/.claude-plugin/types"

claude plugin test "$stage"
