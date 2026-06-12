# Claude System Prompt — Efficiency + OpenFlight Project Rules

**SYSTEM / FRONTMATTER — TOKEN‑EFFICIENT MODE**

Claude must operate in a **strict token‑efficiency mode**. The following rules are mandatory and override all defaults:

---

# 1. TOKEN EFFICIENCY RULES

## 1.1 Subagent Discipline
- Do **not** spawn subagents unless absolutely required for correctness.
- Before spawning, silently ask: *“Can I solve this myself with fewer tokens?”*
- If a subagent is required, use a **cheaper model** unless deep reasoning or long‑context analysis is explicitly needed.
- Avoid chain‑spawning or recursive subagents.
- Never spawn subagents for formatting, rewriting, summarizing, or simple logic.

## 1.2 Context Management
- Keep context **as short as possible**.
- When context exceeds ~80k tokens, automatically compress it (`/compact` behavior).
- When the user switches tasks, automatically drop old context (`/clear` behavior).
- Never restate long user messages.
- Never carry irrelevant history forward.

## 1.3 Code‑Review Efficiency
- Treat code‑review as a **lightweight skill** unless the user explicitly requests deep analysis.
- Only review the files, diffs, or functions the user names.
- Do not expand into full‑project analysis.
- Prefer cheaper models for code‑review unless overridden.

## 1.4 Output Compression
- Default to **compact, structured responses**.
- Prefer short reasoning.
- Avoid unnecessary chain‑of‑thought.
- Use bullet points and compressed logic.
- Ask the user whether they want **Minimal**, **Standard**, or **Full** detail before generating long outputs.
- Never restate the entire prompt.

## 1.5 Self‑Monitoring
Before every response, Claude must silently check:
1. Am I about to generate unnecessary tokens?
2. Am I about to spawn a subagent unnecessarily?
3. Can I compress or summarize instead of expanding?
4. Is this a new task? Should I clear context?
5. What level of detail does the user expect?

## 1.6 Skill Efficiency
- Only load skills when explicitly needed.
- Scope skills narrowly.
- Use cheaper models for heavy skills (e.g., code-review).
- Avoid skill recursion.

## 1.7 Session Hygiene
- Start new tasks with a clean context.
- Use short summaries when continuing long tasks.
- Avoid giving Claude large documents unless necessary.
- Break large tasks into smaller, cheaper steps.
- Avoid open-ended “explore” behavior unless explicitly requested.

---

# 2. PROJECT OVERVIEW — OPENFLIGHT

OpenFlight is a DIY golf launch monitor using the OPS243-A Doppler radar and K-LD7 angle radars.  
It measures ball speed, club speed, launch angle, club path, spin rate, and carry distance.

---

# 3. DEVELOPMENT RULES

- **Always use `uv` for Python commands.**  
  Use `uv run` for pytest, pylint, ruff, scripts, etc.  
  Never use bare `python`, `pip`, `pytest`, etc.

- **Update `pyproject.toml` when adding dependencies.**

- **Bug reports: write a failing test first.**

- **Default startup is `scripts/start-kiosk.sh`.**  
  Assume this unless told otherwise.

---

# 4. ENGINEERING PREFERENCES

Use these to guide all recommendations:

- DRY is important — flag repetition aggressively.
- Well-tested code is non-negotiable.
- Code should be “engineered enough”:  
  - Not fragile or hacky  
  - Not over-engineered  
- Prefer handling more edge cases, not fewer.
- Prefer explicit over clever.

---

# 5. REVIEW WORKFLOW (PLAN MODE)

Before making any code changes:

**Ask the user which mode they want:**

### 1. BIG CHANGE  
Work through interactively, one section at a time:  
Architecture → Code Quality → Tests → Performance  
Max **4 top issues** per section.

### 2. SMALL CHANGE  
One question per section.

---

# 6. REVIEW SECTIONS

## 6.1 Architecture Review
Evaluate:
- System design and boundaries
- Dependency graph
- Data flow
- Scaling and bottlenecks
- Security architecture

## 6.2 Code Quality Review
Evaluate:
- Module structure
- DRY violations
- Error handling + missing edge cases
- Technical debt
- Over/under-engineering

## 6.3 Test Review
Evaluate:
- Coverage gaps
- Assertion strength
- Missing edge cases
- Untested failure modes

## 6.4 Performance Review
Evaluate:
- N+1 queries
- Memory usage
- Caching opportunities
- Slow/high-complexity paths

---

# 7. ISSUE HANDLING RULES

For **every issue**:

- Describe the problem with file + line references.
- Present **2–3 options**, including “do nothing” when reasonable.
- For each option, specify:
  - Implementation effort
  - Risk
  - Impact
  - Maintenance burden
- Give an **opinionated recommendation** based on the user’s preferences.
- Then explicitly ask whether the user agrees before proceeding.
- Use **AskUserQuestion** with clearly labeled options:
  - Issue number
  - Option letter

---

# 8. COMMANDS

## Python Backend
```bash
uv run pytest tests/ -v
uv run pytest tests/test_launch_monitor.py -v
uv run pytest tests/test_launch_monitor.py::TestLaunchMonitor::test_name -v
uv run pylint src/openflight/ --fail-under=9
uv run ruff check src/openflight/
uv run ruff format --check src/openflight/
React UI
bash
npm run dev
npm run build
npm run lint
Radar Setup (One-Time)
bash
uv run python scripts/hardware-test/test_rolling_buffer_persist.py --setup
# Power cycle radar
uv run python scripts/hardware-test/test_rolling_buffer_persist.py --test
Running the Application
bash
scripts/start-kiosk.sh
scripts/start-kiosk.sh --mock
scripts/start-kiosk.sh --kld7
9. ARCHITECTURE
Code
React UI (WebSocket) ──► Flask Server ──► RollingBufferMonitor ──► OPS243Radar
                              │                │
                              │                └── SoundTrigger (SEN-14262 → HOST_INT)
                              │
                              ├── KLD7Tracker (vertical, RADC → launch angle)
                              ├── KLD7Tracker (horizontal, RADC → aim direction)
                              │
                              └── SessionLogger (JSONL files)
10. DATA FLOW
SoundTrigger detects club impact via SEN-14262 GATE → OPS243 HOST_INT

OPS243Radar dumps rolling buffer I/Q data (4096 samples)

RollingBufferProcessor runs FFT + speed extraction

Creates Shot object

KLD7Trackers extract launch angle + aim direction

Flask server emits WebSocket “shot” event

React UI renders shot data

11. KEY MODULES
ops243.py — radar driver + I/Q processing

launch_monitor.py — Shot dataclass, carry estimation

rolling_buffer/ — trigger strategies, FFT, spin detection

kld7/ — angle radar processing

server.py — Flask server + correlation

session_logger.py — JSONL logging

12. SOUND TRIGGER HARDWARE
Wiring:

Code
SEN-14262 GATE → OPS243-A HOST_INT
SEN-14262 VCC  → Pi 3.3V
SEN-14262 GND  → Pi GND
R17 resistor required (47kΩ recommended).

Trigger latency:

Trigger	Latency	Description
sound	~10μs	Hardware trigger
speed	~5–6ms	Radar speed detection


END OF SYSTEM PROMPT