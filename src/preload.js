/**
 * WhatsApp Linux Preload Script
 * 
 * Bridges WhatsApp Web with the native Linux desktop environment:
 * - Monitors unread message count and updates system tray badge
 * - Enhances native notifications and brings window to front on click
 * - Detects incoming calls to notify user immediately
 * - Handles media permissions and device integration
 */

const { ipcRenderer } = require('electron');

// Ensure navigator.userAgentData and platform reflect modern Linux Chrome
try {
  Object.defineProperty(navigator, 'platform', {
    get: () => 'Linux x86_64',
    configurable: true
  });
} catch (e) {
  // Ignore if immutable
}

// Track unread message count from document title or DOM
let lastUnreadCount = 0;

function parseUnreadFromTitle(title) {
  const match = title.match(/^\((\d+)\)/);
  return match ? parseInt(match[1], 10) : 0;
}

function updateUnreadCount() {
  let count = parseUnreadFromTitle(document.title);
  
  // Secondary fallback: check unread badge elements in chat list
  if (count === 0) {
    try {
      const badgeElements = document.querySelectorAll('span[aria-label*="unread message"], span[aria-label*="unread"]');
      let domCount = 0;
      badgeElements.forEach(el => {
        const num = parseInt(el.textContent.trim(), 10);
        if (!isNaN(num) && num > 0) {
          domCount += num;
        } else if (el.textContent.trim() === '') {
          domCount += 1;
        }
      });
      if (domCount > 0) count = domCount;
    } catch (err) {
      // Ignore DOM query errors
    }
  }

  if (count !== lastUnreadCount) {
    lastUnreadCount = count;
    ipcRenderer.send('unread-count-changed', count);
  }
}

// Watch title changes for unread count updates
const titleObserver = new MutationObserver(() => {
  updateUnreadCount();
});

// Watch DOM for incoming call popups/modals
let lastCallDetected = false;
function checkForIncomingCalls() {
  try {
    // WhatsApp incoming call banners typically have aria-labels or text indicating incoming voice/video call
    const callDialog = document.querySelector('[data-animate-modal-popup="true"], div[role="dialog"]');
    if (callDialog) {
      const text = (callDialog.textContent || '').toLowerCase();
      const isCall = text.includes('incoming call') || text.includes('incoming voice call') || text.includes('incoming video call') || text.includes('calling...');
      if (isCall && !lastCallDetected) {
        lastCallDetected = true;
        ipcRenderer.send('incoming-call-alert');
      } else if (!isCall) {
        lastCallDetected = false;
      }
    } else {
      lastCallDetected = false;
    }
  } catch (e) {
    // Ignore
  }
}

// Hook Notification API to ensure clicking notification restores WhatsApp window
const OriginalNotification = window.Notification;
if (OriginalNotification) {
  function LinuxNotification(title, options) {
    const notif = new OriginalNotification(title, options);
    
    // Auto-focus window on click
    notif.addEventListener('click', () => {
      ipcRenderer.send('notification-clicked');
      try {
        window.focus();
      } catch (e) {}
    });
    
    return notif;
  }

  // Copy static properties & prototype
  LinuxNotification.prototype = OriginalNotification.prototype;
  LinuxNotification.permission = OriginalNotification.permission;
  LinuxNotification.requestPermission = OriginalNotification.requestPermission.bind(OriginalNotification);
  
  try {
    window.Notification = LinuxNotification;
  } catch (e) {
    console.warn('Could not override Notification:', e);
  }
}

