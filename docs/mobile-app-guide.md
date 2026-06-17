# Mobile App Guide

How to use the OpenFlight phone app: connect to your kiosk, read your shots, build your bag, and
review your numbers. For build and developer setup, see [mobile/README.md](../mobile/README.md).

## What the app does

The app is a companion to the OpenFlight kiosk on the range. It mirrors live shots from the kiosk,
keeps your own shot history on the phone, and lets you organize your clubs and review trends. Your
data stays on the device; the app encrypts it at rest.

## Connect to your kiosk

Open the **Connect** screen. You have two ways in.

### Wi-Fi

1. Put your phone and the kiosk on the same Wi-Fi network.
2. On the kiosk, note its IP address (shown on the kiosk, or check your router).
3. In the app, enter `that-ip:8080` and connect.

### Bluetooth (one-time pairing)

1. On the kiosk, open the pairing screen so it shows a QR code.
2. In the app, go to **Pair with Kiosk** and scan the QR code. The app stores a pairing key
   in your phone's secure storage.
3. From then on, open **Connect**, scan for the `OpenFlight` device, and tap to connect. Pairing is
   remembered, so you only scan the QR once.

When both Wi-Fi and Bluetooth are available, the app uses Wi-Fi.

### No kiosk? Try the demo

On the Connect screen, start the demo. The app generates realistic shots every few seconds so you
can explore the screens without hardware.

## The tabs

- **Live** - the current shot front and center: ball speed, carry, launch, spin, plus a 2D or 3D
  trajectory tracer. Set your active club here so shots are labeled correctly.
- **Analytics** - your numbers over time: average carry per club, dispersion (where your shots
  land), carry trend across sessions, and your shot-shape mix (draw/straight/fade).
- **History** - past sessions. Tap a session to see every shot in it.
- **Settings** - units, language, temperature, accessibility, and your bag.

## Build your bag

From **Settings → My Bag**:

- **Add a club:** pick a category (driver, wood, hybrid, iron, wedge, putter) and type, then add a
  brand and name if you like.
- **Reorder:** arrange clubs in the order you carry them.
- **Spare clubs:** move clubs you own but do not carry to the spares list; move them back any time.
- **Per-club detail:** tap a club to see its averages and recent shot history.

As you log shots, the app matches each shot's club to your bag and fills in averages and trends.

## Settings

- **Units:** choose speed (mph, km/h, or m/s) and distance (yards or meters); the whole app follows your choice.
- **Language:** pick your language.
- **Temperature:** set conditions used in distance estimates.
- **Accessibility:** reduce motion, high contrast, larger text, and a color-blind-safe palette.
  These also apply to the kiosk screen while you are connected.

## Privacy

- Your shot database is encrypted on the phone with a device-specific key. If the data file ever
  ends up on another phone, the app wipes it rather than expose it.
- If you save shot locations, each coordinate is encrypted with a separate key. Location data stays
  on your phone and is not sent to the kiosk.

## Troubleshooting

- **Can't find the kiosk over Bluetooth:** make sure Bluetooth and (on Android) location permission
  are enabled, and that the kiosk is powered on and nearby. The app scans for 15 seconds.
- **Connection drops:** the app retries a few times. If it gives up, reconnect from
  the Connect screen.
- **Shots not showing:** confirm the kiosk is detecting shots, and that you are connected (the app
  shows the active transport, Wi-Fi or BLE).
- **Wrong club on a shot:** set the active club on the Live tab before hitting.
