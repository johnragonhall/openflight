# Test Plan - Screen Reader (VoiceOver / TalkBack / desktop)

Verifies the screen-reader experience of the `/scoreboard` scoreboard and kiosk on
real assistive tech. The SR markup (live region, `role="img"` tiles, hidden
chart SVGs, headings, composed labels) renders correctly in unit tests, but
**only a real screen reader proves what is actually spoken, in what order, and
whether duplicate/over-verbose announcements happen.**

Code: [Scoreboard.tsx](../../ui/src/components/Scoreboard.tsx),
[ConfidenceDots.tsx](../../ui/src/components/ConfidenceDots.tsx),
[clubCharts.tsx](../../ui/src/components/charts/clubCharts.tsx),
[SpeedGauge.tsx](../../ui/src/components/SpeedGauge.tsx).

## What you need
Run on as many as available - behavior differs per engine:
- **tvOS VoiceOver** (Apple TV browser) and/or **Android TV TalkBack**.
- **macOS/iOS VoiceOver** in Safari, **NVDA**/**JAWS** in Windows Chrome/Firefox (desktop proxy).
- The display at `/scoreboard?tv=1`; use `--mock` + **Simulate Shot** to inject shots on demand.

## Test cases

### TC-SR-01 - One concise announcement per shot
**Steps:** With the SR running on `/scoreboard`, simulate a shot.
**PASS:** The SR speaks **one short sentence** - club + est. carry + ball speed (e.g. *"Driver: Est
Carry 245 yards, Ball Speed 167 mph"*) - **not** all ~10 metrics. It does not keep talking for many seconds.
**FAIL artifacts:** an **audio recording** of the announcement (essential - transcribe it); note if it
read the entire grid or ran long.

### TC-SR-02 - Duplicate shots still announce
**Steps:** Simulate **two shots that round to the same summary** (same club, same rounded carry + ball speed).
**PASS:** The second shot **still announces** (the zero-width toggle forces a fresh announcement);
the SR does not go silent on a real shot.
**FAIL artifacts:** audio of both announcements; confirm the second was spoken.

### TC-SR-03 - No competing live regions
**Steps:** Trigger a shot at the same time the connection/camera status changes (toggle camera while simulating).
**PASS:** The shot summary announces cleanly; the status row does **not** also announce and clobber it
(only one polite live region owns announcements).
**FAIL artifacts:** audio; note any cut-off or doubled announcement.

### TC-SR-04 - Metric tiles read as one stop each
**Steps:** With SR navigation (VO swipe / TalkBack swipe / NVDA browse arrows), move through the metric grid.
**PASS:** Each tile is **one stop** spoken as a coherent phrase - *"V. Launch: 13.4 degrees, Perfect"*,
*"Spin Rate: 2,450 RPM, Perfect"*, *"Club Path: no data"* for placeholders. The `°` is spoken
"degrees" (not "degree symbol"), and the label/value/unit/quality are **not** separate stops.
**FAIL artifacts:** audio walking the grid; flag any tile that is **skipped entirely** (silent) - that's
the `role="img"` not registering on this engine (**Major**) - or that reads in fragments.

### TC-SR-05 - Speed gauges
**Steps:** Navigate onto a Ball/Club Speed gauge.
**PASS:** Announced once as a meter, e.g. *"Ball Speed, 167.4 mph"* - no duplicate reading of the inner number.
**FAIL artifacts:** audio; note double-reads.

### TC-SR-06 - Charts are silent (decorative)
**Steps:** With the camera off (visualizer showing), SR-navigate the camera area.
**PASS:** The SVG charts are **not** announced (no "graphic", no stream of tick/ring numbers); the chart
**titles** ("Trajectory" / "Dispersion") may be read as text, but the data comes from the grid/summary.
**FAIL artifacts:** audio; flag if the SR dives into dozens of unlabeled numbers (**Major** noise).

### TC-SR-07 - Headings & landmarks
**Steps:** Use the SR's heading rotor / heading navigation.
**PASS:** A stable **"OpenFlight Display"** page heading (h1); the club title and **"Recent shots"** are
sub-headings (h2); levels don't skip. The page heading does **not** change on every shot.
**FAIL artifacts:** the heading list the SR reports.

### TC-SR-08 - Recent-shot chips
**Steps:** SR-navigate to the recent-shots strip.
**PASS:** Each chip is one stop - *"Shot 12: Driver, 167 mph"* - with **no** re-reading of the inner
number/club/stat spans.
**FAIL artifacts:** audio; note any per-fragment double-read.

### TC-SR-09 - Camera-live path
**Steps:** With the camera **streaming**, SR-navigate the camera area.
**PASS:** The live `<img>` is decorative (`alt=""`) and not announced as a meaningful image; the shot
summary remains the data path.
**FAIL artifacts:** audio.

### TC-SR-10 - Focus + announcement don't collide
**Steps:** While driving D-pad focus (TV), simulate shots so the live region fires during focus moves.
**PASS:** Focus changes and shot announcements coexist without the SR dropping focus context or
double-speaking.
**FAIL artifacts:** audio + recording; note any collision.

## Artifacts to attach
**Audio recordings are mandatory** for SR findings (a transcription of what was spoken, in order),
plus the SR + engine + browser identity (e.g. "tvOS 17 VoiceOver", "NVDA 2024.1 / Chrome 120").
