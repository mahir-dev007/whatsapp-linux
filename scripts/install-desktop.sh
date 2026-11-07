#!/usr/bin/env bash
set -e

# Resolve paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN_DIR="$HOME/.local/bin"
APPS_DIR="$HOME/.local/share/applications"
ICONS_DIR="$HOME/.local/share/icons/hicolor"

echo "=== Installing WhatsApp Linux Desktop Client ==="
echo "Application Directory: $APP_DIR"

# 1. Ensure target directories exist
mkdir -p "$BIN_DIR"
mkdir -p "$APPS_DIR"
for size in 16 24 32 48 64 128 256 512; do
  mkdir -p "$ICONS_DIR/${size}x${size}/apps"
done
mkdir -p "$ICONS_DIR/scalable/apps"

# 2. Generate/ensure icons exist
if [ ! -f "$APP_DIR/assets/icon-512.png" ]; then
  echo "Generating application icons..."
  python3 "$APP_DIR/scripts/generate-icons.py"
fi

# 3. Copy icons to standard desktop icon theme directories
echo "Installing application icons..."
for size in 16 24 32 48 64 128 256 512; do
  if [ -f "$APP_DIR/assets/icon-${size}.png" ]; then
    cp "$APP_DIR/assets/icon-${size}.png" "$ICONS_DIR/${size}x${size}/apps/whatsapp-linux.png"
  fi
done
cp "$APP_DIR/assets/icon.svg" "$ICONS_DIR/scalable/apps/whatsapp-linux.svg"

# 4. Create launcher script in ~/.local/bin
LAUNCHER_PATH="$BIN_DIR/whatsapp-linux"
echo "Creating launcher executable: $LAUNCHER_PATH"
cat > "$LAUNCHER_PATH" << EOF
#!/usr/bin/env bash
unset ELECTRON_RUN_AS_NODE
export PATH="\$HOME/.local/bin:\$PATH"
export FONTCONFIG_PATH="\${FONTCONFIG_PATH:-/etc/fonts}"

APP_DIR="$APP_DIR"
ELECTRON_BIN="\$APP_DIR/node_modules/electron/dist/electron"

if [ ! -x "\$ELECTRON_BIN" ]; then
  ELECTRON_BIN="\$APP_DIR/node_modules/.bin/electron"
fi

exec "\$ELECTRON_BIN" --no-sandbox --ozone-platform=x11 --disable-features=Vulkan "\$APP_DIR" "\$@"
EOF
chmod +x "$LAUNCHER_PATH"

# 5. Create .desktop entry
DESKTOP_FILE="$APPS_DIR/whatsapp-linux.desktop"
echo "Creating desktop entry: $DESKTOP_FILE"
cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Name=WhatsApp
GenericName=WhatsApp Desktop Client
Comment=WhatsApp desktop client for Linux with voice and video calling
Exec=$LAUNCHER_PATH %U
Icon=whatsapp-linux
Path=$APP_DIR
Terminal=false
Type=Application
StartupNotify=true
StartupWMClass=whatsapp-linux
Categories=Network;InstantMessaging;Chat;Telephony;VideoConference;AudioVideo;
MimeType=x-scheme-handler/whatsapp;
Keywords=WhatsApp;Chat;Message;Call;Voice;Video;Telephony;WebRTC;

Actions=NewChat;

[Desktop Action NewChat]
Name=New Chat
Exec=$LAUNCHER_PATH --new-chat
EOF
chmod +x "$DESKTOP_FILE"

# 6. Update system desktop and MIME database caches
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APPS_DIR" 2>/dev/null || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t "$ICONS_DIR" 2>/dev/null || true
fi

if command -v xdg-mime >/dev/null 2>&1; then
  xdg-mime default whatsapp-linux.desktop x-scheme-handler/whatsapp 2>/dev/null || true
fi

echo ""
echo "=== Installation Successful! ==="
echo "You can now launch WhatsApp Linux by:"
echo " 1. Searching for 'WhatsApp' in your GNOME / Ubuntu applications menu"
echo " 2. Running 'whatsapp-linux' from any terminal"
echo " 3. Running 'npm start' from $APP_DIR"
