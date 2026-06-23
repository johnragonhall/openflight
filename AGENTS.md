# AGENTS.md

This file provides guidance to Codex when working with code in this repository.
For full project context see [CLAUDE.md](CLAUDE.md). Global conventions at `~/.claude/knowledge/conventions/`.

## Project Overview

OpenFlight is a DIY golf launch monitor using the OPS243-A Doppler radar and K-LD7 angle radars. It measures ball speed, club speed, launch angle, club path, spin rate, and carry distance.

## Development Rules

- **Always use `uv` for Python commands.** Use `uv run` to execute Python tools (pytest, pylint, ruff, etc.). Never use bare `python`, `pip`, `pytest`, etc.
- **Update `pyproject.toml` when adding dependencies.** If new Python packages are introduced, add them to the appropriate dependency list in `pyproject.toml`.
- **Bug reports: write a failing test first.** When the user reports a bug, write a test that reproduces and confirms the bug before investigating or fixing it.
- **Default startup is `scripts/start-kiosk.sh`.** Assume the project is started via this script unless told otherwise.

## Commands

### Python Backend

```bash
uv run pytest tests/ -v
uv run pytest tests/test_launch_monitor.py -v
uv run pytest tests/test_launch_monitor.py::TestLaunchMonitor::test_name -v
uv run pylint src/openflight/ --fail-under=9
uv run ruff check src/openflight/
uv run ruff format --check src/openflight/
```

### React UI

```bash
npm run dev      # Development server with hot reload
npm run build    # Production build
npm run lint     # ESLint
```

### Radar Setup (One-Time)

```bash
uv run python scripts/hardware-test/test_rolling_buffer_persist.py --setup
# Power cycle radar (unplug USB, wait 3s, replug)
uv run python scripts/hardware-test/test_rolling_buffer_persist.py --test
```

### Running the Application

```bash
scripts/start-kiosk.sh              # Default: rolling buffer + sound trigger
scripts/start-kiosk.sh --mock       # Development mode without hardware
scripts/start-kiosk.sh --kld7       # With K-LD7 angle radars
```

### Sound Trigger Testing

```bash
uv run python scripts/hardware-test/test_rolling_buffer_persist.py --test
uv run python scripts/hardware-test/test_sound_trigger_hardware.py
```

## Architecture

```text
React UI (WebSocket) ──► Flask Server ──► RollingBufferMonitor ──► OPS243Radar
                              │                │
                              │                └── SoundTrigger (SEN-14262 → HOST_INT)
                              │
                              ├── KLD7Tracker (vertical, RADC → launch angle)
                              ├── KLD7Tracker (horizontal, RADC → aim direction)
                              │
                              └── SessionLogger (JSONL files)
```

### Data Flow

1. SoundTrigger detects club impact via SEN-14262 GATE → OPS243 HOST_INT
2. OPS243Radar (`ops243.py`) dumps rolling buffer I/Q data (4096 samples)
3. RollingBufferProcessor runs FFT + speed extraction
4. Creates `Shot` object with ball_speed, club_speed, spin, carry
5. KLD7Trackers extract launch angle (vertical) and aim direction (horizontal)
6. Flask server (`server.py`) emits WebSocket "shot" event
7. React UI (`ui/src/`) renders shot data

### Key Modules

- `ops243.py` — OPS243 radar driver, rolling buffer capture, I/Q processing
- `launch_monitor.py` — Shot dataclass, ClubType enum, carry estimation
- `rolling_buffer/` — Trigger strategies, I/Q processor, spin detection
- `kld7/` — K-LD7 angle radar: RADC streaming, phase interferometry, dual-radar support
- `server.py` — Flask server, shot processing, K-LD7 correlation, carry estimation
- `session_logger.py` — JSONL logging for post-session analysis
- `ble_server.py` — BLE GATT peripheral (HMAC-auth, shot/event notify)

### Mobile App

Expo iOS/Android app in `mobile/`. Connects over Wi-Fi (Socket.IO) or BLE; never use `uv` there.
Architecture: `docs/mobile-architecture.md`. BLE protocol: `docs/mobile-ble-protocol.md`.

### Processing Mode

**Rolling Buffer** is the default and only production mode. OPS243-A buffers I/Q data continuously; on sound trigger, dumps and analyzes for ball speed, club speed, spin. K-LD7 data correlated via impact timestamp.

## Key Constants

- Sample rate: 30,000 Hz
- FFT window: 128 samples, zero-padded to 4096
- CFAR threshold: SNR > 15.0
- DC mask: 150 bins (~15 mph exclusion zone)
- Shot timeout: 0.5 seconds
- Min ball speed: 35 mph

## Session Logging

Logs: `~/openflight_sessions/session_*.jsonl`
Entry types: `session_start`, `session_end`, `reading_accepted`, `shot_detected`, `iq_reading`, `iq_blocks`, `trigger_event`, `rolling_buffer_capture`

## Sound Trigger Hardware

```text
SEN-14262 GATE → OPS243-A HOST_INT (J3 Pin 3)
SEN-14262 VCC  → Pi 3.3V
SEN-14262 GND  → Pi GND
```

R17 resistor required (47kΩ recommended). See `docs/sound-trigger-wiring.md`.

| Trigger | Latency | Description |
|---------|---------|-------------|
| `sound` | ~10μs | Hardware: SEN-14262 GATE → HOST_INT |
| `speed` | ~5-6ms | Radar speed detection |
