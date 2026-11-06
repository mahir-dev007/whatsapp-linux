#!/usr/bin/env bash
set -e

BIN_DIR="$HOME/.local/bin"
APPS_DIR="$HOME/.local/share/applications"
ICONS_DIR="$HOME/.local/share/icons/hicolor"

echo "=== Uninstalling WhatsApp Linux Desktop Integration ==="

rm -f "$BIN_DIR/whatsapp-linux"
rm -f "$APPS_DIR/whatsapp-linux.desktop"

for size in 16 24 32 48 64 128 256 512; do
  rm -f "$ICONS_DIR/${size}x${size}/apps/whatsapp-linux.png" 2>/dev/null || true
done
rm -f "$ICONS_DIR/scalable/apps/whatsapp-linux.svg" 2>/dev/null || true

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APPS_DIR" 2>/dev/null || true
fi

echo "WhatsApp Linux desktop integration removed."

