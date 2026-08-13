"""Build openflight-jetson.zip: merge all PR branches, apply WD fixes, build UI."""
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = pathlib.Path(__file__).parent.parent
OUT = pathlib.Path.home() / "Downloads" / "openflight-jetson.zip"

SKIP_DIRS = {'.git', '.venv', '__pycache__', 'node_modules', '.claude',
             'scratchpad', 'artifacts', '.pytest_cache', '.ruff_cache', 'mobile'}
SKIP_EXTS = {'.pyc', '.pyo'}

# main-only commits not in any PR branch (oldest first)
MAIN_CHERRY_PICKS = [
    "840cfa58",  # fix: lock kld7 ring buffer against stream/shot race
    "c168f0d8",  # feat: ball-speed cosine correction + opt-in calculated spin
    "d60a0afe",  # feat: FlightWeb session uploader
    "37a84e91",  # feat: estimated/radar spin provenance on shot display
    "1bb9ff2c",  # fix: show real angle source on AoA/path cards (already in kiosk-ui-redesign)
    "6f876676",  # fix: guard radc median on empty frames
    "eb182e42",  # feat: cloud-sync status and controls in kiosk
]

# Merge order: start from kiosk-ui-redesign (most complete UI), layer the rest
PR_BRANCHES = [
    "pr/trajectory-physics",
    "pr/security-hardening",
    "pr/ble-server",
    "pr/i18n",
    "pr/design-tokens",
    "pr/history-api",
]

# Working-tree files to overlay after the merge.
# Only files that exist on pr/ble-server but NOT on pr/kiosk-ui-redesign,
# or that have Jetson-specific additions (--touch-events, --sim).
OVERLAY_FROM_WORKTREE = [
    "scripts/start-kiosk.sh",   # has --touch-events=enabled + --sim flag
    "scripts/jetson-setup.sh",  # Jetson-only, untracked on kiosk-ui branch
    "scripts/jetson-start.sh",  # Jetson-only, untracked on kiosk-ui branch
    "ui/src/components/SettingsPanel.css",  # inner scroll body, backdrop
    "ui/src/components/SettingsPanel.tsx",  # scroll body wrapper, lang tabIndex, body scroll lock
    "ui/src/components/ShotList.tsx",       # gate aria-modal on open to stop D-pad trap
    "ui/src/components/ShotList.css",       # flex:1 min-height:0 so toolbar/pagination are in viewport
    "ui/src/App.tsx",                       # logo tabIndex=-1
]


def run(cmd, cwd=None, check=True):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if check and r.returncode != 0:
        print(r.stdout[-2000:] if r.stdout else "")
        print(r.stderr[-2000:] if r.stderr else "", file=sys.stderr)
        sys.exit(1)
    return r


def fix_conflicts(wt: pathlib.Path):
    """Auto-resolve simple conflicts: keep HEAD side, or combine imports."""
    for f in wt.rglob("*"):
        if not f.is_file():
            continue
        try:
            content = f.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        if "<<<<<<< HEAD" not in content:
            continue
        rel = f.relative_to(wt)
        print(f"  resolving conflict: {rel}")
        if f.name == "package-lock.json":
            # Always take ours for lock files
            run(["git", "checkout", "--ours", str(rel)], cwd=wt)
            run(["git", "add", str(rel)], cwd=wt)
            continue
        # For other files: keep HEAD side of each conflict block
        resolved = re.sub(
            r'<<<<<<< HEAD\n(.*?)=======\n.*?>>>>>>> [^\n]+\n',
            r'\1',
            content,
            flags=re.DOTALL,
        )
        f.write_text(resolved, encoding="utf-8")
        run(["git", "add", str(rel)], cwd=wt)


WT = pathlib.Path(tempfile.mkdtemp(prefix="openflight-zip-"))

try:
    print(f"Worktree from pr/kiosk-ui-redesign: {WT}")
    # --detach: work in detached HEAD so commits never update the branch ref
    run(["git", "worktree", "add", "--detach", str(WT), "pr/kiosk-ui-redesign"], cwd=ROOT)

    for branch in PR_BRANCHES:
        print(f"Merging {branch}...")
        result = run(
            ["git", "merge", "--no-commit", "--no-ff", branch],
            cwd=WT, check=False,
        )
        if "CONFLICT" in result.stdout or result.returncode != 0:
            fix_conflicts(WT)
        status = run(["git", "status", "--porcelain"], cwd=WT)
        if status.stdout.strip() or run(["git", "rev-parse", "MERGE_HEAD"], cwd=WT, check=False).returncode == 0:
            run(["git", "commit", "-m", f"merge {branch}",
                 "--no-gpg-sign", "--no-verify"], cwd=WT)
        print(f"  {branch} merged.")

    for sha in MAIN_CHERRY_PICKS:
        print(f"Cherry-picking {sha}...")
        result = run(["git", "cherry-pick", "--no-commit", sha], cwd=WT, check=False)
        if "CONFLICT" in (result.stdout + result.stderr) or result.returncode != 0:
            fix_conflicts(WT)
        status = run(["git", "status", "--porcelain"], cwd=WT)
        if status.stdout.strip():
            run(["git", "commit", "-m", f"cherry-pick {sha}",
                 "--no-gpg-sign", "--no-verify"], cwd=WT)
        print(f"  {sha} applied.")

    # Overlay uncommitted working-tree fixes
    for rel_str in OVERLAY_FROM_WORKTREE:
        src = ROOT / rel_str
        dst = WT / rel_str
        if src.is_file():
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dst)
            print(f"  overlay: {rel_str}")

    # Strip Windows line endings from all shell scripts in the worktree
    for sh in WT.rglob("*.sh"):
        data = sh.read_bytes()
        if b"\r\n" in data:
            sh.write_bytes(data.replace(b"\r\n", b"\n"))
            print(f"  dos2unix: {sh.relative_to(WT)}")

    # Build UI
    print("\nBuilding UI...")
    run(["npm", "install", "--silent"], cwd=str(WT / "ui"))
    run(["npm", "run", "build"], cwd=str(WT / "ui"))
    print("UI built.\n")

    def should_include(path: pathlib.Path) -> bool:
        rel = path.relative_to(WT)
        parts = rel.parts
        if any(p in SKIP_DIRS for p in parts):
            return False
        if path.suffix in SKIP_EXTS:
            return False
        root = parts[0]
        if root == "ui":
            return len(parts) > 1 and parts[1] == "dist"
        included_roots = {"src", "scripts"}
        included_files = {"pyproject.toml", "uv.lock", "README.md"}
        return root in included_roots or str(rel).replace("\\", "/") in included_files

    count = 0
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(WT.rglob("*")):
            if f.is_file() and should_include(f):
                zf.write(f, f.relative_to(WT))
                count += 1

    size_mb = OUT.stat().st_size / 1_048_576
    print(f"Done: {OUT}  ({size_mb:.1f} MB)  {count} files")

finally:
    run(["git", "worktree", "remove", "--force", str(WT)], cwd=ROOT, check=False)
    if WT.exists():
        shutil.rmtree(WT, ignore_errors=True)
    print("Worktree cleaned up.")
