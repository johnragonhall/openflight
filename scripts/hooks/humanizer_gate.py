#!/usr/bin/env python3
"""Fatal pre-commit gate for the mechanical humanizer patterns.

Scans only the ADDED lines of the staged diff, so it blocks *new* violations
without choking on pre-existing text in a file you happen to touch. Deterministic
and fast: no model call, no false-positive guessing.

Rejects:
  - em / en / doubled-CJK dashes (— – ——)  in code, markdown, and config
  - curly quotes (“ ” ‘ ’)                  in source files only
  - emoji                                    in source files only
  - ' -- ' used as a prose dash              in comments (skips CLI/SQL/rules)

Never checks i18n translations (they legitimately keep em dashes) or vendored
trees. Bypass once: git commit --no-verify. Allow one line: end it with the
token  humanizer-allow  in a trailing comment.
"""
import io
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
# Substrings that exempt a whole path: translations keep dashes; the rest are
# vendored/generated or the gate's own source (which names the patterns).
EXCLUDE = (
    "ui/src/i18n/locales/", "ui/src/i18n/translations.ts",
    "node_modules/", "dist/", "build/", ".venv/", "__pycache__/", ".git/",
    "mobile/android/", "mobile/ios/",
    "scripts/hooks/",
    # Verbatim third-party reference library (provenance headers require
    # byte-exact upstream bodies, dashes and all); adapted copies that move
    # into superapp/ are scanned normally.
    "design-snippets/",
)

DASH = re.compile("[—–]")                          # — –
CURLY = re.compile("[“”‘’]")             # “ ” ‘ ’
EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF\U00002600-\U000027BF"
    "\U00002B00-\U00002BFF\U0001F1E6-\U0001F1FF\U0000FE0Fℹ]"
)
PROSE_DD = re.compile(r"(?<!-) -- (?!-)")                    # ' -- ' not inside ----
DD_SAFE = re.compile(
    r"nosemgrep|DROP TABLE|-{4,}|<!--|-->|"
    r"\b(cargo|npm|npx|pnpm|yarn|git|run|exec|sh|bash)\b"
)


def is_comment(path, line):
    if path.endswith((".md", ".markdown")):
        return True
    s = line.lstrip()
    return s.startswith(("//", "#", "*", "/*")) or "//" in line


def added_lines(diff):
    """Yield (path, new_line_number, content) for every '+' line."""
    path, ln = None, 0
    for raw in diff.splitlines():
        if raw.startswith("+++ "):
            p = raw[4:]
            path = p[2:] if p.startswith("b/") else p
        elif raw.startswith("@@"):
            m = re.search(r"\+(\d+)", raw)
            ln = int(m.group(1)) if m else 0
        elif raw.startswith("+"):        # (+++ already handled above)
            yield path, ln, raw[1:]
            ln += 1
        # '-' and context lines do not advance the new-file counter (-U0)


def main():
    diff = subprocess.run(
        ["git", "diff", "--cached", "-U0", "--diff-filter=ACM"],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    ).stdout

    viol = []
    for path, ln, content in added_lines(diff):
        if not path or any(x in path for x in EXCLUDE):
            continue
        if content.rstrip().endswith("humanizer-allow"):
            continue
        code = path.endswith(CODE_EXT)
        if DASH.search(content):
            viol.append((path, ln, "em/en dash", "replace the dash with , . : or ( )"))
        if code and CURLY.search(content):
            viol.append((path, ln, "curly quote", 'use a straight " or \''))
        if code and EMOJI.search(content):
            viol.append((path, ln, "emoji", "remove the emoji from source"))
        if is_comment(path, content) and PROSE_DD.search(content) and not DD_SAFE.search(content):
            viol.append((path, ln, "prose --", "use , . or : instead of -- as a dash"))

    if not viol:
        return 0
    sys.stderr.write("\n\033[31mpre-commit BLOCKED: humanizer patterns in staged lines\033[0m\n")
    for p, ln, rule, fix in viol:
        sys.stderr.write(f"  {p}:{ln}  [{rule}]  {fix}\n")
    sys.stderr.write("\nFix them, or bypass once:  git commit --no-verify\n")
    sys.stderr.write("Allow one line: append a trailing  humanizer-allow  token.\n")
    return 1


if __name__ == "__main__":
    sys.exit(main())
