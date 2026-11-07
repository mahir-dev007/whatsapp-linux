#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$APP_DIR/dist"
BUILD_DIR="$DIST_DIR/deb-build"
DEB_NAME="whatsapp-linux_1.1.0_amd64.deb"
OUTPUT_DEB="$DIST_DIR/$DEB_NAME"

echo "=========================================="
echo " Building WhatsApp Linux Debian (.deb) Package"
echo "=========================================="

# 1. Clean build directory
rm -rf "$BUILD_DIR"
rm -f "$OUTPUT_DEB"
mkdir -p "$DIST_DIR"

# 2. Check for electron distribution files
ELECTRON_DIST="$APP_DIR/node_modules/electron/dist"
if [ ! -d "$ELECTRON_DIST" ]; then
  echo "Error: Electron distribution not found at $ELECTRON_DIST."
  echo "Please run 'npm install' first."
  exit 1
fi

# 3. Create deb directory structure
mkdir -p "$BUILD_DIR/DEBIAN"
mkdir -p "$BUILD_DIR/opt/whatsapp-linux"
mkdir -p "$BUILD_DIR/usr/bin"
mkdir -p "$BUILD_DIR/usr/share/applications"

for size in 16 24 32 48 64 128 256 512; do
  mkdir -p "$BUILD_DIR/usr/share/icons/hicolor/${size}x${size}/apps"
done
mkdir -p "$BUILD_DIR/usr/share/icons/hicolor/scalable/apps"

# 4. Copy Electron runtime to /opt/whatsapp-linux
echo "Packaging Electron runtime..."
cp -a "$ELECTRON_DIST"/* "$BUILD_DIR/opt/whatsapp-linux/"
mv "$BUILD_DIR/opt/whatsapp-linux/electron" "$BUILD_DIR/opt/whatsapp-linux/whatsapp-linux"
rm -f "$BUILD_DIR/opt/whatsapp-linux/resources/default_app.asar"

# 5. Copy application source files to /opt/whatsapp-linux/resources/app
echo "Packaging application files..."
APP_DEST="$BUILD_DIR/opt/whatsapp-linux/resources/app"
mkdir -p "$APP_DEST"
cp -r "$APP_DIR/src" "$APP_DEST/"
cp -r "$APP_DIR/assets" "$APP_DEST/"

# Copy production package.json (without devDependencies)
cat > "$APP_DEST/package.json" << 'EOF'
{
  "name": "whatsapp-linux",
  "version": "1.1.0",
  "description": "Native WhatsApp desktop client for Linux with voice and video calling support",
  "main": "src/main.js"
}
EOF

# 6. Create /usr/bin launcher script
cat > "$BUILD_DIR/usr/bin/whatsapp-linux" << 'EOF'
#!/usr/bin/env bash
unset ELECTRON_RUN_AS_NODE
export FONTCONFIG_PATH="${FONTCONFIG_PATH:-/etc/fonts}"

exec /opt/whatsapp-linux/whatsapp-linux --no-sandbox --ozone-platform=x11 --disable-features=Vulkan "$@"
EOF
chmod +x "$BUILD_DIR/usr/bin/whatsapp-linux"

# 7. Create .desktop file in /usr/share/applications
cat > "$BUILD_DIR/usr/share/applications/whatsapp-linux.desktop" << 'EOF'
[Desktop Entry]
Name=WhatsApp
GenericName=WhatsApp Desktop Client
Comment=WhatsApp desktop client for Linux with voice and video calling
Exec=/usr/bin/whatsapp-linux %U
Icon=whatsapp-linux
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
Exec=/usr/bin/whatsapp-linux --new-chat
EOF
chmod 644 "$BUILD_DIR/usr/share/applications/whatsapp-linux.desktop"

# 8. Copy application icons
for size in 16 24 32 48 64 128 256 512; do
  if [ -f "$APP_DIR/assets/icon-${size}.png" ]; then
    cp "$APP_DIR/assets/icon-${size}.png" "$BUILD_DIR/usr/share/icons/hicolor/${size}x${size}/apps/whatsapp-linux.png"
    chmod 644 "$BUILD_DIR/usr/share/icons/hicolor/${size}x${size}/apps/whatsapp-linux.png"
  fi
done
cp "$APP_DIR/assets/icon.svg" "$BUILD_DIR/usr/share/icons/hicolor/scalable/apps/whatsapp-linux.svg"
chmod 644 "$BUILD_DIR/usr/share/icons/hicolor/scalable/apps/whatsapp-linux.svg"

# 9. Calculate installed size in KB
INSTALLED_SIZE=$(du -sk "$BUILD_DIR" | cut -f1)

# 10. Generate DEBIAN/control file
cat > "$BUILD_DIR/DEBIAN/control" << EOF
Package: whatsapp-linux
Version: 1.1.0
Section: net
Priority: optional
Architecture: amd64
Installed-Size: $INSTALLED_SIZE
Maintainer: Mahir <mahir@users.noreply.github.com>
Homepage: https://github.com/mahir-dev007/whatsapp-linux
Description: Native WhatsApp desktop client for Linux with calling features
 A feature-complete desktop client for WhatsApp on Linux with full voice
 and video calling support, background system tray, unread message badges,
 screen sharing, and native desktop notifications.
EOF
chmod 644 "$BUILD_DIR/DEBIAN/control"

# 11. Generate DEBIAN/postinst
cat > "$BUILD_DIR/DEBIAN/postinst" << 'EOF'
#!/bin/sh
set -e

# Fix chrome-sandbox permissions if needed
chmod 4755 /opt/whatsapp-linux/chrome-sandbox 2>/dev/null || true

# Update desktop and icon databases
if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database -q /usr/share/applications 2>/dev/null || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t -q /usr/share/icons/hicolor 2>/dev/null || true
fi

if command -v xdg-mime >/dev/null 2>&1; then
    xdg-mime default whatsapp-linux.desktop x-scheme-handler/whatsapp 2>/dev/null || true
fi

exit 0
EOF
chmod 755 "$BUILD_DIR/DEBIAN/postinst"

# 12. Generate DEBIAN/postrm
cat > "$BUILD_DIR/DEBIAN/postrm" << 'EOF'
#!/bin/sh
set -e

if command -v update-desktop-database >/dev/null 2>&1; then
    update-desktop-database -q /usr/share/applications 2>/dev/null || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
    gtk-update-icon-cache -f -t -q /usr/share/icons/hicolor 2>/dev/null || true
fi

exit 0
EOF
chmod 755 "$BUILD_DIR/DEBIAN/postrm"

# 13. Build .deb package using dpkg-deb
echo "Assembling Debian package with dpkg-deb..."
dpkg-deb --build --root-owner-group "$BUILD_DIR" "$OUTPUT_DEB"

# Clean up temp build dir
rm -rf "$BUILD_DIR"

echo ""
echo "=========================================="
echo " Debian Package Built Successfully!"
echo " Location: $OUTPUT_DEB"
echo " Size: $(du -h "$OUTPUT_DEB" | cut -f1)"
echo "=========================================="
echo ""
echo "To install on your system:"
echo "  sudo dpkg -i \"$OUTPUT_DEB\""
echo "Or right-click the .deb file in your file manager and select 'Open With Software Install'."

