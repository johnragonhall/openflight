#!/bin/sh
# Install the tracked git hooks into .git/hooks.
#
#   sh scripts/hooks/install.sh
#
# core.hooksPath is deliberately left unset so any machine-local extra hooks in
# .git/hooks survive. Ported from the AI Management repo.
set -e
repo_root=$(git rev-parse --show-toplevel)
src="$repo_root/scripts/hooks"
dst="$repo_root/.git/hooks"

for hook in pre-commit commit-msg; do
  cp "$src/$hook" "$dst/$hook"
  chmod +x "$dst/$hook"
  echo "installed: .git/hooks/$hook"
done
echo "done. Bypass a run with 'git commit --no-verify'; skip the LLM judge with 'HUMANIZER_JUDGE=0 git commit ...'."
