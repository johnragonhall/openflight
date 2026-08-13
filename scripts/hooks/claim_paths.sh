#!/bin/sh
# Commit fence -- claim side.
#
# A concurrent session sharing this checkout can run a broad `git add -A` or
# `git commit -a` and sweep another session's staged-but-uncommitted files into
# the wrong commit (it happened: a whole feature landed under an unrelated
# commit message). To stop that, a session RESERVES the paths it is about to
# commit; scripts/hooks/pre-commit then refuses any commit that stages a path
# another live session has reserved.
#
#   sh scripts/hooks/claim_paths.sh claim <repo-relative-path>...
#   sh scripts/hooks/claim_paths.sh release
#
# State lives under .git/claude-fence (untracked, shared by every worktree and
# session on this machine). A claim is one file per session, keyed by
# CLAUDE_CODE_SESSION_ID, and its mtime drives a TTL so a crashed session never
# reserves paths forever. Fails open (exit 0) on any error: the fence must never
# be what stops real work.
set -u

git rev-parse --show-toplevel >/dev/null 2>&1 || exit 0
fence_dir=$(git rev-parse --git-path claude-fence 2>/dev/null) || exit 0

# Session identity, reduced to a safe filename. Falls back to the process id,
# then to "unknown" (a lone unknown claim still self-owns and never blocks).
sid=${CLAUDE_CODE_SESSION_ID:-${CLAUDE_PID:-unknown}}
sid=$(printf '%s' "$sid" | tr -c 'A-Za-z0-9._-' '_')
claim_file="$fence_dir/$sid.claim"

case "${1:-}" in
  claim)
    shift
    mkdir -p "$fence_dir" 2>/dev/null || exit 0
    : > "$claim_file" 2>/dev/null || exit 0
    for p in "$@"; do
      # Skip empties so the claim file never carries a blank line (a blank
      # pattern would match every staged path in the guard's grep -Fxf).
      [ -n "$p" ] || continue
      printf '%s\n' "$p" >> "$claim_file"
    done
    ;;
  release)
    rm -f "$claim_file" 2>/dev/null || true
    ;;
  *)
    echo "usage: claim_paths.sh {claim <repo-relative-path>...|release}" >&2
    exit 2
    ;;
esac
exit 0
