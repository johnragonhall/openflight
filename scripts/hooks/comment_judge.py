#!/usr/bin/env python3
"""Fatal pre-commit judge for the JUDGMENT rules the regex gate cannot see:
the 9 code-comment rules and the fuzzy humanizer patterns (rule-of-three,
negative parallelism, promotional tone, AI vocabulary, diff-anchored comments).

Sends only the ADDED comment / doc-prose lines from the staged diff to the
`claude` CLI and blocks the commit if it reports a high-confidence violation.

Design guards (deliberate):
  * FATAL on findings, but FAILS OPEN on any infrastructure problem (claude CLI
    missing, offline, timeout, unparseable output) so a network blip never
    permanently blocks commits.
  * Timeout kills the WHOLE claude process tree (taskkill /T on Windows): the
    CLI spawns children that inherit the output pipes, and killing only the
    parent leaves communicate() blocked on those pipes forever, which is a
    hang the per-process timeout alone cannot prevent.
  * Only runs when comment/doc lines actually changed.
  * Budget:               HUMANIZER_JUDGE_TIMEOUT=<seconds>  (default 120: a
    too-short budget silently fail-opens the gate under load, which costs more
    than the wait; CLI startup alone can take 10-20s beside a concurrent build)
  * Disable per-commit:  HUMANIZER_JUDGE=0 git commit ...
  * Bypass everything:    git commit --no-verify
"""
import glob
import io
import json
import os
import re
import subprocess
import sys

for _s in (sys.stdout, sys.stderr):
    # Both are TextIOWrapper on a real console, but typeshed declares them as
    # the narrower TextIO, which has no reconfigure(). Anything else (a pipe
    # wrapper, a StringIO under test) keeps its own encoding.
    if isinstance(_s, io.TextIOWrapper):
        _s.reconfigure(encoding="utf-8", errors="replace")

CODE_EXT = (".py", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".sh")
DOC_EXT = (".md", ".markdown")
EXCLUDE = ("ui/src/i18n/locales/", "ui/src/i18n/translations.ts", "node_modules/",
           "mobile/android/", "mobile/ios/", "dist/", "build/", ".venv/",
           "__pycache__/", ".git/", "scripts/hooks/")
MAX_LINES = 160          # cap payload so a huge commit stays cheap/fast
TIMEOUT_S = int(os.environ.get("HUMANIZER_JUDGE_TIMEOUT", "120"))

RULES = """You are a fatal pre-commit reviewer. Judge ONLY the added lines below,
which are code comments and markdown prose from a staged commit. Report a
violation ONLY when you are highly confident; when unsure, stay silent. Do NOT
flag em/en dashes, curly quotes, or emoji (a separate deterministic gate owns
those). Do NOT flag text that is quoting or defining a rule as an example.

Flag against these rules:

Code-comment rules:
 1 A comment must not just restate what the code plainly does.
 2 A comment must not paper over unclear code that should be renamed/rewritten.
 4 A comment must dispel confusion, not add it.
 8 A bug-fix comment should say what/why, not be absent.
 9 Incomplete work should be marked (TODO/FIXME with context), not left silent.

Humanizer (prose) rules:
 - rule-of-three padding; forced "not just X but Y" negative parallelism
 - promotional / significance-inflating tone ("crucial", "seamless", "robust")
 - AI vocabulary pile-ups ("delve", "leverage", "underscore", "tapestry")
 - diff-anchored comments that narrate a change instead of describing the thing
   as it is ("this replaces the old...", "previously we...").

Return ONLY a JSON object, no prose:
{"violations":[{"file":"path","line":N,"rule":"short-tag","why":"one sentence"}]}
Empty list means clean."""


def added_prose(diff):
    path, ln, out = None, 0, []
    for raw in diff.splitlines():
        if raw.startswith("+++ "):
            p = raw[4:]
            path = p[2:] if p.startswith("b/") else p
        elif raw.startswith("@@"):
            m = re.search(r"\+(\d+)", raw)
            ln = int(m.group(1)) if m else 0
        elif raw.startswith("+"):
            content = raw[1:]
            if path and not any(x in path for x in EXCLUDE):
                is_doc = path.endswith(DOC_EXT)
                s = content.lstrip()
                is_comment = s.startswith(("//", "///", "//!", "#", "*", "/*")) or "//" in content
                if (is_doc or (path.endswith(CODE_EXT) and is_comment)) and s.strip():
                    out.append((path, ln, content.rstrip()))
            ln += 1
    return out


