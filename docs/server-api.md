# Server API

The OpenFlight Flask server (`src/openflight/server.py`) serves the kiosk UI, a REST API for
history and pairing, an MJPEG camera stream, and a Socket.IO event API that the kiosk and the
mobile app both use. The mobile app can reach the same data over BLE (see
[mobile-ble-protocol.md](mobile-ble-protocol.md)).

## REST endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/` | none | Serve the React kiosk app. |
| GET | `/scoreboard` | none | Serve the React app in the passive scoreboard view. |
| GET | `/remote` | none | Serve the React phone/tablet web-remote (D-pad) page. |
| GET | `/<path>` | none | Static assets. |
| GET | `/api/pair-qr` | localhost only | Return the BLE pairing payload. |
| GET | `/api/history` | none (LAN) | Last 20 session summaries from JSONL logs. |
| GET | `/api/history/<session_id>/shots` | none (LAN) | Per-shot detail for one session. |
| GET | `/camera/stream` | camera token | MJPEG stream. |
| POST | `/api/shutdown` | admin token | Clean server shutdown. |

### `GET /api/pair-qr`

Returns `{ "v": 1, "s": "<secret hex>", "h": "<pi lan ip>", "p": <port> }`. Gated to
`127.0.0.1`/`::1` by the socket peer address (not `X-Forwarded-For`, which a LAN host can spoof), so
the pairing secret never crosses the network. Non-local callers get `403`.

### `GET /api/history`

Reads `~/openflight_sessions/session_*.jsonl`, newest first, capped at 20. Returns per-session
summaries (id, timing, shot count, max ball speed). Missing directory returns
`{ "sessions": [] }`.

### `GET /api/history/<session_id>/shots`

Validates the id against `^session_[\w-]+$`, then parses the matching JSONL file and returns every
`shot_detected` entry as a shot object (ball/club speed, carry, launch angles, spin, club,
timestamp). `400` on a bad id, `404` if the file is absent.

### `GET /camera/stream`

Requires `?token=<camera token>`. Returns `503` unless the camera is enabled and streaming.
Response is `multipart/x-mixed-replace; boundary=frame` MJPEG.

### `POST /api/shutdown`

Body `{ "token": "<admin token>" }`. Wrong token returns `403`. On success it schedules a delayed
process shutdown and returns `{ "status": "shutting_down" }`.

## Tokens

On Socket.IO `connect`, the server emits `admin_token` with `{ token, camera_token }` to that
client. The admin token gates shutdown and camera toggles; the camera token gates the MJPEG stream.

## Socket.IO events

### Client → server

| Event | Payload | Effect |
|-------|---------|--------|
| `get_session` | - | Server emits `session_state`. |
| `clear_session` | - | Clear session; server emits `session_cleared`. |
| `set_club` | `{club}` | Set active club; server emits `club_changed`. |
| `simulate_shot` | - | Inject a mock shot (dev). |
| `client_prefs` | `{accessibility}` | Relay phone a11y prefs; server emits `accessibility_prefs_update`. |
| `remote_key` | `{key}` | Web-remote D-pad relay; server re-broadcasts `remote_key` to all clients. Key must be one of `up`/`down`/`left`/`right`/`ok`/`back` (others ignored). Nav-only, no auth. |
| `toggle_camera` | `{token}` | Toggle camera on/off (admin token). |
| `toggle_camera_stream` | `{token}` | Start/stop streaming (admin token). |
| `get_camera_status` | - | Server emits `camera_status`. |
| `toggle_debug` | - | Toggle debug recording; server emits `debug_toggled`. |
| `get_debug_status` | - | Server emits debug status. |
| `get_radar_config` | - | Server emits `radar_config`. |
| `set_radar_config` | config fields | Apply radar settings; emits `radar_config` or `radar_config_error`. |
| `get_trigger_status` | - | Server emits `trigger_status`. |
| `shutdown` | - | Server emits `shutdown_ack`, then stops. |

`set_radar_config` validates ranges: `min_speed` 0–200, `max_speed` 10–300, `min_magnitude` 0–100.
Out-of-range values return `radar_config_error`.

### Server → client

| Event | When |
|-------|------|
| `shot` | A new shot was detected (`{shot}`). |
| `session_state` | In response to `get_session` (`{stats, shots}`, plus `mock_mode`). |
| `session_cleared` | After a clear. |
| `club_changed` | After `set_club` (`{club}`). |
| `accessibility_prefs_update` | After `client_prefs` (`{accessibility}`). |
| `remote_key` | After `remote_key` from a web-remote (`{key}`); the display moves focus / activates / dismisses. |
| `camera_status` | Camera enabled/available/streaming + ball detection. |
| `admin_token` | On connect (`{token, camera_token}`). |
| `trigger_status` | On connect and on request. |
| `radar_config` / `radar_config_error` | Radar config read/write results. |
| `debug_toggled` | Debug recording state. |
| `shutdown_ack` | Before shutdown. |

## Transport parity

The mobile app uses Wi-Fi (Socket.IO) when available and BLE otherwise. The two paths mirror each
other: `get_session`/`clear_session`/`set_club`/`set_prefs` exist on both, shots arrive as `shot`
events or Shot-characteristic notifications, and `session_cleared` arrives as an event or a
Status-characteristic notification. When you add a command to one path, add it to the other.
