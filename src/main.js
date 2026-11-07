/**
 * WhatsApp Desktop Client for Linux
 * 
 * Features:
 * - Full WhatsApp Voice & Video Calling support (WebRTC permissions & audio/video routing)
 * - Linux System Tray integration with unread message badge count
 * - Background operation (Close to Tray) so calls & messages are never missed
 * - Native desktop notifications with click-to-focus
 * - Wayland & X11 display server support with PipeWire screen sharing
 * - Persistent session storage (scan QR code once)
 * - Custom shortcuts & external link handling
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, shell, session, Notification, nativeImage, desktopCapturer, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Clean up any conflicting environment variable
delete process.env.ELECTRON_RUN_AS_NODE;

// 1. Optimize Chromium flags for Linux WebRTC calling, audio playback, and graphics stability
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('enable-features', 'WebRTCPipeWireCapturer');
app.commandLine.appendSwitch('disable-features', 'Vulkan,HardwareMediaKeyHandling');

// Default to X11 ozone platform to ensure seamless compatibility across Wayland & Intel/AMD/Nvidia drivers
if (process.platform === 'linux' && !process.argv.some(arg => arg.startsWith('--ozone-platform='))) {
  app.commandLine.appendSwitch('ozone-platform', 'x11');
}

// Ensure persistent user data directory in ~/.config/whatsapp-linux
const userDataDir = path.join(app.getPath('appData'), 'whatsapp-linux');
app.setPath('userData', userDataDir);

// Modern Google Chrome Desktop user agent required by WhatsApp Web for voice & video calling
const CHROME_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Global variables
let mainWindow = null;
let tray = null;
let isQuitting = false;
let unreadCount = 0;
let isMuted = false;

// Paths to assets
const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const APP_ICON_PNG = path.join(ASSETS_DIR, 'icon-512.png');
const TRAY_ICON_NORMAL = path.join(ASSETS_DIR, 'tray-icon.png');
const TRAY_ICON_UNREAD = path.join(ASSETS_DIR, 'tray-icon-unread.png');

// Window state storage
const CONFIG_FILE = path.join(userDataDir, 'window-state.json');
const AUTOSTART_FILE = path.join(app.getPath('home'), '.config', 'autostart', 'whatsapp-linux.desktop');
const SETTINGS_FILE = path.join(userDataDir, 'app-settings.json');

// Persistent settings
let appSettings = loadSettings();

function loadSettings() {
  const defaultSettings = {
    privacyMode: false,
    oledMode: false,
    compactMode: false,
    alwaysOnTop: false,
    isMuted: false
  };
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return Object.assign(defaultSettings, JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')));
    }
  } catch (e) {
    console.error('Error loading settings:', e);
  }
  return defaultSettings;
}

function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(appSettings, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving settings:', e);
  }
}

function togglePrivacyMode() {
  appSettings.privacyMode = !appSettings.privacyMode;
  saveSettings();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('set-privacy-mode', appSettings.privacyMode);
  }
  updateTrayMenu();
}

function toggleOledMode() {
  appSettings.oledMode = !appSettings.oledMode;
  saveSettings();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('set-oled-mode', appSettings.oledMode);
  }
  updateTrayMenu();
}

function toggleCompactMode() {
  appSettings.compactMode = !appSettings.compactMode;
  saveSettings();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('set-compact-mode', appSettings.compactMode);
  }
  updateTrayMenu();
}

function toggleAlwaysOnTop() {
  appSettings.alwaysOnTop = !appSettings.alwaysOnTop;
  saveSettings();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(appSettings.alwaysOnTop);
  }
  updateTrayMenu();
}

function showShortcutsDialog() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Keyboard Shortcuts Guide',
    message: 'WhatsApp Linux Desktop Shortcuts',
    detail: [
      '• Ctrl + N : Start a new chat',
      '• Ctrl + F : Search chats & contacts',
      '• Ctrl + Shift + P : Toggle Privacy Screen (blur messages until hovered)',
      '• Ctrl + Shift + D : Toggle OLED Pure Black Dark Theme',
      '• Ctrl + Shift + T : Toggle Always On Top (floating window for calls)',
      '• Ctrl + Shift + C : Toggle Compact Chat List (fits more chats)',
      '• Ctrl + R / F5 : Reload application',
      '• Ctrl + Shift + R : Hard reload (clears web cache)',
      '• Ctrl + = / + : Zoom In',
      '• Ctrl + - : Zoom Out',
      '• Ctrl + 0 : Reset Zoom to 100%',
      '• Ctrl + W : Minimize to System Tray',
      '• Ctrl + Q : Quit application completely',
      '• Ctrl + / : Open this shortcuts guide'
    ].join('\n'),
    buttons: ['OK']
  });
}

function isAutostartEnabled() {
  return fs.existsSync(AUTOSTART_FILE);
}

function setAutostart(enable) {
  try {
    const autostartDir = path.dirname(AUTOSTART_FILE);
    if (enable) {
      if (!fs.existsSync(autostartDir)) {
        fs.mkdirSync(autostartDir, { recursive: true });
      }
      const launcherPath = path.join(app.getPath('home'), '.local', 'bin', 'whatsapp-linux');
      const content = `[Desktop Entry]
Type=Application
Name=WhatsApp
Comment=WhatsApp desktop client for Linux with voice and video calling
Exec=${launcherPath} --minimized
Icon=whatsapp-linux
Terminal=false
StartupNotify=false
Categories=Network;InstantMessaging;
`;
      fs.writeFileSync(AUTOSTART_FILE, content, 'utf8');
    } else {
      if (fs.existsSync(AUTOSTART_FILE)) {
        fs.unlinkSync(AUTOSTART_FILE);
      }
    }
  } catch (err) {
    console.error('Error toggling autostart:', err);
  }
}

function loadWindowState() {
  const defaultState = { width: 1100, height: 780, x: undefined, y: undefined, isMaximized: false };
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return Object.assign(defaultState, JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')));
    }
  } catch (e) {
    console.error('Error loading window state:', e);
  }
  return defaultState;
}

function saveWindowState() {
  if (!mainWindow) return;
  try {
    const isMaximized = mainWindow.isMaximized();
    const bounds = mainWindow.getBounds();
    const state = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving window state:', e);
  }
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('Another instance of WhatsApp Linux is already running. Focusing existing instance.');
  app.quit();
  process.exit(0);
}

app.on('second-instance', (event, commandLine) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }
});

// Configure WebRTC and Media Permissions for WhatsApp Calling
function setupPermissions() {
  const customSession = session.defaultSession;

  // Auto-grant media (camera/mic) and notification permissions for WhatsApp
  customSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const allowedPermissions = [
      'media',
      'notifications',
      'display-capture',
      'mediaKeySystem',
      'pointerLock',
      'fullscreen',
      'clipboard-sanitized-write',
      'clipboard-read'
    ];

    const requestingOrigin = details.requestingUrl || '';
    if (requestingOrigin.includes('web.whatsapp.com') || requestingOrigin.includes('whatsapp.com')) {
      if (allowedPermissions.includes(permission)) {
        return callback(true);
      }
    }
    
    // Default allow for media if initiated from WhatsApp window
    if (permission === 'media' || permission === 'notifications') {
      return callback(true);
    }

    callback(false);
  });

  customSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    if (requestingOrigin.includes('web.whatsapp.com') || requestingOrigin.includes('whatsapp.com')) {
      return true;
    }
    return permission === 'media' || permission === 'notifications';
  });

  // Handle screen sharing request (WebRTC getDisplayMedia)
  if (customSession.setDisplayMediaRequestHandler) {
    customSession.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
        if (sources.length > 0) {
          // Grant screen sharing with the primary display/window
          callback({ video: sources[0] });
        } else {
          callback(null);
        }
      }).catch((err) => {
        console.error('Screen capture error:', err);
        callback(null);
      });
    });
  }

  // Set device permission handler for audio/video selection
  if (customSession.setDevicePermissionHandler) {
    customSession.setDevicePermissionHandler(() => true);
  }
}

function createMainWindow() {
  const windowState = loadWindowState();

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 800,
    minHeight: 500,
    title: 'WhatsApp',
    icon: APP_ICON_PNG,
    alwaysOnTop: appSettings.alwaysOnTop,
    autoHideMenuBar: true,
    show: false, // Show once ready-to-show
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: true
    }
  });

  if (windowState.isMaximized) {
    mainWindow.maximize();
  }

  // Set desktop Chrome user agent so WhatsApp enables voice/video calls
  mainWindow.webContents.setUserAgent(CHROME_USER_AGENT);

  // Load WhatsApp Web
  mainWindow.loadURL('https://web.whatsapp.com', {
    userAgent: CHROME_USER_AGENT
  });

  const startHidden = process.argv.includes('--minimized') || process.argv.includes('--hidden');

  const showWindow = () => {
    if (!startHidden && mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  };

  mainWindow.once('ready-to-show', showWindow);
  
  // Guaranteed visibility fallback in case network delays ready-to-show
  setTimeout(showWindow, 1200);

  // Right-click context menu (Cut, Copy, Paste, Link options, Image options)
  mainWindow.webContents.on('context-menu', (event, params) => {
    const menuTemplate = [];

    if (params.linkURL) {
      menuTemplate.push(
        {
          label: 'Open Link in Browser',
          click: () => shell.openExternal(params.linkURL)
        },
        {
          label: 'Copy Link Address',
          click: () => {
            const { clipboard } = require('electron');
            clipboard.writeText(params.linkURL);
          }
        },
        { type: 'separator' }
      );
    }

    if (params.hasImageContents) {
      menuTemplate.push(
        {
          label: 'Copy Image',
          click: () => mainWindow.webContents.copyImageAt(params.x, params.y)
        },
        { type: 'separator' }
      );
    }

    if (params.isEditable) {
      menuTemplate.push(
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      );
    } else if (params.selectionText && params.selectionText.trim().length > 0) {
      menuTemplate.push(
        { role: 'copy' },
        { role: 'selectAll' }
      );
    }

    if (menuTemplate.length > 0) {
      const contextMenu = Menu.buildFromTemplate(menuTemplate);
      contextMenu.popup({ window: mainWindow, x: params.x, y: params.y });
    }
  });

  // Intercept window close to minimize to tray instead of quitting
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      saveWindowState();
      mainWindow.hide();
      
      // Notify user on first minimize to tray if supported
      showTrayNotificationOnce();
    } else {
      saveWindowState();
    }
  });

  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);

  // Intercept external links and open them in the user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith('https://web.whatsapp.com')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('https://web.whatsapp.com') && !url.startsWith('https://whatsapp.com')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Handle zoom and custom keyboard shortcuts
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && !input.alt && !input.meta) {
      if (input.shift) {
        if (input.key.toLowerCase() === 'p') {
          togglePrivacyMode();
          event.preventDefault();
        } else if (input.key.toLowerCase() === 'd') {
          toggleOledMode();
          event.preventDefault();
        } else if (input.key.toLowerCase() === 't') {
          toggleAlwaysOnTop();
          event.preventDefault();
        } else if (input.key.toLowerCase() === 'c') {
          toggleCompactMode();
          event.preventDefault();
        } else if (input.key.toLowerCase() === 'r') {
          mainWindow.webContents.reloadIgnoringCache();
          event.preventDefault();
        }
      } else {
        if (input.key === '/' || input.key === '?') {
          showShortcutsDialog();
          event.preventDefault();
        } else if (input.key === '=' || input.key === '+') {
          const currentZoom = mainWindow.webContents.getZoomFactor();
          mainWindow.webContents.setZoomFactor(Math.min(currentZoom + 0.1, 2.0));
          event.preventDefault();
        } else if (input.key === '-') {
          const currentZoom = mainWindow.webContents.getZoomFactor();
          mainWindow.webContents.setZoomFactor(Math.max(currentZoom - 0.1, 0.6));
          event.preventDefault();
        } else if (input.key === '0') {
          mainWindow.webContents.setZoomFactor(1.0);
          event.preventDefault();
        } else if (input.key.toLowerCase() === 'r') {
          mainWindow.reload();
          event.preventDefault();
        } else if (input.key.toLowerCase() === 'n') {
          mainWindow.webContents.send('action-new-chat');
          event.preventDefault();
        } else if (input.key.toLowerCase() === 'f') {
          mainWindow.webContents.send('action-search-chat');
          event.preventDefault();
        } else if (input.key.toLowerCase() === 'w') {
          mainWindow.hide();
          event.preventDefault();
        } else if (input.key.toLowerCase() === 'q') {
          quitApplication();
          event.preventDefault();
        }
      }
    }
  });
}

let hasShownTrayTip = false;
function showTrayNotificationOnce() {
  if (hasShownTrayTip) return;
  hasShownTrayTip = true;
  if (Notification.isSupported()) {
    const notification = new Notification({
      title: 'WhatsApp Linux',
      body: 'WhatsApp is still active in the system tray to receive calls and messages.',
      icon: APP_ICON_PNG,
      silent: true
    });
    notification.show();
  }
}

function updateTrayMenu() {
  if (!tray) return;

  const isVisible = mainWindow && mainWindow.isVisible();
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'WhatsApp Linux',
      enabled: false,
      icon: nativeImage.createFromPath(path.join(ASSETS_DIR, 'icon-16.png'))
    },
    { type: 'separator' },
    {
      label: isVisible ? 'Hide WhatsApp' : 'Open WhatsApp',
      click: () => {
        if (isVisible) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'New Chat (Ctrl+N)',
      click: () => {
        if (!mainWindow.isVisible()) mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('action-new-chat');
      }
    },
    {
      label: 'Privacy Mode (Ctrl+Shift+P)',
      type: 'checkbox',
      checked: appSettings.privacyMode,
      click: () => togglePrivacyMode()
    },
    {
      label: 'OLED Pure Black Theme (Ctrl+Shift+D)',
      type: 'checkbox',
      checked: appSettings.oledMode,
      click: () => toggleOledMode()
    },
    {
      label: 'Compact Chat List (Ctrl+Shift+C)',
      type: 'checkbox',
      checked: appSettings.compactMode,
      click: () => toggleCompactMode()
    },
    {
      label: 'Always On Top (Ctrl+Shift+T)',
      type: 'checkbox',
      checked: appSettings.alwaysOnTop,
      click: () => toggleAlwaysOnTop()
    },
    {
      label: isMuted ? 'Unmute Notifications' : 'Mute Notifications',
      type: 'checkbox',
      checked: isMuted,
      click: () => {
        isMuted = !isMuted;
        updateTrayMenu();
      }
    },
    { type: 'separator' },
    {
      label: 'Check Calling Devices (Mic/Cam)...',
      click: () => {
        if (!mainWindow.isVisible()) mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('action-check-devices');
      }
    },
    {
      label: 'Clear Cache & Reload',
      click: () => {
        session.defaultSession.clearCache().then(() => {
          if (mainWindow) mainWindow.reload();
        });
      }
    },
    {
      label: 'Keyboard Shortcuts Guide (Ctrl+/)',
      click: () => showShortcutsDialog()
    },
    { type: 'separator' },
    {
      label: 'Start at System Login',
      type: 'checkbox',
      checked: isAutostartEnabled(),
      click: (menuItem) => {
        setAutostart(menuItem.checked);
      }
    },
    { type: 'separator' },
    {
      label: 'Quit WhatsApp (Ctrl+Q)',
      click: () => {
        quitApplication();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function createTray() {
  const iconPath = unreadCount > 0 ? TRAY_ICON_UNREAD : TRAY_ICON_NORMAL;
  tray = new Tray(iconPath);
  
  updateTrayTitle();
  updateTrayMenu();

  // Left click on tray icon toggles window visibility
  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
    updateTrayMenu();
  });
}

function updateTrayTitle() {
  if (!tray) return;

  if (unreadCount > 0) {
    tray.setImage(TRAY_ICON_UNREAD);
    tray.setToolTip(`WhatsApp Linux (${unreadCount} unread message${unreadCount > 1 ? 's' : ''})`);
  } else {
    tray.setImage(TRAY_ICON_NORMAL);
    tray.setToolTip('WhatsApp Linux');
  }

  // Update app title / badge on dock
  if (app.setBadgeCount) {
    app.setBadgeCount(unreadCount);
  }
}

function quitApplication() {
  isQuitting = true;
  saveWindowState();
  if (tray) {
    tray.destroy();
  }
  app.quit();
}

// IPC Handlers
ipcMain.on('unread-count-changed', (event, count) => {
  unreadCount = count;
  updateTrayTitle();
});

ipcMain.on('notification-clicked', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }
});

ipcMain.on('incoming-call-alert', () => {
  if (mainWindow) {
    // Flash window frame on Linux taskbar
    mainWindow.flashFrame(true);
    
    // If window is hidden, show system notification
    if (!mainWindow.isVisible() && Notification.isSupported()) {
      const callNotif = new Notification({
        title: 'Incoming WhatsApp Call',
        body: 'You have an incoming voice or video call on WhatsApp.',
        icon: APP_ICON_PNG,
        urgency: 'critical'
      });
      callNotif.on('click', () => {
        mainWindow.show();
        mainWindow.focus();
      });
      callNotif.show();
    }
  }
});

ipcMain.on('preload-ready', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('set-privacy-mode', appSettings.privacyMode);
    mainWindow.webContents.send('set-oled-mode', appSettings.oledMode);
    mainWindow.webContents.send('set-compact-mode', appSettings.compactMode);
  }
});

ipcMain.on('devices-report', (event, report) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Calling Devices (Mic & Camera)',
    message: 'WhatsApp Calling Hardware Status',
    detail: report,
    buttons: ['OK']
  });
});

// App Lifecycle
app.whenReady().then(() => {
  setupPermissions();
  createMainWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
  saveWindowState();
});

app.on('window-all-closed', () => {
  // On Linux, keep running in tray if user hasn't quit
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit();
  }
});