// Inject custom CSS styling improvements, Privacy Mode, OLED Black, and Compact styling
function injectCustomStyles() {
  const styleEl = document.createElement('style');
  styleEl.id = 'whatsapp-linux-custom-styles';
  styleEl.textContent = `
    /* Sleek Linux desktop scrollbars */
    ::-webkit-scrollbar {
      width: 6px !important;
      height: 6px !important;
    }
    ::-webkit-scrollbar-thumb {
      background-color: rgba(128, 128, 128, 0.4) !important;
      border-radius: 4px !important;
    }
    ::-webkit-scrollbar-thumb:hover {
      background-color: rgba(128, 128, 128, 0.7) !important;
    }
    ::-webkit-scrollbar-track {
      background: transparent !important;
    }

    /* Privacy Mode: Blurs messages, names, and images until hovered */
    body.wa-privacy-mode div[role="row"] span[title],
    body.wa-privacy-mode .copyable-text,
    body.wa-privacy-mode div[data-testid="msg-container"] span,
    body.wa-privacy-mode div[data-testid="msg-container"] p,
    body.wa-privacy-mode [data-pre-plain-text],
    body.wa-privacy-mode img[src*="blob:"],
    body.wa-privacy-mode img[src*="data:image"],
    body.wa-privacy-mode [data-testid="conversation-panel-messages"] img {
      filter: blur(8px) !important;
      transition: filter 0.18s ease-in-out !important;
    }
    body.wa-privacy-mode div[role="row"]:hover span[title],
    body.wa-privacy-mode .copyable-text:hover,
    body.wa-privacy-mode div[data-testid="msg-container"]:hover span,
    body.wa-privacy-mode div[data-testid="msg-container"]:hover p,
    body.wa-privacy-mode [data-pre-plain-text]:hover,
    body.wa-privacy-mode img[src*="blob:"]:hover,
    body.wa-privacy-mode img[src*="data:image"]:hover,
    body.wa-privacy-mode [data-testid="conversation-panel-messages"]:hover img {
      filter: none !important;
    }

    /* OLED Pure Black Dark Theme */
    body.wa-oled-black,
    body.wa-oled-black #app,
    body.wa-oled-black [data-testid="chat-list"],
    body.wa-oled-black [data-testid="conversation-panel-wrapper"],
    body.wa-oled-black [data-testid="intro-background"],
    body.wa-oled-black [data-asset-intro-image-light],
    body.wa-oled-black [data-asset-intro-image-dark] {
      background-color: #000000 !important;
    }
    body.wa-oled-black header {
      background-color: #0a0a0a !important;
      border-bottom: 1px solid #1a1a1a !important;
    }
    body.wa-oled-black div[data-testid="conversation-panel-messages"] {
      background-color: #000000 !important;
      background-image: none !important;
    }
    body.wa-oled-black div[data-testid="msg-container"] {
      background-color: #0d0d0d !important;
      border: 1px solid #1c1c1c !important;
    }
    body.wa-oled-black [data-testid="message-in"] > div {
      background-color: #121212 !important;
    }
    body.wa-oled-black [data-testid="message-out"] > div {
      background-color: #004d40 !important;
    }

    /* Compact Chat List Mode */
    body.wa-compact-mode div[data-testid="cell-frame-container"] {
      height: 52px !important;
    }
    body.wa-compact-mode div[role="row"] {
      padding-top: 2px !important;
      padding-bottom: 2px !important;
    }
  `;
  document.head.appendChild(styleEl);
}

// Initialize listeners once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  const titleEl = document.querySelector('title');
  if (titleEl) {
    titleObserver.observe(titleEl, { childList: true, characterData: true, subtree: true });
  } else {
    titleObserver.observe(document, { childList: true, subtree: true });
  }

  injectCustomStyles();

  // Periodic poll for unread badge & incoming call notifications
  setInterval(updateUnreadCount, 1500);
  setInterval(checkForIncomingCalls, 1000);

  // Request saved settings from main process
  ipcRenderer.send('preload-ready');
});

// IPC listener for shortcut actions from main process
ipcRenderer.on('action-new-chat', () => {
  // Try to click the "New chat" button in WhatsApp Web
  const newChatBtn = document.querySelector('[data-icon="chat"], [aria-label="New chat"], [title="New chat"]');
  if (newChatBtn) {
    const btn = newChatBtn.closest('button') || newChatBtn;
    btn.click();
  }
});

ipcRenderer.on('action-search-chat', () => {
  // Focus search box
  const searchInput = document.querySelector('[contenteditable="true"][data-tab="3"], input[type="text"]');
  if (searchInput) {
    searchInput.focus();
  }
});

// Device diagnostics helper for voice & video calling
ipcRenderer.on('action-check-devices', async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === 'audioinput');
    const videoInputs = devices.filter(d => d.kind === 'videoinput');
    const audioOutputs = devices.filter(d => d.kind === 'audiooutput');

    let report = 'Calling Devices Detected:\n\n';
    
    report += '🎤 Microphones:\n';
    if (audioInputs.length > 0) {
      audioInputs.forEach((d, idx) => {
        report += `  ${idx + 1}. ${d.label || 'Default Microphone'} (${d.deviceId.slice(0, 8)}...)\n`;
      });
    } else {
      report += '  None detected (check microphone connection)\n';
    }

    report += '\n📷 Webcams:\n';
    if (videoInputs.length > 0) {
      videoInputs.forEach((d, idx) => {
        report += `  ${idx + 1}. ${d.label || 'Default Webcam'} (${d.deviceId.slice(0, 8)}...)\n`;
      });
    } else {
      report += '  None detected (check camera connection)\n';
    }

    report += '\n🔊 Audio Output (Speakers):\n';
    if (audioOutputs.length > 0) {
      audioOutputs.forEach((d, idx) => {
        report += `  ${idx + 1}. ${d.label || 'Default Output'}\n`;
      });
    } else {
      report += '  System default\n';
    }

    ipcRenderer.send('devices-report', report);
  } catch (err) {
    ipcRenderer.send('devices-report', 'Error detecting media devices: ' + err.message);
  }
});

// Quality of life feature handlers
ipcRenderer.on('set-privacy-mode', (event, enabled) => {
  if (enabled) {
    document.body.classList.add('wa-privacy-mode');
  } else {
    document.body.classList.remove('wa-privacy-mode');
  }
});

ipcRenderer.on('set-oled-mode', (event, enabled) => {
  if (enabled) {
    document.body.classList.add('dark');
    document.body.classList.add('wa-oled-black');
  } else {
    document.body.classList.remove('wa-oled-black');
  }
});

ipcRenderer.on('set-compact-mode', (event, enabled) => {
  if (enabled) {
    document.body.classList.add('wa-compact-mode');
  } else {
    document.body.classList.remove('wa-compact-mode');
  }
});


