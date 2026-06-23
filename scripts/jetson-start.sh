#!/usr/bin/env bash
# Start OpenFlight on Jetson Nano.
# Usage:
#   bash scripts/jetson-start.sh            # real radar + BLE
#   bash scripts/jetson-start.sh --mock     # mock mode (no radar)
#   bash scripts/jetson-start.sh --no-ble   # disable BLE
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

MOCK=""
BLE="--ble"

for arg in "$@"; do
    case $arg in
        --mock)   MOCK="--mock" ;;
        --no-ble) BLE="" ;;
    esac
done

echo "=================================================="
echo "  OpenFlight — Jetson Nano"
echo "  Mock: ${MOCK:-no}  BLE: ${BLE:+yes}"
echo "=================================================="

# Bring up BT adapter if BLE requested
if [[ -n "$BLE" ]]; then
    if ! hciconfig hci0 2>/dev/null | grep -q "UP RUNNING"; then
        echo "Bringing up Bluetooth adapter..."
        sudo hciconfig hci0 up || {
            echo "WARNING: could not bring up hci0 — starting without BLE"
            BLE=""
        }
    fi
fi

export PATH="$HOME/.local/bin:$PATH"

exec uv run python -m openflight.server $MOCK $BLE
