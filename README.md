# WhatsApp Desktop Client for Linux (with Voice & Video Calling)

A native, feature-complete WhatsApp desktop client engineered specifically for **Linux** (Ubuntu, Debian, Fedora, Arch, etc.) with **full voice and video calling support**, background system tray integration, unread badge counters, and native desktop notifications.

---

## Key Features

- **WhatsApp Calling (Voice & Video)**:
  - Supports 1-on-1 and group voice & video calls.
  - Automatically manages WebRTC media permissions for microphone, webcam, and speakers.
  - Screen sharing support during calls via PipeWire / Wayland / X11.
  - Ringing alerts with taskbar flashing and desktop notifications.
  - Configured with modern Desktop Chrome User-Agent so WhatsApp Web exposes all calling buttons and the Calls tab.
- **Linux System Tray & Close-to-Tray**:
  - Operates in the background in your system tray so you never miss an incoming call or message.
  - Closing the window (`[X]`) hides to the tray instead of quitting.
  - Unread message counter badge on tray icon (`(3)` unread messages indicator).
  - Tray context menu: Show/Hide, New Chat, Mute Notifications, Reload, Toggle Dark Theme, Quit.
- **Desktop Integration**:
  - Full desktop entry (`.desktop`) with high-resolution vector and PNG icons (16px to 512px).
  - Searchable in GNOME Dash / Ubuntu Activities / Application Launcher.
  - `whatsapp-linux` command available globally in your terminal.
  - Click-to-focus on incoming notifications.
  - Persistent login session (scan QR code once; session is remembered permanently).
- **Smooth Graphics & Wayland/X11 Compatibility**:
  - Robust graphics handling with XWayland/X11 fallback for Intel HD Graphics, AMD, and Nvidia GPUs.
  - Zoom controls and keyboard shortcuts.

---

## Quick Start

### 1. Launch from Desktop Applications Menu
Press the `Super` (Windows) key and search for **WhatsApp**, then click the WhatsApp icon.

### 2. Launch from Terminal
```bash
whatsapp-linux
```

Or from the project directory:
```bash
npm start
```

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + N` | Open New Chat dialog |
| `Ctrl + F` | Search chats and contacts |
| `Ctrl + Shift + P` | **Privacy Screen**: Blurs messages, names & media until hovered |
| `Ctrl + Shift + D` | **OLED Pure Black**: Ultra-dark theme for battery saving |
| `Ctrl + Shift + T` | **Always On Top**: Float window for calls & multitasking |
| `Ctrl + Shift + C` | **Compact Mode**: Fits more conversations on screen |
| `Ctrl + R` / `F5` | Reload WhatsApp |
| `Ctrl + Shift + R` | Hard reload (clears web cache) |
| `Ctrl + =` / `Ctrl + +` | Zoom In |
| `Ctrl + -` | Zoom Out |
| `Ctrl + 0` | Reset Zoom to 100% |
| `Ctrl + W` | Hide to System Tray |
| `Ctrl + Q` | Quit WhatsApp completely |
| `Ctrl + /` | Open Keyboard Shortcuts Guide |

---

## Safe & Useful Built-In Features

- **Privacy Screen (`Ctrl + Shift + P`)**:
  Protects your privacy in public or shared spaces by blurring message bubbles, contact names, and images until you hover your mouse over them.
- **True OLED Pure Black Theme (`Ctrl + Shift + D`)**:
  Custom true `#000000` dark styling that saves laptop battery life and looks great on modern displays.
- **Always On Top (`Ctrl + Shift + T`)**:
  Keep WhatsApp pinned above other windows while taking notes, working, or participating in video calls.
- **Compact Chat List (`Ctrl + Shift + C`)**:
  Reduces sidebar padding to display more conversations simultaneously.
- **Calling Hardware Diagnostics**:
  Select *Check Calling Devices (Mic/Cam)...* from the system tray menu to inspect all connected microphones, webcams, and speakers.
- **Cache Cleaner**:
  Select *Clear Cache & Reload* to resolve transient web glitches without losing your login session.
- **Auto-Start on Login**:
  Toggle *Start at System Login* directly from the tray menu.

---

## How Voice & Video Calling Works

1. **WebRTC & Permissions**:
   The app automatically authorizes microphone (`navigator.mediaDevices.getUserMedia`) and webcam permissions for `web.whatsapp.com`.
2. **Audio/Video Routing**:
   Audio streams are seamlessly handled by Linux's PipeWire / PulseAudio subsystems, allowing you to select your preferred headset, microphone, or Bluetooth audio device directly in WhatsApp's call settings.
3. **Screen Sharing**:
   During active video calls, click the screen share button to share your screen or individual application windows via the desktop portal.

---

## Installation & Packaging

### Method 1: Install Debian (.deb) Package (Recommended)
You can build and install the native Debian package:
```bash
# Build the .deb installer (outputs to dist/whatsapp-linux_1.0.0_amd64.deb)
npm run build:deb

# Install system-wide
sudo dpkg -i dist/whatsapp-linux_1.0.0_amd64.deb
```
Or right-click `dist/whatsapp-linux_1.0.0_amd64.deb` in your file manager and choose **Open With Software Install**.

### Method 2: Local User Desktop Integration (Without Sudo)
```bash
bash scripts/install-desktop.sh
```
*(Installs `.desktop` launcher to `~/.local/share/applications/`, icons to `~/.local/share/icons/hicolor/`, and binary to `~/.local/bin/whatsapp-linux`)*

- **Uninstall Desktop Integration**:
  ```bash
  bash scripts/uninstall-desktop.sh
  ```

---

## Project Structure

```
├── assets/
│   ├── icon.svg                     # Vector application icon
│   ├── icon.png                     # Master 512x512 icon
│   ├── icon-*.png                   # Sized icons (16, 24, 32, 48, 64, 128, 256, 512)
│   ├── tray-icon.png                # System tray icon (normal)
│   └── tray-icon-unread.png         # System tray icon with red unread notification badge
├── src/
│   ├── main.js                      # Electron main process (window, tray, WebRTC permissions)
│   └── preload.js                   # Preload script (unread watcher, call detector, notifications)
├── scripts/
│   ├── generate-icons.py            # Python script to generate high-resolution PNG & SVG icons
│   ├── install-desktop.sh           # Linux desktop menu & icon installer
│   └── uninstall-desktop.sh         # Uninstallation script
├── package.json                     # NPM configuration and dependencies
└── README.md                        # Documentation
```

