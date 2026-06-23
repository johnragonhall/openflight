#!/usr/bin/env bash
# One-time setup for OpenFlight on Jetson Nano (Ubuntu/JetPack).
# Run once after extracting the zip: bash scripts/jetson-setup.sh
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

echo "=================================================="
echo "  OpenFlight — Jetson Nano Setup"
echo "=================================================="

# --- Internet check + hotspot prompt ---
echo "[0/4] Checking internet connection..."
if ! curl -s --max-time 5 https://pypi.org > /dev/null 2>&1 && \
   ! wget -q --spider --timeout=5 https://pypi.org 2>/dev/null; then
    echo ""
    echo "  No internet detected."
    echo "  This setup needs to download Python packages (~150 MB)."
    echo ""
    echo "  --> Enable your phone hotspot now, connect this Jetson to it,"
    echo "      then press ENTER to continue."
    echo "      (You can disconnect after setup — packages cache locally.)"
    echo ""
    read -r -p "  Press ENTER when connected (or Ctrl-C to cancel)... "
    echo ""
    # Recheck
    if ! curl -s --max-time 8 https://pypi.org > /dev/null 2>&1 && \
       ! wget -q --spider --timeout=8 https://pypi.org 2>/dev/null; then
        echo "  Still no internet. Check hotspot connection and re-run."
        exit 1
    fi
    echo "  Connected."
fi

# --- System packages ---
echo "[1/4] Checking system packages..."
sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends \
    bluetooth bluez \
    curl \
    python3-pip python3-dev \
    libglib2.0-dev \
    libdbus-1-dev \
    python3-dbus 2>/dev/null || true

sudo systemctl enable bluetooth
sudo systemctl start bluetooth

# --- uv ---
echo "[2/4] Installing uv (Python package manager)..."
if ! command -v uv &>/dev/null; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
fi
echo "  uv $(uv --version)"

# --- Python deps ---
echo "[3/4] Installing Python dependencies..."
# Use uv pip install (fresh platform resolution) not uv sync (replays Windows lock file).
# The lock file pins versions without ARM64 wheels, causing source compilation failures.
uv venv --python 3.11 --system-certs
uv pip install -e ".[ui,analysis,ble]" --system-certs

if uv run python -c "import bless" 2>/dev/null; then
    echo "  bless: OK"
else
    echo "  WARNING: bless import failed — BLE will not be available"
fi

# --- Bluetooth adapter check ---
echo "[4/4] Checking Bluetooth adapter..."
if hciconfig hci0 2>/dev/null | grep -q "UP RUNNING"; then
    echo "  hci0: UP and RUNNING"
elif hciconfig hci0 2>/dev/null; then
    echo "  hci0: found but not running — bringing up..."
    sudo hciconfig hci0 up
else
    echo "  WARNING: no Bluetooth adapter found (hci0 missing)"
    echo "  Connect a USB Bluetooth dongle and re-run this script."
fi

echo ""
echo "  You can disconnect your hotspot now."
echo ""
echo "Setup complete. Start the server with:"
echo "  bash scripts/jetson-start.sh --mock --ble"