def delete_transcript(session_id):
    """Delete the transcript this headless judge run created, so each commit's
    reviewer call does not pile up as a resumable conversation. Best-effort;
    never fatal to the commit."""
    if not session_id:
        return
    pattern = os.path.join(
        os.path.expanduser("~"), ".claude", "projects", "*",
        f"{session_id}.jsonl",
    )
    for path in glob.glob(pattern):
        try:
            os.remove(path)
        except OSError:
            pass


def extract_json(text):
    a, b = text.find("{"), text.rfind("}")
    if a == -1 or b == -1 or b < a:
        raise ValueError("no json object in model output")
    return json.loads(text[a:b + 1])


def kill_tree(proc):
    """Fell the judge's whole process tree. The claude CLI spawns children
    that inherit our stdout/stderr pipes; on Windows proc.kill() reaps only
    the parent, the orphans keep the pipe handles open, and communicate()
    blocks on them indefinitely. taskkill /T closes the tree so the pipes
    close and the reader threads can finish."""
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
            capture_output=True,
        )
    else:
        proc.kill()


JUDGE_ARGV = ["claude", "-p", "--output-format", "json"]


def run_judge(prompt, argv=None):
    """Run the claude CLI with a hard wall-clock budget. Raises RuntimeError
    (the caller's fail-open path) on timeout or a non-zero exit. argv is
    injectable so the timeout path is testable without the real CLI."""
    proc = subprocess.Popen(
        argv or JUDGE_ARGV,
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, encoding="utf-8", errors="replace",
    )
    try:
        out, err = proc.communicate(input=prompt, timeout=TIMEOUT_S)
    except subprocess.TimeoutExpired:
        kill_tree(proc)
        try:
            proc.communicate(timeout=10)
        except subprocess.TimeoutExpired:
            pass
        raise RuntimeError(
            f"judge timed out after {TIMEOUT_S}s, process tree killed "
            "(HUMANIZER_JUDGE_TIMEOUT to adjust)"
        )
    if proc.returncode != 0:
        raise RuntimeError(err.strip()[:200] or "claude exited non-zero")
    return out


def main():
    if os.environ.get("HUMANIZER_JUDGE", "1") == "0":
        return 0
    diff = subprocess.run(
        ["git", "diff", "--cached", "-U0", "--diff-filter=ACM"],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    ).stdout
    lines = added_prose(diff)
    if not lines:
        return 0
    payload = "\n".join(f"{p}:{n}: {c}" for p, n, c in lines[:MAX_LINES])
    prompt = RULES + "\n\nAdded lines:\n" + payload

    session_id = None
    try:
        stdout = run_judge(prompt)
        envelope = json.loads(stdout)            # {type:result, result:"...", session_id, ...}
        session_id = envelope.get("session_id")
        result = envelope.get("result", stdout)
        verdict = extract_json(result)
        viol = verdict.get("violations", [])
    except Exception as e:                       # fail OPEN on any infra problem
        sys.stderr.write(f"\033[33mpre-commit: comment judge skipped ({e})\033[0m\n")
        return 0
    finally:
        delete_transcript(session_id)            # do not leave a stray conversation

    if not viol:
        sys.stderr.write("\033[32mpre-commit: comment judge clean\033[0m\n")
        return 0
    sys.stderr.write("\n\033[31mpre-commit BLOCKED: comment/prose rule violations\033[0m\n")
    for v in viol:
        sys.stderr.write(f"  {v.get('file')}:{v.get('line')}  [{v.get('rule')}]  {v.get('why')}\n")
    sys.stderr.write("\nFix them, disable the judge once (HUMANIZER_JUDGE=0 git commit ...),\n")
    sys.stderr.write("or bypass all hooks once (git commit --no-verify).\n")
    return 1


if __name__ == "__main__":
    sys.exit(main())
